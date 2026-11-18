import { parse, type HTMLElement, type Node } from 'node-html-parser';
import { parseGuide } from './parseGuide';
import { SITE_ORIGIN } from './schema';
import type { EnrichedGuide, ParsedGuide } from '../types/guide';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '...')
    .replace(/&bull;/gi, '•')
    .replace(/&middot;/gi, '·')
    .replace(/&rarr;/gi, '->')
    .replace(/&larr;/gi, '<-')
    .replace(/&trade;/gi, '™')
    .replace(/&reg;/gi, '®')
    .replace(/&copy;/gi, '©')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function cleanText(raw: string): string {
  return decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();
}

function hasClass(el: HTMLElement, className: string): boolean {
  const cls = el.getAttribute('class') ?? '';
  return cls.split(/\s+/).includes(className);
}

function shouldSkipElement(el: HTMLElement): boolean {
  const tag = el.tagName?.toUpperCase();
  if (tag === 'SVG' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'BUTTON') {
    return true;
  }
  if (
    hasClass(el, 'copyable-bar') ||
    hasClass(el, 'cell-copy-actions') ||
    hasClass(el, 'copy-tip') ||
    hasClass(el, 'callout-pin') ||
    hasClass(el, 'ui-pin') ||
    hasClass(el, 'pin-badge')
  ) {
    return true;
  }
  if (el.getAttribute('aria-hidden') === 'true' && tag === 'SVG') {
    return true;
  }
  return false;
}

function inlineChildrenToMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    return decodeHtmlEntities(node.rawText).replace(/\s+/g, ' ');
  }
  if (node.nodeType !== 1) return '';

  const el = node as HTMLElement;
  if (shouldSkipElement(el)) return '';

  const tag = el.tagName.toUpperCase();
  if (tag === 'BR') return '\n';

  if (tag === 'CODE') {
    const code = decodeHtmlEntities(el.text).replace(/\s+/g, ' ').trim();
    if (!code) return '';
    return code.includes('`') ? `\`\` ${code} \`\`` : `\`${code}\``;
  }

  if (tag === 'IMG') {
    const alt = cleanText(el.getAttribute('alt') ?? '');
    return alt ? `*[Illustration: ${alt}]*` : '';
  }

  const inner = el.childNodes.map(inlineChildrenToMarkdown).join('');
  const trimmed = inner.trim();
  if (!trimmed) return '';

  if (tag === 'STRONG' || tag === 'B') return `**${trimmed}**`;
  if (tag === 'EM' || tag === 'I') return `*${trimmed}*`;
  if (tag === 'A') {
    const href = (el.getAttribute('href') ?? '').trim();
    if (!href || href.startsWith('#')) return trimmed;
    const absHref = href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href;
    return `[${trimmed}](${absHref})`;
  }

  return inner;
}

function tableToMarkdown(table: HTMLElement): string {
  const rows: string[][] = [];
  for (const tr of table.querySelectorAll('tr')) {
    const cells = tr
      .querySelectorAll('th, td')
      .map((cell) =>
        cleanText(cell.childNodes.map(inlineChildrenToMarkdown).join('')).replace(/\|/g, '\\|'),
      );
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizeRow = (r: string[]) =>
    Array.from({ length: colCount }, (_, i) => r[i] ?? '');

  const header = normalizeRow(rows[0]);
  const separator = Array.from({ length: colCount }, () => '---');
  const body = rows.slice(1).map(normalizeRow);

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ];
  return lines.join('\n');
}

function listToMarkdown(listEl: HTMLElement, ordered: boolean, depth = 0): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let index = 1;

  for (const child of listEl.childNodes) {
    if (child.nodeType !== 1) continue;
    const li = child as HTMLElement;
    if (li.tagName.toUpperCase() !== 'LI') continue;

    const nestedLists: HTMLElement[] = [];
    const inlineParts: string[] = [];

    for (const liNode of li.childNodes) {
      if (liNode.nodeType === 1) {
        const subEl = liNode as HTMLElement;
        const subTag = subEl.tagName.toUpperCase();
        if (subTag === 'UL' || subTag === 'OL') {
          nestedLists.push(subEl);
          continue;
        }
      }
      inlineParts.push(inlineChildrenToMarkdown(liNode));
    }

    const lineText = inlineParts.join('').replace(/\s+/g, ' ').trim();
    const prefix = ordered ? `${index}. ` : '- ';
    if (lineText) {
      lines.push(`${indent}${prefix}${lineText}`);
    }
    for (const subList of nestedLists) {
      lines.push(listToMarkdown(subList, subList.tagName.toUpperCase() === 'OL', depth + 1));
    }
    index += 1;
  }

  return lines.join('\n');
}

const INLINE_TAGS = new Set([
  'SPAN',
  'STRONG',
  'B',
  'EM',
  'I',
  'CODE',
  'A',
  'BR',
  'SUB',
  'SUP',
  'KBD',
  'SAMP',
  'SMALL',
  'ABBR',
]);

function isInlineOnlyNode(node: Node): boolean {
  if (node.nodeType === 3) return true;
  if (node.nodeType !== 1) return false;
  const el = node as HTMLElement;
  if (shouldSkipElement(el)) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === 'IMG') return false;
  if (!INLINE_TAGS.has(tag)) return false;
  return el.childNodes.every(isInlineOnlyNode);
}

