import type { APIRoute } from 'astro';
import catalogData from '../generated/catalog-enriched.json';
import { formatIsoDate, SITE_ORIGIN } from '../lib/schema';
import type { EcosystemCategory, EnrichedGuide } from '../types/guide';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlNode(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = () => {
  const categories = catalogData.categories as EcosystemCategory[];
  const guides = catalogData.guides as EnrichedGuide[];

  const latestByEco = new Map<string, string>();
  const latestMod = guides.reduce((latest, g) => {
    const mod = formatIsoDate(g.updated);
    const curEco = latestByEco.get(g.ecosystem);
    if (!curEco || mod > curEco) latestByEco.set(g.ecosystem, mod);
    return mod > latest ? mod : latest;
  }, '2026-11-01');

  const urls = [
    urlNode(`${SITE_ORIGIN}/`, latestMod, 'weekly', '1.0'),
    urlNode(`${SITE_ORIGIN}/topics`, latestMod, 'weekly', '0.9'),
    ...categories.map((cat) =>
      urlNode(
        `${SITE_ORIGIN}/topics/${cat.id}`,
        latestByEco.get(cat.id) ?? latestMod,
        'weekly',
        '0.9',
      ),
    ),
    ...guides.map((guide) =>
      urlNode(
        `${SITE_ORIGIN}${guide.url}`,
        formatIsoDate(guide.updated),
        'monthly',
        '0.8',
      ),
    ),
    urlNode(`${SITE_ORIGIN}/editorial`, latestMod, 'monthly', '0.5'),
    urlNode(`${SITE_ORIGIN}/privacy`, latestMod, 'monthly', '0.4'),
    urlNode(`${SITE_ORIGIN}/terms`, latestMod, 'monthly', '0.4'),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
