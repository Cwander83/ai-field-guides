import { parse, type HTMLElement } from 'node-html-parser';
import type {
  CoverPillar,
  EnrichedGuide,
  GuideChapter,
  ParsedGuide,
} from '../types/guide';

interface NodeFsLike {
  existsSync(filePath: string): boolean;
  readFileSync(filePath: string, encoding: 'utf8'): string;
  readFileSync(filePath: string): Uint8Array;
}

interface NodePathLike {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
}

interface NodeProcessLike {
  cwd(): string;
  getBuiltinModule(id: string): unknown;
}

function getNodeRuntime(): {
  fs: NodeFsLike;
  path: NodePathLike;
  proc: NodeProcessLike;
} {
  const proc = (globalThis as unknown as { process?: NodeProcessLike }).process;
  if (!proc || typeof proc.getBuiltinModule !== 'function') {
    throw new Error('Node.js runtime with process.getBuiltinModule is required');
  }
  return {
    fs: proc.getBuiltinModule('node:fs') as NodeFsLike,
    path: proc.getBuiltinModule('node:path') as NodePathLike,
    proc,
  };
}

interface CssDeclaration {
  prop: string;
  value: string;
}

const COPY_ICON_SVG =
  '<svg class="icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

const CHECK_ICON_SVG =
  '<svg class="icon-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

const STRIP_INLINE_PROPS = new Set([
  'font-size',
  'line-height',
  'margin',
  'margin-top',
  'margin-bottom',
  'padding',
  'padding-top',
  'padding-bottom',
  'height',
  'max-height',
  'flex',
  'flex-shrink',
]);

function resolveRepoRoot(fs: NodeFsLike, path: NodePathLike, proc: NodeProcessLike): string {
  const cwd = proc.cwd();
  const parent = path.resolve(cwd, '..');
  if (fs.existsSync(path.join(parent, 'guides'))) {
    return parent;
  }
  if (fs.existsSync(path.join(cwd, 'guides'))) {
    return cwd;
  }
  return parent;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function rewriteAssetPath(src: string | undefined, eco: string, slug: string): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const cleanRel = trimmed.replace(/^\.\//, '');
  return `/guides/${eco}/${slug}/${cleanRel}`;
}

const imageDimCache = new Map<string, { width: number; height: number } | null>();

function readImageDimensions(
  fs: NodeFsLike,
  filePath: string,
): { width: number; height: number } | null {
  if (imageDimCache.has(filePath)) {
    return imageDimCache.get(filePath) ?? null;
  }

  let dims: { width: number; height: number } | null = null;
  try {
    if (fs.existsSync(filePath)) {
      const bytes = fs.readFileSync(filePath);
      if (
        bytes.length >= 24 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ) {
        const width =
          ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
        const height =
          ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
        if (width > 0 && height > 0) dims = { width, height };
      } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 3 < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
          }
          while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
          if (offset >= bytes.length) break;
          const marker = bytes[offset];
          offset += 1;
          if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
          if (offset + 1 >= bytes.length) break;
          const segLen = (bytes[offset] << 8) | bytes[offset + 1];
          if (segLen < 2 || offset + segLen > bytes.length) break;
          const isSof =
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);
          if (isSof && offset + 6 < bytes.length) {
            const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
            const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
            if (width > 0 && height > 0) {
              dims = { width, height };
            }
            break;
          }
          offset += segLen;
        }
      }
    }
  } catch {
    dims = null;
  }

  imageDimCache.set(filePath, dims);
  return dims;
}

function resolveGuideImagePath(
  rawSrc: string | undefined,
  guideDir: string,
  repoRoot: string,
  path: NodePathLike,
): string | null {
  if (!rawSrc) return null;
  const trimmed = rawSrc.trim();
  if (!trimmed || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return null;
  }
  if (trimmed.startsWith('/guides/')) {
    return path.join(repoRoot, trimmed.replace(/^\/+/, ''));
  }
  if (trimmed.startsWith('/')) {
    return null;
  }
  return path.join(guideDir, trimmed.replace(/^\.\//, ''));
}

function parseDeclarations(raw: string): CssDeclaration[] {
  const decls: CssDeclaration[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')' && parenDepth > 0) parenDepth--;

    if (ch === ';' && parenDepth === 0) {
      const part = current.trim();
      if (part) {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
          decls.push({
            prop: part.slice(0, colonIdx).trim().toLowerCase(),
            value: part.slice(colonIdx + 1).trim(),
          });
        }
      }
      current = '';
    } else {
      current += ch;
    }
  }

  const tail = current.trim();
  if (tail) {
    const colonIdx = tail.indexOf(':');
    if (colonIdx > 0) {
      decls.push({
        prop: tail.slice(0, colonIdx).trim().toLowerCase(),
        value: tail.slice(colonIdx + 1).trim(),
      });
    }
  }

  return decls;
}

