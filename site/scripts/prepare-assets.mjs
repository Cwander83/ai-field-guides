import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SITE_DIR, '..');

const FEATURED_NEW_IDS = new Set([
  'cloud-data-and-commerce/supabase-and-postgres-for-ai-agents',
  'cloud-data-and-commerce/cloudflare-agents-and-edge-sandboxes',
  'cloud-data-and-commerce/stripe-agent-toolkit-and-agentic-commerce',
  'cloud-data-and-commerce/agent-auth-identity-and-permissions',
  'cloud-data-and-commerce/ai-data-analysis-duckdb-and-sql-agents',
  'product-and-design/figma-make-and-mcp-design-to-code',
  'product-and-design/notion-custom-agents-and-mcp-hubs',
  'product-and-design/linear-agents-and-issue-to-pr',
  'product-and-design/ai-user-research-and-prd-prototyping',
  'product-and-design/github-copilot-agent-mode-and-mcp',
  'google/google-adk-and-a2a',
  'open-harnesses/opencode-tui-agents-and-routing',
  'open-harnesses/opencode-plugins-tools-and-ci',
  'open-harnesses/aider-and-goose-terminal-harnesses',
  'open-harnesses/warp-ai-terminal-agents-and-drive',
  'desktop-and-os/mac-vs-windows-ai-power-playbook',
  'desktop-and-os/ai-inbox-zero-and-calendar-defense',
  'desktop-and-os/visual-ai-workflows-n8n-and-make',
]);

/**
 * Load TypeScript module exports from src/lib/goals.ts without duplicating rules.
 */
