import type { APIRoute } from 'astro';
import catalogData from '../../../generated/catalog-enriched.json';
import { guideToMarkdown } from '../../../lib/guideToMarkdown';
import type { EnrichedGuide } from '../../../types/guide';

export function getStaticPaths() {
  const guides = catalogData.guides as EnrichedGuide[];
  return guides.map((guide) => ({
    params: {
      ecosystem: guide.ecosystem,
      slug: guide.slug,
    },
    props: {
      guide,
    },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { guide } = props as { guide: EnrichedGuide };
  const markdown = guideToMarkdown(guide);
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
