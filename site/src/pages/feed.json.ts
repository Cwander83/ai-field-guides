import type { APIRoute } from 'astro';
import catalogData from '../generated/catalog-enriched.json';
import { formatIsoDate, SITE_ORIGIN } from '../lib/schema';
import type { EnrichedGuide } from '../types/guide';

export const GET: APIRoute = () => {
  const guides = catalogData.guides as EnrichedGuide[];

  const sortedGuides = [...guides].sort((a, b) => {
    const da = formatIsoDate(a.updated);
    const db = formatIsoDate(b.updated);
    if (db !== da) return db.localeCompare(da);
    return a.title.localeCompare(b.title);
  });

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Twelve Pages — Visual 12-Page Handbooks',
    home_page_url: `${SITE_ORIGIN}/`,
    feed_url: `${SITE_ORIGIN}/feed.json`,
    description:
      'Clear, visual 12-page AI-authored, human-directed handbooks you can read online or save as printable magazine PDFs.',
    language: 'en-US',
    icon: `${SITE_ORIGIN}/icon-512.png`,
    favicon: `${SITE_ORIGIN}/favicon-32x32.png`,
    authors: [
      {
        name: 'Twelve Pages',
        url: `${SITE_ORIGIN}/editorial`,
      },
    ],
    items: sortedGuides.map((guide) => {
      const iso = formatIsoDate(guide.updated);
      return {
        id: `${SITE_ORIGIN}${guide.url}`,
        url: `${SITE_ORIGIN}${guide.url}`,
        title: guide.title,
        summary: guide.subtitle,
        content_text: `${guide.subtitle} Read the web edition at ${SITE_ORIGIN}${guide.url}, Markdown at ${SITE_ORIGIN}${guide.markdownUrl}, or download the ${guide.pages}-page PDF (${guide.pdfSizeLabel}).`,
        image: `${SITE_ORIGIN}${guide.ogImageUrl}`,
        date_published: `${iso}T12:00:00Z`,
        date_modified: `${iso}T12:00:00Z`,
        tags: [guide.ecosystemShort, ...guide.tags],
        attachments: [
          {
            url: `${SITE_ORIGIN}${guide.pdfUrl}`,
            mime_type: 'application/pdf',
            title: `${guide.title} — 12-Page Printable PDF`,
            size_in_bytes: guide.pdfSizeBytes,
          },
          {
            url: `${SITE_ORIGIN}${guide.markdownUrl}`,
            mime_type: 'text/markdown',
            title: `${guide.title} — Clean Markdown Edition`,
          },
        ],
      };
    }),
  };

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
    },
  });
};
