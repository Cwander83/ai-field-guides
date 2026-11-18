import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(SITE_DIR, 'dist');
const VERCEL_JSON_PATH = path.join(SITE_DIR, 'vercel.json');

function sha256Base64(content) {
  return crypto.createHash('sha256').update(content).digest('base64');
}

function walkHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function processDistHtml() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Missing build output directory: ${DIST_DIR}`);
  }

  const htmlFiles = walkHtmlFiles(DIST_DIR);
  const hashSet = new Set();
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const htmlFile of htmlFiles) {
    let html = fs.readFileSync(htmlFile, 'utf8');
    let modified = false;

    html = html.replace(scriptRegex, (fullMatch, attrs, body) => {
      const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
      const scriptType = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
      if (scriptType === 'application/ld+json') {
        return fullMatch;
      }

      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1].trim();
        if (src.startsWith('/')) {
          const assetPath = path.join(DIST_DIR, src.replace(/^\/+/, ''));
          if (fs.existsSync(assetPath)) {
            const fileBuf = fs.readFileSync(assetPath);
            const hash = `sha256-${sha256Base64(fileBuf)}`;
            hashSet.add(`'${hash}'`);
            if (!/\bintegrity\s*=/i.test(attrs)) {
              modified = true;
              return `<script${attrs} integrity="${hash}">${body}</script>`;
            }
          }
        }
        return fullMatch;
      }

      const hash = `sha256-${sha256Base64(Buffer.from(body, 'utf8'))}`;
      hashSet.add(`'${hash}'`);
      return fullMatch;
    });

    if (modified) {
      fs.writeFileSync(htmlFile, html, 'utf8');
    }
  }

  return Array.from(hashSet).sort();
}

function buildVercelConfig(scriptHashes) {
  const gaDomains = [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    'https://region1.google-analytics.com',
    'https://*.g.doubleclick.net',
  ].join(' ');

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')} 'strict-dynamic' https: 'unsafe-inline' 'report-sample'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${gaDomains}`,
    `connect-src 'self' ${gaDomains}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  return {
    cleanUrls: true,
    trailingSlash: false,
    rewrites: [
      {
        source: '/',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '.*text/markdown.*',
          },
        ],
        destination: '/llms.txt',
      },
      {
        source: '/guides/:ecosystem/:slug',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '.*text/markdown.*',
          },
        ],
        destination: '/guides/:ecosystem/:slug.md',
      },
    ],
    headers: [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), browsing-topics=(), focus-without-user-activation=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        source: '/',
        headers: [{ key: 'Vary', value: 'Accept' }],
      },
      {
        source: '/guides/([^./]+/[^./]+)',
        headers: [{ key: 'Vary', value: 'Accept' }],
      },
      {
        source: '/guides/(.*)\\.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/llms-full.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/rss.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/feed.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/guides/(.*)\\.pdf',
        headers: [
          { key: 'Content-Disposition', value: 'inline' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/guides/(.*)\\.webp',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/guides/(.*)/og\\.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/guides/(.*)/cover\\.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/og-default.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/favicon.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/apple-touch-icon.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ],
  };
}

const hashes = processDistHtml();
if (hashes.length === 0) {
  throw new Error('Expected at least 1 executable script hash in dist HTML.');
}

const config = buildVercelConfig(hashes);
fs.writeFileSync(
  VERCEL_JSON_PATH,
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);

console.log(`Synced CSP (${hashes.length} unique script hashes) into vercel.json.`);
