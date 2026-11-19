import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseHtml } from 'node-html-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(SITE_DIR, 'dist');
const SRC_DIR = path.join(SITE_DIR, 'src');

function walkFiles(dir, extFilter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, extFilter, out);
    } else if (entry.isFile() && extFilter(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function sha256Base64(buf) {
  return crypto.createHash('sha256').update(buf).digest('base64');
}

function assertDistFile(relPath) {
  const full = path.join(DIST_DIR, relPath);
  assert.ok(fs.existsSync(full), `Missing dist output: ${relPath}`);
  return fs.readFileSync(full, 'utf8');
}

function assertPngDimensions(relPath, expectedW, expectedH) {
  const full = path.join(DIST_DIR, relPath);
  assert.ok(fs.existsSync(full), `Missing PNG output: ${relPath}`);
  const buf = fs.readFileSync(full);
  assert.ok(buf.length >= 24, `PNG too small: ${relPath}`);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `Invalid PNG signature: ${relPath}`);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  assert.equal(w, expectedW, `Expected ${expectedW}px width for ${relPath}, got ${w}`);
  assert.equal(h, expectedH, `Expected ${expectedH}px height for ${relPath}, got ${h}`);
}

function getHeaderValue(rule, key) {
  return rule.headers.find((h) => h.key === key)?.value;
}

function assertCssDesignFloor(rel, rawText, { checkUppercase = true } = {}) {
  const cssText = rawText.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
  assert.ok(!/(?:-webkit-)?backdrop-filter/i.test(cssText), `Forbidden backdrop-filter in ${rel}`);
  assert.ok(
    !/(?:-webkit-)?background-clip\s*:\s*text/i.test(cssText),
    `Forbidden gradient text clip in ${rel}`,
  );
  if (checkUppercase) {
    assert.ok(!/text-transform\s*:\s*uppercase/i.test(cssText), `Forbidden uppercase text-transform in ${rel}`);
  }

  for (const match of cssText.matchAll(/border-left(?:-width)?\s*:\s*([^;}\n]+)/gi)) {
    const value = match[1];
    for (const lenMatch of value.matchAll(/(\d+(?:\.\d+)?)\s*(px|pt|rem|em)\b/gi)) {
      const num = Number.parseFloat(lenMatch[1]);
      const unit = lenMatch[2].toLowerCase();
      const pxApprox = unit === 'rem' || unit === 'em' ? num * 16 : num;
      assert.ok(pxApprox <= 1, `Forbidden >1px border-left (${lenMatch[0]}) in ${rel}`);
    }
  }

  for (const match of cssText.matchAll(/box-shadow\s*:\s*([^;{}]+)/gi)) {
    for (const layer of match[1].split(',')) {
      const trimmed = layer.trim();
      if (!trimmed || trimmed === 'none') continue;
      const cleaned = trimmed.replace(/\b(?:rgba?|hsla?|oklch|var)\([^)]*\)/gi, '');
      const offsetMatch = cleaned.match(
        /(?:^|\s)(-?\d+(?:\.\d+)?)(?:px|rem|em)?\s+(-?\d+(?:\.\d+)?)(?:px|rem|em)?\s+0(?:px|rem|em)?(?=\s|$)/i,
      );
      if (offsetMatch) {
        const hasUnit = /(?:px|rem|em)/i.test(offsetMatch[0]);
        const x = Math.abs(Number.parseFloat(offsetMatch[1]));
        const y = Math.abs(Number.parseFloat(offsetMatch[2]));
        if (hasUnit && (x > 0 || y > 0)) {
          assert.fail(`Forbidden hard offset box-shadow (${trimmed}) in ${rel}`);
        }
      }
    }
  }
}

function assertInternalHrefResolves(sourceRel, rawHref) {
  if (!rawHref.startsWith('/') || rawHref.startsWith('//')) return false;
  const clean = rawHref.split('#')[0].split('?')[0];
  const rel = clean.replace(/^\/+/, '');
  const resolvedBase = path.resolve(DIST_DIR, rel);
  assert.ok(
    resolvedBase === DIST_DIR || resolvedBase.startsWith(`${DIST_DIR}${path.sep}`),
    `Path traversal href (${rawHref}) in ${sourceRel}`,
  );
  const directTarget = rel === '' ? path.join(DIST_DIR, 'index.html') : resolvedBase;
  const indexTarget = rel === '' ? path.join(DIST_DIR, 'index.html') : path.join(resolvedBase, 'index.html');
  const resolves =
    (fs.existsSync(directTarget) && fs.statSync(directTarget).isFile()) ||
    (fs.existsSync(indexTarget) && fs.statSync(indexTarget).isFile());
  assert.ok(resolves, `Broken internal link href="${rawHref}" on ${sourceRel}`);
  return true;
}

