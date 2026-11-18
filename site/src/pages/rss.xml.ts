import type { APIRoute } from 'astro';
import catalogData from '../generated/catalog-enriched.json';
import { formatIsoDate, SITE_ORIGIN } from '../lib/schema';
import type { EnrichedGuide } from '../types/guide';

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toUTCString();
}

export const GET: APIRoute = () => {
  const guides = catalogData.guides as EnrichedGuide[];

  const latestIso = guides.reduce((latest, g) => {
    const d = formatIsoDate(g.updated);
    return d > latest ? d : latest;
  }, '2026-11-01');

  const sortedGuides = [...guides].sort((a, b) => {
    const da = formatIsoDate(a.updated);
    const db = formatIsoDate(b.updated);
    if (db !== da) return db.localeCompare(da);
    return a.title.localeCompare(b.title);
  });

  const itemsXml = sortedGuides.map((guide) => {
    const pageUrl = `${SITE_ORIGIN}${guide.url}`;
    const pdfUrl = `${SITE_ORIGIN}${guide.pdfUrl}`;
    const mdUrl = `${SITE_ORIGIN}${guide.markdownUrl}`;
    const pubDate = toRfc822(formatIsoDate(guide.updated));
    const description = `${guide.subtitle} (${guide.pages}-page visual handbook, v${guide.version}, ${guide.pdfSizeLabel} PDF). Markdown edition: ${mdUrl}`;

    return [
      '    <item>',
      `      <title>${escapeXml(guide.title)}</title>`,
      `      <link>${escapeXml(pageUrl)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(pageUrl)}</guid>`,
      `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
      `      <category>${escapeXml(guide.ecosystemShort)}</category>`,
      `      <description>${escapeXml(description)}</description>`,
      `      <enclosure url="${escapeXml(pdfUrl)}" length="${guide.pdfSizeBytes}" type="application/pdf" />`,
      '    </item>',
    ].join('\n');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Twelve Pages — Visual 12-Page Handbooks</title>',
    `    <link>${SITE_ORIGIN}/</link>`,
    `    <atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />`,
    '    <description>Clear, visual 12-page AI-authored, human-directed handbooks you can read online or download as printable magazine PDFs.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${escapeXml(toRfc822(latestIso))}</lastBuildDate>`,
    ...itemsXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