function serializeDeclarations(decls: CssDeclaration[]): string {
  return decls.map((d) => `${d.prop}: ${d.value}`).join('; ');
}

function countGridColumns(value: string): number {
  const repeatMatch = value.match(/repeat\(\s*(\d+)\s*,/i);
  if (repeatMatch) {
    return Number.parseInt(repeatMatch[1], 10);
  }
  // Collapse parenthesized track definitions like minmax(0, 1fr) into one token
  const collapsed = value.replace(/\([^)]*\)/g, 'track');
  const tokens = collapsed.trim().split(/\s+/).filter(Boolean);
  return tokens.length || 2;
}

function getBorderThicknessPx(value: string): number {
  const match = value.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(px|pt)\b/i);
  if (!match) return 0;
  const num = Number.parseFloat(match[1]);
  return match[2].toLowerCase() === 'pt' ? num * 1.333 : num;
}

function isDarkColorValue(value: string): boolean {
  const v = value.toLowerCase();
  if (/linear-gradient/.test(v) && /#0|#1|#2/.test(v)) return true;
  if (/^\s*#([0-3][0-9a-f]{2}|[0-3][0-9a-f]{5})\b/i.test(v)) return true;
  if (/rgba?\(\s*(?:[0-4]?\d)\s*,/.test(v)) return true;
  return false;
}

function elementHasOwnBg(decls: CssDeclaration[]): boolean {
  return decls.some(
    (d) =>
      (d.prop === 'background' || d.prop === 'background-color') &&
      d.value.toLowerCase() !== 'transparent' &&
      d.value.toLowerCase() !== 'none',
  );
}

function shouldKeepInlineColor(el: HTMLElement, ownDecls: CssDeclaration[]): boolean {
  if (elementHasOwnBg(ownDecls)) return true;

  if (
    el.closest('.badge') ||
    el.closest('.p-tag') ||
    el.closest('.meet-chip') ||
    el.closest('.card-dark') ||
    el.closest('pre') ||
    el.closest('.code-block') ||
    el.closest('.code-snippet')
  ) {
    return true;
  }

  let cur: HTMLElement | null = el.parentNode as HTMLElement | null;
  while (cur && cur.tagName) {
    const cls = cur.getAttribute?.('class') ?? '';
    if (cls.includes('figure-caption')) {
      return false;
    }
    if (
      /\bbadge[-_]|\bp-tag\b|\bmeet-chip\b|\bcard-dark\b|\bsev-|\bstatus-chip|\bduet-pill-btn|\bds-pill\b/.test(
        cls,
      )
    ) {
      return true;
    }
    const style = cur.getAttribute?.('style') ?? '';
    if (cur.tagName === 'SPAN' && /background(?:-color)?\s*:/i.test(style)) {
      return true;
    }
    if (/background(?:-color)?\s*:\s*([^;]+)/i.test(style)) {
      const bgVal = RegExp.$1;
      if (isDarkColorValue(bgVal)) return true;
    }
    if (/\bfigure-box\b/.test(cls)) {
      return true;
    }
    cur = cur.parentNode as HTMLElement | null;
  }

  return false;
}

function transformTocItems(page: HTMLElement): void {
  for (const item of page.querySelectorAll('.toc-item')) {
    const pgSpan = item.querySelector('.toc-pg');
    if (!pgSpan) {
      item.classList.add('toc-note');
      continue;
    }
    const match = pgSpan.text.trim().match(/^p\.\s*(\d+)$/i);
    if (!match) {
      item.classList.add('toc-note');
      continue;
    }
    const pageNum = Number.parseInt(match[1], 10);
    if (pageNum < 2 || pageNum > 12) {
      item.classList.add('toc-note');
      continue;
    }
    const partNum = pageNum - 1;
    pgSpan.set_content(`Part ${partNum}`);
    item.replaceWith(
      `<a class="toc-item toc-link" href="#chapter-${partNum}">${item.innerHTML}</a>`,
    );
  }
}

function rewriteImages(
  page: HTMLElement,
  eco: string,
  slug: string,
  fs: NodeFsLike,
  path: NodePathLike,
  guideDir: string,
  repoRoot: string,
): void {
  for (const img of page.querySelectorAll('img')) {
    const rawSrc = img.getAttribute('src');
    if (rawSrc) {
      img.setAttribute('src', rewriteAssetPath(rawSrc, eco, slug));
    }
    const diskPath = resolveGuideImagePath(rawSrc, guideDir, repoRoot, path);
    const dims = (diskPath ? readImageDimensions(fs, diskPath) : null) ?? {
      width: 1600,
      height: 900,
    };
    img.setAttribute('width', String(dims.width));
    img.setAttribute('height', String(dims.height));
    const rawStyle = img.getAttribute('style') ?? '';
    const decls = parseDeclarations(rawStyle).filter(
      (d) => d.prop !== 'aspect-ratio',
    );
    decls.push({ prop: 'aspect-ratio', value: `${dims.width} / ${dims.height}` });
    img.setAttribute('style', serializeDeclarations(decls));
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  }
}

function normalizeSvgs(page: HTMLElement): void {
  for (const svg of page.querySelectorAll('svg')) {
    if (!svg.getAttribute('viewBox')) {
      const wAttr = svg.getAttribute('width');
      const hAttr = svg.getAttribute('height');
      const w = wAttr ? Number.parseFloat(wAttr) : NaN;
      const h = hAttr ? Number.parseFloat(hAttr) : NaN;
      if (
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        w > 0 &&
        h > 0 &&
        !wAttr?.includes('%') &&
        !hAttr?.includes('%')
      ) {
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
    }

    if (svg.getAttribute('viewBox')) {
      svg.removeAttribute('height');
    }

    const rawStyle = svg.getAttribute('style') ?? '';
    const decls = parseDeclarations(rawStyle).filter((d) => {
      if (d.prop === 'max-width' || d.prop === 'height') return false;
      if (d.prop === 'width' && /\d+(?:\.\d+)?px/i.test(d.value)) return false;
      return true;
    });
    decls.push({ prop: 'max-width', value: '100%' });
    decls.push({ prop: 'height', value: 'auto' });
    svg.setAttribute('style', serializeDeclarations(decls));
  }
}

function upscaleUiWindows(page: HTMLElement): void {
  for (const win of page.querySelectorAll('.ui-window')) {
    const targets: HTMLElement[] = [win, ...win.querySelectorAll('[style]')];
    for (const el of targets) {
      const rawStyle = el.getAttribute('style');
      if (!rawStyle) continue;
      const decls = parseDeclarations(rawStyle).map((d) => {
        if (d.prop === 'font-size') {
          const ptMatch = d.value.match(/^([0-9]+(?:\.[0-9]+)?)\s*pt\b(.*)$/i);
          if (ptMatch) {
            const pt = Number.parseFloat(ptMatch[1]);
            const px = Math.max(12, Math.round(pt * 1.45));
            return { prop: d.prop, value: `${px}px${ptMatch[2] ?? ''}` };
          }
        }
        return d;
      });
      el.setAttribute('style', serializeDeclarations(decls));
    }
  }
}

function normalizeDivCodeBlocks(page: HTMLElement): void {
  for (const el of page.querySelectorAll('div.code-block, div.code-snippet')) {
    if (el.closest('.ui-window') || el.querySelector('pre')) continue;
    let html = el.innerHTML;
    if (/<br\s*\/?>/i.test(html)) {
      html = html
        .replace(/\r?\n[ \t]*/g, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
    }
    html = html.replace(/^\s*\n/, '').replace(/\s+$/, '');
    el.replaceWith(`<pre>${html}</pre>`);
  }
}

function stripPrintStylesOutsideUi(page: HTMLElement): void {
  for (const checkGrid of page.querySelectorAll('.check-grid, .checklist-grid')) {
    checkGrid.classList.add('guide-auto-grid-2');
  }

  for (const el of page.querySelectorAll('[style]')) {
    if (
      el.classList.contains('ui-window') ||
      el.closest('.ui-window') ||
      el.tagName === 'SVG' ||
      el.closest('svg')
    ) {
      continue;
    }

    const rawStyle = el.getAttribute('style') ?? '';
    const decls = parseDeclarations(rawStyle);
    const hasGrid = decls.some((d) => d.prop === 'grid-template-columns');
    const hadPadding = decls.some((d) => d.prop === 'padding');
    const hasOwnBg = elementHasOwnBg(decls);

    if (hasGrid) {
      const gridDecl = decls.find((d) => d.prop === 'grid-template-columns')!;
      const cols = countGridColumns(gridDecl.value);
      el.classList.add(cols >= 3 ? 'guide-auto-grid-3' : 'guide-auto-grid-2');
    }

    const cls = el.getAttribute('class') ?? '';
    if (
      el.tagName === 'DIV' &&
      hadPadding &&
      hasOwnBg &&
      !/\b(card|callout|figure-box|figure-caption|code-block|code-snippet)\b/.test(cls)
    ) {
      el.classList.add('guide-inset-box');
    }

    if (
      el.classList.contains('figure-box') &&
      (hadPadding || el.childNodes.some((n) => (n as HTMLElement).tagName === 'SVG'))
    ) {
      el.classList.add('guide-svg-box');
    }

    const keepColor = shouldKeepInlineColor(el, decls);
    let strippedThickLeftBorder = false;

    const filtered: CssDeclaration[] = [];
    for (const d of decls) {
      if (STRIP_INLINE_PROPS.has(d.prop)) continue;
      if (hasGrid && (d.prop === 'display' || d.prop === 'grid-template-columns')) {
        continue;
      }
      if (d.prop === 'grid-column') {
        filtered.push({ prop: 'grid-column', value: '1 / -1' });
        continue;
      }
      if (d.prop === 'border-left' || d.prop === 'border-top') {
        if (getBorderThicknessPx(d.value) > 1) {
          if (d.prop === 'border-left') strippedThickLeftBorder = true;
          continue;
        }
      }
      if (d.prop === 'border-left-width' || d.prop === 'border-top-width') {
        if (getBorderThicknessPx(d.value) > 1) {
          if (d.prop === 'border-left-width') strippedThickLeftBorder = true;
          continue;
        }
      }
      if (d.prop === 'border-left-color' && strippedThickLeftBorder) {
        continue;
      }
      if (d.prop === 'color' && !keepColor) {
        continue;
      }
      filtered.push(d);
    }

    if (filtered.length === 0) {
      el.removeAttribute('style');
    } else {
      el.setAttribute('style', serializeDeclarations(filtered));
    }
  }
}

const RECIPE_COL_RE = /\b(copy[- ]paste|prompt|snippet|command|commands|blueprint|implementation pattern)\b/i;

function enhanceRecipeTables(
  page: HTMLElement,
  slug: string,
  counter: { value: number },
  isRecipeChapter: boolean,
): void {
  for (const table of page.querySelectorAll('table')) {
    if (table.closest('.ui-window')) continue;
    const headerRow = table.querySelector('thead tr') ?? table.querySelector('tr');
    const ths = headerRow ? headerRow.querySelectorAll('th') : [];
    const matchedCols = new Set<number>();
    if (isRecipeChapter) {
      ths.forEach((th, idx) => {
        if (RECIPE_COL_RE.test(normalizeWhitespace(th.text))) {
          matchedCols.add(idx);
        }
      });
    }

    const bodyRows = table.querySelectorAll('tbody tr');
    const rows =
      bodyRows.length > 0
        ? bodyRows
        : table.querySelectorAll('tr').filter((tr) => tr !== headerRow);

    for (const tr of rows) {
      const cells = tr.querySelectorAll('td');
      cells.forEach((td, idx) => {
        if (td.querySelector('.copy-btn, pre')) return;
        const hasRecipeCode = Boolean(td.querySelector('code.recipe-code'));
        if (!matchedCols.has(idx) && !hasRecipeCode) return;
        if (normalizeWhitespace(td.text).length < 12) return;

        counter.value += 1;
        const snippetId = `snippet-${slug}-${counter.value}`;
        const cellInner = td.innerHTML.trim();
        td.set_content(
          `<div class="cell-copyable">` +
            `<div id="${snippetId}" class="cell-copy-target">${cellInner}</div>` +
            `<div class="cell-copy-actions">` +
            `<button type="button" class="copy-btn copy-btn--cell" command="--copy" commandfor="${snippetId}">` +
            `${COPY_ICON_SVG}${CHECK_ICON_SVG}` +
            `<span class="copy-btn-label">Copy</span>` +
            `<span class="sr-only"> snippet ${counter.value}</span>` +
            `</button>` +
            `<span class="copy-tip copy-tip--cell" role="status"></span>` +
            `</div>` +
            `</div>`,
        );
      });
    }
  }
}

function wrapTables(page: HTMLElement): void {
  for (const table of page.querySelectorAll('table')) {
    if (table.closest('.ui-window')) continue;
    table.replaceWith(
      `<div class="table-scroll-wrap" tabindex="0" role="region" aria-label="Reference table">${table.outerHTML}</div>`,
    );
  }
}

function wrapCliFlagsInPreHtml(html: string): string {
  return html.replace(/(^|>)([^<]+)/g, (_m, boundary: string, textSeg: string) => {
    const updated = textSeg.replace(
      /(^|\s)(--[A-Za-z0-9][A-Za-z0-9._-]*)/g,
      '$1<span class="nowrap">$2</span>',
    );
    return `${boundary}${updated}`;
  });
}

function wrapPreCopyables(
  page: HTMLElement,
  slug: string,
  counter: { value: number },
): void {
  for (const pre of page.querySelectorAll('pre')) {
    if (pre.closest('.ui-window')) continue;
    counter.value += 1;
    const snippetId = `snippet-${slug}-${counter.value}`;
    pre.setAttribute('id', snippetId);
    const wrappedInner = wrapCliFlagsInPreHtml(pre.innerHTML);
    if (wrappedInner !== pre.innerHTML) {
      pre.set_content(wrappedInner);
    }
    pre.replaceWith(
      `<div class="copyable-block">` +
        `<div class="copyable-bar">` +
        `<span class="copyable-kind">Prompt / Snippet</span>` +
        `<div class="copy-wrap">` +
        `<button type="button" class="copy-btn" command="--copy" commandfor="${snippetId}">` +
        `${COPY_ICON_SVG}${CHECK_ICON_SVG}` +
        `<span class="copy-btn-label">Copy</span>` +
        `<span class="sr-only"> snippet ${counter.value}</span>` +
        `</button>` +
        `<span class="copy-tip" role="status"></span>` +
        `</div>` +
        `</div>` +
        `${pre.outerHTML}` +
        `</div>`,
    );
  }
}

function wrapUiWindows(page: HTMLElement): void {
  for (const win of page.querySelectorAll('.ui-window')) {
    win.replaceWith(
      `<div class="ui-tour-wrap" tabindex="0" role="region" aria-label="Annotated interface tour">${win.outerHTML}</div>`,
    );
  }
}

function splitSelectors(selectorText: string): string[] {
  const result: string[] = [];
  let cur = '';
  let paren = 0;
  for (const ch of selectorText) {
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    if (ch === ',' && paren === 0) {
      const s = cur.trim();
      if (s) result.push(s);
      cur = '';
    } else {
      cur += ch;
    }
  }
  const tail = cur.trim();
  if (tail) result.push(tail);
  return result;
}

function shouldKeepSelector(rawSelector: string): boolean {
  const s = normalizeWhitespace(rawSelector);
  if (!s) return false;
  if (s === '*' || s === 'html' || s === 'body' || s === 'page') return false;
  if (/^\.page\b|^\.page:|^\.cover\b|^\.brand-pill\b/.test(s)) return false;
  if (/^\.page-header\b|^\.page-footer\b|^\.page-num\b/.test(s)) return false;
  if (/^h2\.page-title\b|^\.page-lead\b|^(h3|p|ul|ol|li)\b/.test(s)) return false;
  if (/^\.grid-[23]\b|^\.toc-list\b|^\.toc-item\b/.test(s)) return false;
  if (/^\.check-grid$|^\.checklist-grid$/.test(s)) return false;
  if (/^table\.clean-table$|^table\.clean-table td$|^table\.clean-table tr/.test(s)) {
    return false;
  }
  if (/^\.figure-caption$/.test(s)) return false;
  if (/showcase-img/.test(s)) return false;
  if (/^\.code-block\b|^\.code-snippet\b/.test(s)) return false;
  if (/^code\b|^\.pill-code\b|^pre$|^\.card$|^\.card-title$|^\.callout$|^\.callout-title$/.test(s)) {
    return false;
  }
  return true;
}

function buildScopedCss(rawCss: string): string {
  const noComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const noAtPage = noComments.replace(/@page\s*\{[\s\S]*?\}/gi, '');

  const scopedRules: string[] = [];
  const blockRegex = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(noAtPage)) !== null) {
    const rawSelText = match[1].trim();
    const rawBody = match[2].trim();
    if (!rawSelText || !rawBody || rawSelText.startsWith('@')) continue;

    const selectors = splitSelectors(rawSelText);
    const keptSelectors: string[] = [];

    for (const sel of selectors) {
      const normSel = normalizeWhitespace(sel);
      if (normSel === ':root') {
        keptSelectors.push('.guide-reader-body');
      } else if (shouldKeepSelector(normSel)) {
        keptSelectors.push(
          normSel.startsWith('.guide-reader-body')
            ? normSel
            : `.guide-reader-body ${normSel}`,
        );
      }
    }

    if (keptSelectors.length === 0) continue;

    const isRootOnly = selectors.every((s) => normalizeWhitespace(s) === ':root');
    const isCalloutVariant = keptSelectors.some((s) => /\.callout\./.test(s));
    const isTableOrCard = keptSelectors.some((s) =>
      /table\.clean-table|\.compact-fm-table|\.card-|\.callout\./.test(s),
    );
    const isCodeBlock = keptSelectors.some((s) =>
      /\.code-block|\.code-snippet/.test(s),
    );
    const isDarkCard = keptSelectors.some((s) => /\.card-dark\b/.test(s));

    const decls = parseDeclarations(rawBody);
    const cleanedDecls: CssDeclaration[] = [];

    for (const d of decls) {
      let prop = d.prop;
      let val = d.value.replace(/var\(--accent\b/g, 'var(--guide-accent');

      if (isRootOnly && prop === '--accent') {
        prop = '--guide-accent';
      }

      if (/8\.5in|11in/i.test(val)) continue;
      if (
        prop === 'flex-shrink' ||
        prop === '-webkit-print-color-adjust' ||
        prop === 'print-color-adjust' ||
        prop === 'page-break-after' ||
        prop === 'page-break-before' ||
        prop === 'break-after' ||
        prop === 'break-before'
      ) {
        continue;
      }

      if (prop === 'font-size' && /\d\s*pt\b/i.test(val)) continue;
      if (prop === 'line-height' && keptSelectors.some((s) => /\.compact-fm-table\b/.test(s))) {
        continue;
      }
      if (isCodeBlock && (prop === 'overflow' || prop === 'margin' || prop === 'margin-top' || prop === 'margin-bottom')) {
        continue;
      }
      if (
        (isTableOrCard || isDarkCard || keptSelectors.some((s) => /\.figure-box\b/.test(s))) &&
        (prop === 'padding' || prop === 'padding-top' || prop === 'padding-bottom' || prop === 'margin' || prop === 'margin-top' || prop === 'margin-bottom')
      ) {
        continue;
      }

      if (prop === 'border-left' || prop === 'border-left-width') {
        if (getBorderThicknessPx(val) > 1 || /var\(--/.test(val)) {
          if (isCalloutVariant) {
            const colorMatch = val.match(/(?:#[0-9a-f]{3,8}|var\([^)]+\)|rgba?\([^)]+\))\s*$/i);
            if (colorMatch) {
              cleanedDecls.push({ prop: 'border-color', value: colorMatch[0] });
            }
          }
          continue;
        }
      }

      if (prop === 'border-left-color') {
        if (isCalloutVariant) {
          cleanedDecls.push({ prop: 'border-color', value: val });
        }
        continue;
      }

      if (prop === 'border-top' && getBorderThicknessPx(val) > 1) {
        continue;
      }

      cleanedDecls.push({ prop, value: val });
    }

    if (cleanedDecls.length === 0) continue;

    scopedRules.push(
      `${keptSelectors.join(', ')} { ${serializeDeclarations(cleanedDecls)}; }`,
    );
  }

  scopedRules.push('.guide-reader-body .guide-inset-box { padding: 0.75rem 1rem; }');
  scopedRules.push('.guide-reader-body .guide-svg-box { padding: 0.875rem 1rem; }');

  return scopedRules.join('\n');
}

export function parseGuide(guide: EnrichedGuide): ParsedGuide {
  const { fs, path, proc } = getNodeRuntime();
  const repoRoot = resolveRepoRoot(fs, path, proc);
  const guideDir = path.join(repoRoot, guide.sourceDir);
  const htmlPath = path.join(guideDir, 'guide.html');
  const cssPath = path.join(guideDir, 'style.css');

  const rawHtml = fs.readFileSync(htmlPath, 'utf8');
  const root = parse(rawHtml);

  // Extract inline <style> blocks and remove them before parsing chapters
  const inlineStyles: string[] = [];
  for (const styleEl of root.querySelectorAll('style')) {
    inlineStyles.push(styleEl.text);
    styleEl.remove();
  }

  const fileCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const scopedCss = buildScopedCss(`${fileCss}\n${inlineStyles.join('\n')}`);

  const pages = root.querySelectorAll('section.page, .page');
  const coverPage = pages[0];

  const badges = coverPage
    ? coverPage
        .querySelectorAll('.cover-badge')
        .map((b) => normalizeWhitespace(b.text))
        .filter(Boolean)
    : [];

  const heroImg = coverPage?.querySelector('.cover-hero-wrap img') ?? null;
  const rawHeroSrc = heroImg?.getAttribute('src');
  const heroImageUrl = heroImg
    ? rewriteAssetPath(rawHeroSrc, guide.ecosystem, guide.slug)
    : null;
  const heroDiskPath = resolveGuideImagePath(rawHeroSrc, guideDir, repoRoot, path);
  const heroDims = heroImg
    ? ((heroDiskPath ? readImageDimensions(fs, heroDiskPath) : null) ?? {
        width: 1600,
        height: 900,
      })
    : null;
  const heroImageAlt = heroImg
    ? normalizeWhitespace(heroImg.getAttribute('alt') || guide.title)
    : guide.title;

  const pillars: CoverPillar[] = coverPage
    ? coverPage
        .querySelectorAll('.cover-stat')
        .map((stat) => ({
          title: normalizeWhitespace(
            stat.querySelector('.cover-stat-title')?.text ?? '',
          ),
          description: normalizeWhitespace(
            stat.querySelector('.cover-stat-desc')?.text ?? '',
          ),
        }))
        .filter((p) => p.title.length > 0 || p.description.length > 0)
    : [];

  const chapters: GuideChapter[] = [];
  const snippetCounter = { value: 0 };

  for (let i = 1; i < pages.length; i++) {
    const page = pages[i];
    const chapterNum = i;

    const rawTag = normalizeWhitespace(
      page.querySelector('.page-header .section-tag')?.text ?? '',
    );
    const sectionTag = rawTag.replace(/^\d+\s*[•·\-–—]\s*/, '').trim();

    for (const chrome of page.querySelectorAll('.page-header, .page-footer')) {
      chrome.remove();
    }

    const titleEl = page.querySelector('h2.page-title');
    const title = titleEl ? normalizeWhitespace(titleEl.text) : `Section ${chapterNum}`;
    titleEl?.remove();

    const leadEl = page.querySelector('p.page-lead');
    const leadHtml = leadEl ? leadEl.innerHTML.trim() : '';
    leadEl?.remove();

    transformTocItems(page);
    rewriteImages(page, guide.ecosystem, guide.slug, fs, path, guideDir, repoRoot);
    normalizeSvgs(page);
    upscaleUiWindows(page);
    normalizeDivCodeBlocks(page);
    stripPrintStylesOutsideUi(page);
    enhanceRecipeTables(page, guide.slug, snippetCounter, chapterNum === 8);
    wrapTables(page);
    wrapPreCopyables(page, guide.slug, snippetCounter);
    wrapUiWindows(page);

    chapters.push({
      number: chapterNum,
      id: `chapter-${chapterNum}`,
      sectionTag,
      title,
      leadHtml,
      bodyHtml: page.innerHTML.trim(),
    });
  }

  return {
    guide,
    heroImageUrl,
    heroImageAlt,
    heroImageWidth: heroDims?.width,
    heroImageHeight: heroDims?.height,
    badges,
    pillars,
    scopedCss,
    chapters,
  };
}