function main() {
  assert.ok(fs.existsSync(DIST_DIR), 'dist/ missing — run npm run build first');

  const catalog = JSON.parse(
    fs.readFileSync(path.join(SRC_DIR, 'generated', 'catalog-enriched.json'), 'utf8'),
  );
  const { categories, guides } = catalog;

  // 1. Core static pages
  assertDistFile('index.html');
  assertDistFile('404.html');
  assertDistFile('editorial/index.html');
  assertDistFile('privacy/index.html');
  assertDistFile('terms/index.html');
  assertDistFile('topics/index.html');

  // Verify deferred newsletter/support routes were NOT built
  assert.ok(!fs.existsSync(path.join(DIST_DIR, 'newsletter')), 'Deferred /newsletter should not exist');
  assert.ok(!fs.existsSync(path.join(DIST_DIR, 'support')), 'Deferred /support should not exist');

  // 2. Topic hubs
  for (const cat of categories) {
    assertDistFile(`topics/${cat.id}/index.html`);
  }

  // 3. Per-guide HTML, Markdown twins, and 1200x630 OG images
  for (const guide of guides) {
    assertDistFile(`guides/${guide.ecosystem}/${guide.slug}/index.html`);

    const mdText = assertDistFile(`guides/${guide.ecosystem}/${guide.slug}.md`);
    assert.ok(mdText.startsWith(`# ${guide.title}`), `Markdown header mismatch for ${guide.id}`);
    assert.ok(
      mdText.includes('## Edition Note & Attribution') &&
        mdText.includes('https://twelve-pages.com/editorial'),
      `Missing AI attribution in Markdown twin for ${guide.id}`,
    );

    assertPngDimensions(`guides/${guide.ecosystem}/${guide.slug}/og.png`, 1200, 630);
  }

  // 4. Discovery & syndication feeds, robots.txt, and RFC 9116 security.txt
  const llmsTxt = assertDistFile('llms.txt');
  assert.ok(llmsTxt.includes('/llms-full.txt') && llmsTxt.includes('.md'));

  const llmsFull = assertDistFile('llms-full.txt');
  assert.ok(llmsFull.includes('## ') && llmsFull.includes('- Chapters:'));

  const rssXml = assertDistFile('rss.xml');
  const rssItems = rssXml.match(/<item>/g) ?? [];
  assert.equal(rssItems.length, guides.length, `Expected ${guides.length} RSS items`);
  assert.ok(rssXml.includes('type="application/pdf"'), 'Missing PDF enclosures in rss.xml');

  const feedJson = JSON.parse(assertDistFile('feed.json'));
  assert.equal(feedJson.items.length, guides.length, `Expected ${guides.length} JSON feed items`);

  const sitemapXml = assertDistFile('sitemap.xml');
  assert.ok(!sitemapXml.includes('?eco='), 'sitemap.xml must not contain ?eco= URLs');
  for (const staticPath of ['/topics', '/editorial', '/privacy', '/terms']) {
    assert.ok(sitemapXml.includes(`https://twelve-pages.com${staticPath}</loc>`), `Missing ${staticPath} in sitemap.xml`);
  }
  for (const cat of categories) {
    assert.ok(sitemapXml.includes(`https://twelve-pages.com/topics/${cat.id}</loc>`), `Missing topic ${cat.id} in sitemap.xml`);
  }
  for (const g of guides) {
    assert.ok(sitemapXml.includes(`https://twelve-pages.com${g.url}</loc>`), `Missing guide ${g.id} in sitemap.xml`);
  }

  const robotsTxt = assertDistFile('robots.txt');
  const expectedAllowBots = [
    '*',
    'Googlebot',
    'Bingbot',
    'Applebot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'GPTBot',
    'Claude-SearchBot',
    'Claude-User',
    'ClaudeBot',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
  ];
  for (const bot of expectedAllowBots) {
    assert.ok(
      robotsTxt.includes(`User-agent: ${bot}\nAllow: /`),
      `Missing Allow: / block for ${bot} in robots.txt`,
    );
  }
  for (const blockedBot of ['Bytespider', 'CCBot']) {
    assert.ok(
      robotsTxt.includes(`User-agent: ${blockedBot}\nDisallow: /`),
      `Missing Disallow: / block for ${blockedBot} in robots.txt`,
    );
  }
  for (const token of ['sitemap.xml', 'llms.txt', 'llms-full.txt']) {
    assert.ok(robotsTxt.includes(token), `Missing ${token} in robots.txt`);
  }

  const securityTxt = assertDistFile('.well-known/security.txt');
  assert.ok(securityTxt.includes('Contact: https://'), 'security.txt missing HTTPS Contact');
  assert.ok(securityTxt.includes('Preferred-Languages: en'), 'security.txt missing Preferred-Languages: en');
  assert.ok(
    securityTxt.includes('Canonical: https://twelve-pages.com/.well-known/security.txt'),
    'security.txt missing Canonical',
  );
  assert.ok(securityTxt.includes('Policy: https://twelve-pages.com/terms'), 'security.txt missing Policy');
  const expiresMatch = securityTxt.match(/^Expires:\s*(.+)$/m);
  assert.ok(expiresMatch, 'security.txt missing Expires');
  const expiresValue = expiresMatch[1].trim();
  assert.ok(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(expiresValue),
    `security.txt Expires must be ISO-8601/RFC 3339: ${expiresValue}`,
  );
  const expiresMs = Date.parse(expiresValue);
  const nowMs = Date.now();
  assert.ok(
    !Number.isNaN(expiresMs) && expiresMs > nowMs && expiresMs - nowMs <= 185 * 24 * 60 * 60 * 1000,
    `security.txt Expires must be a rolling ~180-day future timestamp: ${expiresValue}`,
  );

  // Verify /editorial documents all machine-readable feeds and plain-text editions
  const editorialHtml = assertDistFile('editorial/index.html');
  for (const feedToken of ['/llms.txt', '/llms-full.txt', '/rss.xml', '/feed.json', '.md']) {
    assert.ok(
      editorialHtml.includes(feedToken),
      `Missing machine-readable feed documentation (${feedToken}) on /editorial`,
    );
  }

  // 5. Security headers, CORP, & CSP hash sync in vercel.json
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'vercel.json'), 'utf8'));
  const globalRule = vercelConfig.headers.find((h) => h.source === '/(.*)');
  assert.ok(globalRule, 'Missing global header rule in vercel.json');
  const hstsValue = getHeaderValue(globalRule, 'Strict-Transport-Security') ?? '';
  assert.ok(
    /max-age=\d+/.test(hstsValue) && hstsValue.includes('includeSubDomains'),
    `Expected Strict-Transport-Security with max-age and includeSubDomains, got: ${hstsValue}`,
  );
  assert.equal(getHeaderValue(globalRule, 'X-Frame-Options'), 'DENY', 'Expected X-Frame-Options: DENY');
  assert.equal(
    getHeaderValue(globalRule, 'Cross-Origin-Resource-Policy'),
    'same-origin',
    'Expected Cross-Origin-Resource-Policy: same-origin on /(.*)',
  );
  assert.equal(getHeaderValue(globalRule, 'X-Content-Type-Options'), 'nosniff');
  assert.equal(
    getHeaderValue(globalRule, 'Referrer-Policy'),
    'strict-origin-when-cross-origin',
    'Expected Referrer-Policy: strict-origin-when-cross-origin',
  );
  const coopValue = getHeaderValue(globalRule, 'Cross-Origin-Opener-Policy');
  assert.ok(
    coopValue === 'same-origin' || coopValue === 'same-origin-allow-popups',
    `Expected strict COOP policy, got: ${coopValue}`,
  );
  const permissionsValue = getHeaderValue(globalRule, 'Permissions-Policy') ?? '';
  for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'browsing-topics=()']) {
    assert.ok(permissionsValue.includes(directive), `Missing ${directive} in Permissions-Policy`);
  }
  assert.equal(
    getHeaderValue(globalRule, 'X-Permitted-Cross-Domain-Policies'),
    'none',
    'Expected X-Permitted-Cross-Domain-Policies: none',
  );

  const cspHeader = getHeaderValue(globalRule, 'Content-Security-Policy') ?? '';
  assert.ok(cspHeader.includes("'strict-dynamic'"), 'CSP missing strict-dynamic');
  assert.ok(cspHeader.includes("base-uri 'none'"), "CSP must use base-uri 'none'");
  assert.ok(cspHeader.includes("frame-ancestors 'none'"), "CSP must use frame-ancestors 'none'");
  assert.ok(cspHeader.includes("object-src 'none'"), "CSP missing object-src 'none'");
  assert.ok(cspHeader.includes('https://*.google-analytics.com'), 'CSP missing GA4 allowance');
  assert.ok(cspHeader.includes('https://*.g.doubleclick.net'), 'CSP missing doubleclick allowance');

  const securityTxtRule = vercelConfig.headers.find((h) => h.source === '/.well-known/security.txt');
  assert.ok(securityTxtRule, 'Missing vercel.json header rule for /.well-known/security.txt');
  assert.equal(
    getHeaderValue(securityTxtRule, 'Content-Type'),
    'text/plain; charset=utf-8',
    'Expected Content-Type: text/plain; charset=utf-8 on /.well-known/security.txt',
  );

  const expectedCrossOriginRoutes = [
    '/.well-known/security.txt',
    '/robots.txt',
    '/sitemap.xml',
    '/og-default.png',
    '/favicon.svg',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/icon-192.png',
    '/icon-512.png',
    '/apple-touch-icon.png',
    '/guides/(.*)/og\\.png',
    '/guides/(.*)/cover\\.png',
    '/guides/(.*)\\.webp',
    '/guides/(.*)\\.pdf',
    '/guides/(.*)\\.md',
    '/llms.txt',
    '/llms-full.txt',
    '/rss.xml',
    '/feed.json',
  ];
  for (const routeSource of expectedCrossOriginRoutes) {
    const rule = vercelConfig.headers.find((h) => h.source === routeSource);
    assert.ok(rule, `Missing vercel.json header rule for ${routeSource}`);
    assert.equal(
      getHeaderValue(rule, 'Cross-Origin-Resource-Policy'),
      'cross-origin',
      `Expected Cross-Origin-Resource-Policy: cross-origin on ${routeSource}`,
    );
  }

  const mdRewriteHome = (vercelConfig.rewrites ?? []).find(
    (r) => r.source === '/' && r.destination === '/llms.txt',
  );
  const mdRewriteGuide = (vercelConfig.rewrites ?? []).find(
    (r) => r.source === '/guides/:ecosystem/:slug' && r.destination === '/guides/:ecosystem/:slug.md',
  );
  assert.ok(mdRewriteHome && mdRewriteGuide, 'Missing Accept: text/markdown rewrites in vercel.json');

  // 6. Inspect every built HTML page for JSON-LD, Consent Mode v2, Cookie Banner, CSP hashes, and internal links
  const htmlFiles = walkFiles(DIST_DIR, (n) => n.endsWith('.html'));
  const expectedHtmlCount = 6 + categories.length + guides.length;
  assert.equal(
    htmlFiles.length,
    expectedHtmlCount,
    `Expected ${expectedHtmlCount} built HTML pages, found ${htmlFiles.length}`,
  );

  const ldRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const legalGraphPages = new Set(['editorial/index.html', 'privacy/index.html', 'terms/index.html']);
  let internalLinksChecked = 0;

  for (const file of htmlFiles) {
    const rel = path.relative(DIST_DIR, file);
    const html = fs.readFileSync(file, 'utf8');

    assert.ok(html.includes('GTM-WBBHXC7S'), `Missing GTM-WBBHXC7S in ${rel}`);
    assert.ok(html.includes('analytics_storage'), `Missing Consent Mode defaults in ${rel}`);
    assert.ok(html.includes('ads_data_redaction'), `Missing ads_data_redaction in ${rel}`);
    assert.ok(html.includes('cookie-consent-bar'), `Missing cookie-consent-bar in ${rel}`);

    const ldMatches = Array.from(html.matchAll(ldRegex));
    const graphNodes = [];
    for (const m of ldMatches) {
      const rawLd = m[1];
      assert.ok(
        !/<\/script/i.test(rawLd) && !rawLd.includes('<!--') && !rawLd.includes('<'),
        `Unescaped '<' or potential script-breakout sequence in JSON-LD on ${rel}`,
      );
      const parsedJson = JSON.parse(rawLd);
      const serialized = JSON.stringify(parsedJson);
      assert.ok(!serialized.includes('?eco='), `Leftover ?eco= in JSON-LD on ${rel}`);
      if (Array.isArray(parsedJson['@graph'])) {
        graphNodes.push(...parsedJson['@graph']);
      } else {
        graphNodes.push(parsedJson);
      }
    }

    if (legalGraphPages.has(rel)) {
      assert.ok(ldMatches.length > 0, `Missing JSON-LD on ${rel}`);
      assert.ok(
        graphNodes.some((node) => node['@type'] === 'BreadcrumbList'),
        `Missing BreadcrumbList in JSON-LD @graph on ${rel}`,
      );
      assert.ok(
        JSON.stringify(graphNodes).includes('https://twelve-pages.com/#website'),
        `Missing https://twelve-pages.com/#website in JSON-LD @graph on ${rel}`,
      );
    }

    for (const m of html.matchAll(scriptRegex)) {
      const attrs = m[1];
      const body = m[2];
      if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (srcMatch) {
        const assetPath = path.join(DIST_DIR, srcMatch[1].replace(/^\/+/, ''));
        const hash = `sha256-${sha256Base64(fs.readFileSync(assetPath))}`;
        assert.ok(cspHeader.includes(`'${hash}'`), `Missing script hash ${hash} for ${srcMatch[1]} in CSP`);
      } else {
        const hash = `sha256-${sha256Base64(Buffer.from(body, 'utf8'))}`;
        assert.ok(cspHeader.includes(`'${hash}'`), `Missing inline script hash ${hash} in CSP on ${rel}`);
      }
    }

    const doc = parseHtml(html);
    for (const el of doc.querySelectorAll('[href]')) {
      const rawHref = el.getAttribute('href');
      if (rawHref && assertInternalHrefResolves(rel, rawHref)) {
        internalLinksChecked += 1;
      }
    }

    // Security check on every target="_blank" link across built HTML.
    for (const el of doc.querySelectorAll('[target="_blank"]')) {
      const rawHref = el.getAttribute('href') ?? '';
      const relTokens = (el.getAttribute('rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      assert.ok(
        relTokens.includes('noopener'),
        `target="_blank" missing rel="noopener" (${rawHref}) on ${rel}`,
      );
      assert.ok(
        relTokens.includes('noreferrer'),
        `target="_blank" missing rel="noreferrer" (${rawHref}) on ${rel}`,
      );
    }
  }

  // 7. DESIGN.md §5 craft-floor guard across src/ and compiled dist/_astro/*.css
  const bannedFonts = [
    'Inter', 'Fraunces', 'Playfair Display', 'Cormorant', 'Lora', 'Crimson',
    'Newsreader', 'Syne', 'Space Grotesk', 'Space Mono', 'IBM Plex', 'DM Sans',
    'DM Serif', 'Outfit', 'Plus Jakarta Sans', 'Instrument Sans',
  ];
  const srcFiles = walkFiles(SRC_DIR, (n) => /\.(astro|css|ts|mjs)$/.test(n));
  for (const file of srcFiles) {
    const rel = path.relative(SRC_DIR, file);
    if (rel.startsWith('generated/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/backdrop-filter/i.test(text), `Forbidden backdrop-filter in ${rel}`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(text), `Forbidden emoji in ${rel}`);
    for (const font of bannedFonts) {
      const fontRegex = new RegExp(`font-family[^;\\n]*\\b${font.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      assert.ok(!fontRegex.test(text), `Forbidden font ${font} in ${rel}`);
    }
    if (/\.(astro|css)$/.test(rel)) {
      assert.ok(
        !/[\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u.test(text),
        `Forbidden Unicode icon pictograph in ${rel}`,
      );
      assertCssDesignFloor(rel, text);
    }
  }

  const distCssDir = path.join(DIST_DIR, '_astro');
  if (fs.existsSync(distCssDir)) {
    for (const file of walkFiles(distCssDir, (n) => n.endsWith('.css'))) {
      const rel = path.relative(DIST_DIR, file);
      assertCssDesignFloor(rel, fs.readFileSync(file, 'utf8'));
    }
  }

  console.log(
    `PASS: Verified ${htmlFiles.length} HTML pages (${internalLinksChecked} internal links), ${guides.length} Markdown twins, ` +
      `${guides.length} 1200x630 OG cards, ${categories.length} topic hubs, feeds, robots/security.txt, ` +
      `Consent Mode v2 (ads_data_redaction), CORP/CSP headers, and DESIGN.md §5 guards.`,
  );
}

main();