function blockNodesToMarkdown(container: HTMLElement): string[] {
  const blocks: string[] = [];
  let inlineBuffer = '';

  const flushInline = () => {
    const cleaned = inlineBuffer.replace(/[ \t]+/g, ' ').trim();
    if (cleaned) blocks.push(cleaned);
    inlineBuffer = '';
  };

  for (const child of container.childNodes) {
    if (isInlineOnlyNode(child)) {
      inlineBuffer += inlineChildrenToMarkdown(child);
      continue;
    }

    flushInline();
    if (child.nodeType !== 1) continue;

    const el = child as HTMLElement;
    if (shouldSkipElement(el)) continue;

    const tag = el.tagName.toUpperCase();

    if (tag === 'PRE') {
      const code = decodeHtmlEntities(el.text).replace(/\r\n/g, '\n').trim();
      if (code) {
        const fence = code.includes('```') ? '````' : '```';
        blocks.push(`${fence}\n${code}\n${fence}`);
      }
      continue;
    }

    if (tag === 'TABLE') {
      const mdTable = tableToMarkdown(el);
      if (mdTable) blocks.push(mdTable);
      continue;
    }

    if (tag === 'UL' || tag === 'OL') {
      const mdList = listToMarkdown(el, tag === 'OL');
      if (mdList) blocks.push(mdList);
      continue;
    }

    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      const heading = cleanText(el.childNodes.map(inlineChildrenToMarkdown).join(''));
      if (heading) blocks.push(`### ${heading}`);
      continue;
    }

    if (tag === 'H4' || tag === 'H5' || tag === 'H6') {
      const heading = cleanText(el.childNodes.map(inlineChildrenToMarkdown).join(''));
      if (heading) blocks.push(`#### ${heading}`);
      continue;
    }

    if (tag === 'IMG') {
      const alt = cleanText(el.getAttribute('alt') ?? '');
      if (alt) blocks.push(`*[Illustration: ${alt}]*`);
      continue;
    }

    if (tag === 'P' || tag === 'BLOCKQUOTE') {
      const text = el.childNodes.map(inlineChildrenToMarkdown).join('').replace(/[ \t]+/g, ' ').trim();
      if (text) {
        blocks.push(tag === 'BLOCKQUOTE' ? `> ${text}` : text);
      }
      continue;
    }

    if (hasClass(el, 'card-title') || hasClass(el, 'callout-title')) {
      const title = cleanText(el.childNodes.map(inlineChildrenToMarkdown).join(''));
      if (title) blocks.push(`#### ${title}`);
      continue;
    }

    if (hasClass(el, 'toc-list')) {
      continue;
    }

    // Recurse into layout containers (.grid-2, .card, .callout, .copyable-block, etc.)
    blocks.push(...blockNodesToMarkdown(el));
  }

  flushInline();
  return blocks;
}

export function extractLeadText(leadHtml: string): string {
  if (!leadHtml) return '';
  const root = parse(`<div>${leadHtml}</div>`);
  return cleanText(root.text);
}

export function guideToMarkdown(
  guide: EnrichedGuide,
  preParsed?: ParsedGuide,
): string {
  const parsed = preParsed ?? parseGuide(guide);
  const lines: string[] = [
    `# ${guide.title}`,
    '',
    `> ${guide.subtitle}`,
    '',
    `- **Topic:** [${guide.ecosystemShort}](${SITE_ORIGIN}/topics/${guide.ecosystem})`,
    `- **Web Edition:** ${SITE_ORIGIN}${guide.url}`,
    `- **Printable 12-Page PDF:** ${SITE_ORIGIN}${guide.pdfUrl} (${guide.pdfSizeLabel})`,
    `- **Version:** v${guide.version} (Updated ${guide.updated})`,
    `- **Reading Time:** ${guide.readingMinutes} minutes (${guide.pages} pages)`,
    `- **Authorship:** AI-authored under human editorial direction & print QA (${SITE_ORIGIN}/editorial)`,
  ];

  if (parsed.badges.length > 0) {
    lines.push(`- **Tags:** ${parsed.badges.join(' · ')}`);
  }

  lines.push('');

  if (parsed.pillars.length > 0) {
    lines.push('## Core Takeaways', '');
    for (const pillar of parsed.pillars) {
      lines.push(`- **${cleanText(pillar.title)}:** ${cleanText(pillar.description)}`);
    }
    lines.push('');
  }

  for (const ch of parsed.chapters) {
    lines.push(`## ${ch.number}. ${cleanText(ch.title)}`, '');
    const lead = extractLeadText(ch.leadHtml);
    if (lead) {
      lines.push(lead, '');
    }
    const bodyRoot = parse(`<div>${ch.bodyHtml}</div>`);
    const bodyBlocks = blockNodesToMarkdown(bodyRoot).filter(Boolean);
    for (const block of bodyBlocks) {
      lines.push(block, '');
    }
  }

  lines.push(
    '---',
    '',
    '## Edition Note & Attribution',
    '',
    `This ${guide.pages}-page handbook, its topic structure, and its illustrations were generated with AI under human editorial direction and print-layout QA. Verify commands, pricing tiers, and security settings against official vendor documentation before production use.`,
    '',
    `- AI & Editorial Disclosure: ${SITE_ORIGIN}/editorial`,
    `- Terms & Licensing: ${SITE_ORIGIN}/terms`,
    `- Privacy & Cookie Notice: ${SITE_ORIGIN}/privacy`,
    '',
  );

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