async function loadGoalsModule() {
  const goalsTsPath = path.join(SITE_DIR, 'src', 'lib', 'goals.ts');
  const source = fs.readFileSync(goalsTsPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

function formatBytesLabel(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function copyIfChanged(srcPath, destPath) {
  const srcStat = fs.statSync(srcPath);
  if (fs.existsSync(destPath)) {
    const destStat = fs.statSync(destPath);
    if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return true;
}

async function ensureCoverWebp(srcPngPath, destWebpPath) {
  const srcStat = fs.statSync(srcPngPath);
  if (fs.existsSync(destWebpPath)) {
    const destStat = fs.statSync(destWebpPath);
    if (destStat.size > 0 && destStat.mtimeMs >= srcStat.mtimeMs) {
      const meta = await sharp(destWebpPath).metadata();
      return {
        width: meta.width ?? 360,
        height: meta.height ?? 466,
        regenerated: false,
      };
    }
  }

  fs.mkdirSync(path.dirname(destWebpPath), { recursive: true });
  const { data, info } = await sharp(srcPngPath)
    .resize({ width: 360, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(destWebpPath, data);
  return {
    width: info.width,
    height: info.height,
    regenerated: true,
  };
}

const BRAND_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="6.5" y="3.5" width="21.5" height="25.5" rx="4.5" fill="#B45309" />
  <rect x="3" y="3" width="21.5" height="25.5" rx="4.5" fill="#FAF8F4" stroke="#181714" stroke-width="1.5" />
  <rect x="6.5" y="6.5" width="14.5" height="2" rx="1" fill="#B45309" />
  <path d="M7.6 14.4 L9.6 12.8 V23.4 M7.6 23.4 H11.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M14.1 15.2 C14.1 13.4 15.5 12.6 17.3 12.6 C19.1 12.6 20.4 13.7 20.4 15.3 C20.4 16.9 19.1 18.1 17.1 19.8 L14.0 22.5 V23.4 H20.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;

function buildAppIconSvg(size) {
  const pad = Math.round(size * 0.14);
  const inner = size - pad * 2;
  const scale = inner / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" fill="#FAF8F4" />
  <g transform="translate(${pad}, ${pad}) scale(${scale})">
    <rect x="6.5" y="3.5" width="21.5" height="25.5" rx="4.5" fill="#B45309" />
    <rect x="3" y="3" width="21.5" height="25.5" rx="4.5" fill="#FFFFFF" stroke="#181714" stroke-width="1.5" />
    <rect x="6.5" y="6.5" width="14.5" height="2" rx="1" fill="#B45309" />
    <path d="M7.6 14.4 L9.6 12.8 V23.4 M7.6 23.4 H11.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14.1 15.2 C14.1 13.4 15.5 12.6 17.3 12.6 C19.1 12.6 20.4 13.7 20.4 15.3 C20.4 16.9 19.1 18.1 17.1 19.8 L14.0 22.5 V23.4 H20.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>
`;
}

function buildIcoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(entries.length, 4);

  const dirBuffers = [];
  let offset = 6 + entries.length * 16;

  for (const { size, data } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirBuffers.push(dir);
    offset += data.length;
  }

  return Buffer.concat([header, ...dirBuffers, ...entries.map((e) => e.data)]);
}

async function generateBrandAssets({ totalGuides, guides }) {
  const publicDir = path.join(SITE_DIR, 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  // 1. SVG Favicon
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), BRAND_FAVICON_SVG, 'utf8');

  // 2. PNG Favicons & Multi-size ICO
  const faviconSvgBuf = Buffer.from(BRAND_FAVICON_SVG, 'utf8');
  const png16 = await sharp(faviconSvgBuf, { density: 300 }).resize(16, 16).png().toBuffer();
  const png32 = await sharp(faviconSvgBuf, { density: 300 }).resize(32, 32).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
  fs.writeFileSync(
    path.join(publicDir, 'favicon.ico'),
    buildIcoFromPngs([
      { size: 16, data: png16 },
      { size: 32, data: png32 },
    ]),
  );

  // 3. Apple Touch Icon & PWA / Search Icons
  const applePng = await sharp(Buffer.from(buildAppIconSvg(180), 'utf8')).png().toBuffer();
  const icon192Png = await sharp(Buffer.from(buildAppIconSvg(192), 'utf8')).png().toBuffer();
  const icon512Png = await sharp(Buffer.from(buildAppIconSvg(512), 'utf8')).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), applePng);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192Png);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512Png);

  // 4. Web Manifest
  const manifest = {
    name: 'Twelve Pages',
    short_name: 'Twelve Pages',
    description:
      'Visual 12-page handbooks you can read online in minutes or download as a printable magazine PDF.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF8F4',
    theme_color: '#FAF8F4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  fs.writeFileSync(
    path.join(publicDir, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  // 5. Default 1200x630 Open Graph Card with 3 real handbook covers
  const preferredIds = [
    'claude/claude-meetings',
    'claude/claude-design',
    'obsidian/obsidian-desktop-ai-agents',
  ];
  const byId = new Map(guides.map((g) => [g.id, g]));
  const showcaseGuides = preferredIds
    .map((id) => byId.get(id))
    .filter(Boolean);
  for (const g of guides) {
    if (showcaseGuides.length >= 3) break;
    if (!showcaseGuides.some((s) => s.id === g.id)) {
      showcaseGuides.push(g);
    }
  }

  const coverPlacements = [
    { left: 720, top: 96, width: 178, height: 230 },
    { left: 926, top: 96, width: 178, height: 230 },
    { left: 806, top: 248, width: 210, height: 272 },
  ];

  const coverOverlays = [];
  for (let i = 0; i < Math.min(3, showcaseGuides.length); i++) {
    const g = showcaseGuides[i];
    const slot = coverPlacements[i];
    const coverSrc = path.join(SITE_DIR, 'public', g.coverPngUrl);
    const resizedCover = await sharp(coverSrc)
      .resize(slot.width, slot.height, { fit: 'cover' })
      .png()
      .toBuffer();

    if (i === 2) {
      const frontFrameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${slot.width + 16}" height="${slot.height + 18}" viewBox="0 0 ${slot.width + 16} ${slot.height + 18}">
        <rect x="8" y="10" width="${slot.width}" height="${slot.height}" rx="6" fill="#181714" fill-opacity="0.16" />
        <rect x="3" y="3" width="${slot.width + 2}" height="${slot.height + 2}" rx="5" fill="#FFFFFF" stroke="#E4DED2" stroke-width="2" />
      </svg>`;
      coverOverlays.push({
        input: Buffer.from(frontFrameSvg, 'utf8'),
        left: slot.left - 4,
        top: slot.top - 4,
      });
    }

    coverOverlays.push({
      input: resizedCover,
      left: slot.left,
      top: slot.top,
    });
  }

  const frameRectsSvg = coverPlacements
    .slice(0, 2)
    .map(
      (s) =>
        `<rect x="${s.left + 4}" y="${s.top + 8}" width="${s.width}" height="${s.height}" rx="6" fill="#181714" fill-opacity="0.1" />
    <rect x="${s.left - 1}" y="${s.top - 1}" width="${s.width + 2}" height="${s.height + 2}" rx="5" fill="#FFFFFF" stroke="#E4DED2" stroke-width="2" />`,
    )
    .join('\n    ');

  const ogBaseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FAF8F4" />
  <rect x="36" y="36" width="1128" height="558" rx="18" fill="#FFFFFF" stroke="#E4DED2" stroke-width="2" />
  <rect x="684" y="64" width="448" height="502" rx="14" fill="#FAF8F4" stroke="#E4DED2" stroke-width="1.5" />
  ${frameRectsSvg}

  <g transform="translate(88, 76) scale(1.35)">
    <rect x="6.5" y="3.5" width="21.5" height="25.5" rx="4.5" fill="#B45309" />
    <rect x="3" y="3" width="21.5" height="25.5" rx="4.5" fill="#FAF8F4" stroke="#181714" stroke-width="1.5" />
    <rect x="6.5" y="6.5" width="14.5" height="2" rx="1" fill="#B45309" />
    <path d="M7.6 14.4 L9.6 12.8 V23.4 M7.6 23.4 H11.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M14.1 15.2 C14.1 13.4 15.5 12.6 17.3 12.6 C19.1 12.6 20.4 13.7 20.4 15.3 C20.4 16.9 19.1 18.1 17.1 19.8 L14.0 22.5 V23.4 H20.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </g>

  <text x="144" y="107" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#181714">Twelve Pages</text>
  <rect x="88" y="138" width="56" height="4" rx="2" fill="#B45309" />

  <text x="88" y="206" font-family="Georgia, 'Times New Roman', serif" font-size="48" font-weight="700" fill="#181714">
    <tspan x="88" dy="0">Visual 12-page</tspan>
    <tspan x="88" dy="58">handbooks you can</tspan>
    <tspan x="88" dy="58">read in minutes.</tspan>
  </text>

  <text x="88" y="388" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="400" fill="#575248">
    <tspan x="88" dy="0">Illustrated step-by-step editions for modern</tspan>
    <tspan x="88" dy="32">software, creative studios, coding, and workflows.</tspan>
  </text>

  <rect x="88" y="486" width="552" height="1" fill="#E4DED2" />
  <text x="88" y="528" font-family="'Helvetica Neue', Arial, sans-serif" font-size="20" font-weight="600" fill="#92400E">twelve-pages.com  &#8226;  ${totalGuides} Handbooks  &#8226;  Free Web &amp; PDF</text>
</svg>
`;

  const ogPng = await sharp(Buffer.from(ogBaseSvg, 'utf8'))
    .composite(coverOverlays)
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'og-default.png'), ogPng);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextLines(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) {
        current = '';
        break;
      }
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}...` : word;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    const joinedWords = lines.join(' ').split(/\s+/).length;
    if (joinedWords < words.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length > maxChars - 3 ? `${last.slice(0, maxChars - 3).trimEnd()}...` : `${last}...`;
    }
  }
  return lines;
}

const SCRIPT_MTIME_MS = fs.statSync(__filename).mtimeMs;

async function ensureGuideOgPng({
  srcCoverPath,
  destOgPngPath,
  title,
  subtitle,
  ecoShort,
  pages,
}) {
  const srcStat = fs.statSync(srcCoverPath);
  if (fs.existsSync(destOgPngPath)) {
    const destStat = fs.statSync(destOgPngPath);
    if (
      destStat.size > 0 &&
      destStat.mtimeMs >= srcStat.mtimeMs &&
      destStat.mtimeMs >= SCRIPT_MTIME_MS
    ) {
      return false;
    }
  }

  fs.mkdirSync(path.dirname(destOgPngPath), { recursive: true });
  const coverWidth = 280;
  const coverHeight = 362;
  const coverLeft = 808;
  const coverTop = 134;

  const resizedCover = await sharp(srcCoverPath)
    .resize(coverWidth, coverHeight, { fit: 'cover' })
    .png()
    .toBuffer();

  const titleLines = wrapTextLines(title, 26, 3);
  const titleLineHeight = 46;
  const titleStartY = 192;
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="84" dy="${i === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`)
    .join('\n    ');

  const subStartY = titleStartY + titleLines.length * titleLineHeight + 16;
  const subMaxLines = titleLines.length >= 3 ? 3 : 4;
  const subLines = wrapTextLines(subtitle, 56, subMaxLines);
  const subTspans = subLines
    .map((line, i) => `<tspan x="84" dy="${i === 0 ? 0 : 28}">${escapeXml(line)}</tspan>`)
    .join('\n    ');

  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FAF8F4" />
  <rect x="36" y="36" width="1128" height="558" rx="18" fill="#FFFFFF" stroke="#E4DED2" stroke-width="2" />
  <rect x="764" y="64" width="368" height="502" rx="14" fill="#FAF8F4" stroke="#E4DED2" stroke-width="1.5" />
  <rect x="${coverLeft + 6}" y="${coverTop + 10}" width="${coverWidth}" height="${coverHeight}" rx="6" fill="#181714" fill-opacity="0.14" />
  <rect x="${coverLeft - 2}" y="${coverTop - 2}" width="${coverWidth + 4}" height="${coverHeight + 4}" rx="5" fill="#FFFFFF" stroke="#E4DED2" stroke-width="2" />

  <g transform="translate(84, 72) scale(1.15)">
    <rect x="6.5" y="3.5" width="21.5" height="25.5" rx="4.5" fill="#B45309" />
    <rect x="3" y="3" width="21.5" height="25.5" rx="4.5" fill="#FAF8F4" stroke="#181714" stroke-width="1.5" />
    <rect x="6.5" y="6.5" width="14.5" height="2" rx="1" fill="#B45309" />
    <path d="M7.6 14.4 L9.6 12.8 V23.4 M7.6 23.4 H11.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M14.1 15.2 C14.1 13.4 15.5 12.6 17.3 12.6 C19.1 12.6 20.4 13.7 20.4 15.3 C20.4 16.9 19.1 18.1 17.1 19.8 L14.0 22.5 V23.4 H20.6" stroke="#181714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </g>
  <text x="132" y="99" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="700" fill="#181714">Twelve Pages</text>
  <rect x="84" y="128" width="52" height="4" rx="2" fill="#B45309" />

  <text x="84" y="${titleStartY}" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="#181714">
    ${titleTspans}
  </text>

  <text x="84" y="${subStartY}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="20" font-weight="400" fill="#575248">
    ${subTspans}
  </text>

  <rect x="84" y="492" width="640" height="1" fill="#E4DED2" />
  <text x="84" y="532" font-family="'Helvetica Neue', Arial, sans-serif" font-size="19" font-weight="600" fill="#92400E">twelve-pages.com  &#8226;  ${escapeXml(ecoShort)}  &#8226;  ${pages}-Page Visual Handbook</text>
</svg>
`;

  const ogBuffer = await sharp(Buffer.from(ogSvg, 'utf8'))
    .composite([
      {
        input: resizedCover,
        left: coverLeft,
        top: coverTop,
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(destOgPngPath, ogBuffer);
  return true;
}

async function main() {
  const { ECOSYSTEM_SHORT_NAMES, classifyGoals } = await loadGoalsModule();

  const catalogPath = path.join(REPO_ROOT, 'catalog.json');
  const rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const categoryMap = new Map();
  const categories = rawCatalog.categories.map((cat) => {
    const enrichedCat = {
      id: cat.id,
      title: cat.title,
      shortTitle: ECOSYSTEM_SHORT_NAMES[cat.id] ?? cat.title,
      description: cat.description,
    };
    categoryMap.set(cat.id, enrichedCat);
    return enrichedCat;
  });

  let copiedFiles = 0;
  let skippedFiles = 0;
  let generatedWebps = 0;
  let cachedWebps = 0;
  let generatedOgs = 0;
  let cachedOgs = 0;

  const enrichedGuides = [];

  for (const guide of rawCatalog.guides) {
    const [eco, slug] = guide.id.split('/');
    if (!eco || !slug) {
      throw new Error(`Invalid guide id format: ${guide.id}`);
    }

    const srcGuideDir = path.resolve(REPO_ROOT, guide.source_dir);
    const srcCoverPath = path.resolve(REPO_ROOT, guide.cover);
    const srcPdfPath = path.resolve(REPO_ROOT, guide.pdf);
    const srcAssetsDir = path.join(srcGuideDir, 'assets');

    const destGuideDir = path.join(SITE_DIR, 'public', 'guides', eco, slug);
    const destAssetsDir = path.join(destGuideDir, 'assets');
    fs.mkdirSync(destAssetsDir, { recursive: true });

    const pdfFilename = path.basename(srcPdfPath);
    const destCoverPngPath = path.join(destGuideDir, 'cover.png');
    const destCoverWebpPath = path.join(destGuideDir, 'cover.webp');
    const destOgPngPath = path.join(destGuideDir, 'og.png');
    const destPdfPath = path.join(destGuideDir, pdfFilename);

    if (copyIfChanged(srcCoverPath, destCoverPngPath)) copiedFiles++;
    else skippedFiles++;

    if (copyIfChanged(srcPdfPath, destPdfPath)) copiedFiles++;
    else skippedFiles++;

    if (fs.existsSync(srcAssetsDir)) {
      const entries = fs.readdirSync(srcAssetsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        const srcAsset = path.join(srcAssetsDir, entry.name);
        const destAsset = path.join(destAssetsDir, entry.name);
        if (copyIfChanged(srcAsset, destAsset)) copiedFiles++;
        else skippedFiles++;
      }
    }

    const webpInfo = await ensureCoverWebp(srcCoverPath, destCoverWebpPath);
    if (webpInfo.regenerated) generatedWebps++;
    else cachedWebps++;

    const pdfStat = fs.statSync(srcPdfPath);
    const catInfo = categoryMap.get(guide.category);
    const ecoShort =
      catInfo?.shortTitle ?? ECOSYSTEM_SHORT_NAMES[eco] ?? guide.category;

    const ogRegenerated = await ensureGuideOgPng({
      srcCoverPath,
      destOgPngPath,
      title: guide.title,
      subtitle: guide.subtitle,
      ecoShort,
      pages: guide.pages,
    });
    if (ogRegenerated) generatedOgs++;
    else cachedOgs++;

    const goals = classifyGoals({
      id: guide.id,
      category: guide.category,
      title: guide.title,
      subtitle: guide.subtitle,
      tags: guide.tags,
    });

    const enriched = {
      id: guide.id,
      ecosystem: eco,
      ecosystemTitle: catInfo?.title ?? guide.category,
      ecosystemShort: ecoShort,
      slug,
      title: guide.title,
      subtitle: guide.subtitle,
      version: guide.version,
      updated: guide.updated,
      pages: guide.pages,
      tags: guide.tags,
      goals,
      readingMinutes: 12,
      url: `/guides/${eco}/${slug}`,
      markdownUrl: `/guides/${eco}/${slug}.md`,
      ogImageUrl: `/guides/${eco}/${slug}/og.png`,
      coverWebpUrl: `/guides/${eco}/${slug}/cover.webp`,
      coverPngUrl: `/guides/${eco}/${slug}/cover.png`,
      coverWidth: webpInfo.width,
      coverHeight: webpInfo.height,
      pdfUrl: `/guides/${eco}/${slug}/${pdfFilename}`,
      pdfFilename,
      pdfSizeBytes: pdfStat.size,
      pdfSizeLabel: formatBytesLabel(pdfStat.size),
      sourceDir: guide.source_dir,
    };

    if (FEATURED_NEW_IDS.has(guide.id)) {
      enriched.isFeaturedNew = true;
    }

    enrichedGuides.push(enriched);
  }

  const stats = {
    totalGuides: enrichedGuides.length,
    totalPages: enrichedGuides.reduce((acc, g) => acc + g.pages, 0),
    totalEcosystems: categories.length,
  };

  const outDir = path.join(SITE_DIR, 'src', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'catalog-enriched.json');
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ categories, guides: enrichedGuides, stats }, null, 2)}\n`,
    'utf8',
  );

  await generateBrandAssets({
    totalGuides: stats.totalGuides,
    guides: enrichedGuides,
  });

  console.log(
    `Prepared ${stats.totalGuides} guides (${stats.totalPages} pages, ${stats.totalEcosystems} ecosystems). ` +
      `Files copied: ${copiedFiles}, skipped: ${skippedFiles}; WebP generated: ${generatedWebps}, cached: ${cachedWebps}; OG PNG generated: ${generatedOgs}, cached: ${cachedOgs}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
