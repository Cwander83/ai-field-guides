import type { APIRoute } from 'astro';
import catalogData from '../generated/catalog-enriched.json';
import { SITE_ORIGIN } from '../lib/schema';
import type { EcosystemCategory, EnrichedGuide } from '../types/guide';

export const GET: APIRoute = () => {
  const categories = catalogData.categories as EcosystemCategory[];
  const guides = catalogData.guides as EnrichedGuide[];

  const byCategory = new Map<string, EnrichedGuide[]>();
  for (const cat of categories) {
    byCategory.set(cat.id, []);
  }
  for (const guide of guides) {
    const list = byCategory.get(guide.ecosystem) ?? [];
    list.push(guide);
    byCategory.set(guide.ecosystem, list);
  }

  const lines: string[] = [
    '# Twelve Pages',
    '',
    `> Clear, visual 12-page handbooks across ${categories.length} ecosystems (${guides.length} handbooks, ${catalogData.stats.totalPages} illustrated pages) — read online at ${SITE_ORIGIN}, fetch clean Markdown with \`Accept: text/markdown\` or \`.md\`, or download printable PDFs.`,
    '',
    'All handbooks, topics, diagrams, and illustrations on Twelve Pages are AI-authored under human editorial direction and 12-page print QA.',
    '',
    '## Discovery & Machine-Readable Endpoints',
    '',
    `- [Home Bookshelf](${SITE_ORIGIN}/): Search and filter all ${guides.length} handbooks`,
    `- [Topics Directory](${SITE_ORIGIN}/topics): Browse all ${categories.length} ecosystem topic hubs`,
    `- [Full LLM Corpus Index](${SITE_ORIGIN}/llms-full.txt): Complete takeaways and 11-chapter outlines for every handbook`,
    `- [XML Sitemap](${SITE_ORIGIN}/sitemap.xml): Canonical URL index`,
    `- [RSS 2.0 Feed](${SITE_ORIGIN}/rss.xml): XML feed with PDF enclosures`,
    `- [JSON Feed 1.1](${SITE_ORIGIN}/feed.json): Structured feed for readers and agents`,
    `- [AI & Editorial Disclosure](${SITE_ORIGIN}/editorial): Authorship, layout QA, and verification guidelines`,
    `- [Terms & Licensing](${SITE_ORIGIN}/terms): Reader license and educational disclaimer`,
    `- [Privacy & Cookie Notice](${SITE_ORIGIN}/privacy): Consent Mode v2 and cookie disclosures`,
    '',
    '> **Tip for Agents:** Any handbook URL accepts `Accept: text/markdown` or a `.md` suffix (for example, `https://twelve-pages.com/guides/claude/claude-meetings.md`) to return clean Markdown with navigation chrome removed.',
    '',
  ];

  for (const cat of categories) {
    const catGuides = byCategory.get(cat.id) ?? [];
    if (catGuides.length === 0) continue;
    lines.push(`## ${cat.title}`);
    lines.push('');
    lines.push(`- Topic Hub: ${SITE_ORIGIN}/topics/${cat.id}`);
    if (cat.description) {
      lines.push(`- Overview: ${cat.description}`);
    }
    lines.push('');
    for (const guide of catGuides) {
      lines.push(
        `- [${guide.title}](${SITE_ORIGIN}${guide.url}) ([Markdown](${SITE_ORIGIN}${guide.markdownUrl}) | [PDF](${SITE_ORIGIN}${guide.pdfUrl})): ${guide.subtitle}`,
      );
    }
    lines.push('');
  }

  return new Response(`${lines.join('\n').trim()}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
