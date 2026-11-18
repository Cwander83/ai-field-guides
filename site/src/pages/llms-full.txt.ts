import type { APIRoute } from 'astro';
import catalogData from '../generated/catalog-enriched.json';
import { extractLeadText } from '../lib/guideToMarkdown';
import { parseGuide } from '../lib/parseGuide';
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
    '# Twelve Pages — Full Handbook Corpus Index',
    '',
    `> Complete structured index of all ${guides.length} visual 12-page handbooks (${catalogData.stats.totalPages} illustrated pages across ${categories.length} ecosystems) published at ${SITE_ORIGIN}.`,
    '',
    'All handbooks, topics, diagrams, and illustrations are AI-authored under human editorial direction and print QA. Always verify critical commands, security policies, and vendor pricing against official documentation.',
    '',
    `- Concise Directory: ${SITE_ORIGIN}/llms.txt`,
    `- AI & Editorial Disclosure: ${SITE_ORIGIN}/editorial`,
    `- Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    `- RSS Feed: ${SITE_ORIGIN}/rss.xml`,
    `- JSON Feed: ${SITE_ORIGIN}/feed.json`,
    '',
  ];

  for (const cat of categories) {
    const catGuides = byCategory.get(cat.id) ?? [];
    if (catGuides.length === 0) continue;

    lines.push(`## ${cat.title} (${catGuides.length} Handbooks)`);
    lines.push('');
    lines.push(`Topic Hub: ${SITE_ORIGIN}/topics/${cat.id}`);
    if (cat.description) {
      lines.push('');
      lines.push(cat.description);
    }
    lines.push('');

    for (const guide of catGuides) {
      const parsed = parseGuide(guide);
      lines.push(`### ${guide.title}`);
      lines.push('');
      lines.push(`> ${guide.subtitle}`);
      lines.push('');
      lines.push(`- Web: ${SITE_ORIGIN}${guide.url}`);
      lines.push(`- Markdown: ${SITE_ORIGIN}${guide.markdownUrl}`);
      lines.push(`- PDF: ${SITE_ORIGIN}${guide.pdfUrl} (${guide.pdfSizeLabel})`);
      lines.push(`- Version: v${guide.version} | Updated: ${guide.updated} | Pages: ${guide.pages}`);
      if (parsed.badges.length > 0) {
        lines.push(`- Tags: ${parsed.badges.join(', ')}`);
      }

      if (parsed.pillars.length > 0) {
        lines.push('- Core Takeaways:');
        for (const p of parsed.pillars) {
          lines.push(`  - ${p.title}: ${p.description}`);
        }
      }

      lines.push('- Chapters:');
      for (const ch of parsed.chapters) {
        const lead = extractLeadText(ch.leadHtml);
        lines.push(lead ? `  ${ch.number}. ${ch.title} — ${lead}` : `  ${ch.number}. ${ch.title}`);
      }
      lines.push('');
    }
  }

  return new Response(`${lines.join('\n').trim()}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
