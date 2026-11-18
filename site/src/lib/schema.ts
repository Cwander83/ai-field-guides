export const SITE_ORIGIN = 'https://twelve-pages.com';
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function formatIsoDate(updated: string): string {
  const trimmed = String(updated || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return '2026-11-01';
}

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Twelve Pages',
    url: SITE_ORIGIN,
    description:
      'Independent editorial library publishing AI-authored, human-directed 12-page visual handbooks and printable magazine PDFs.',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/icon-512.png`,
      width: 512,
      height: 512,
    },
    sameAs: ['https://github.com/Cwander83/ai-field-guides'],
    publishingPrinciples: `${SITE_ORIGIN}/editorial`,
  };
}

export function buildWebSiteSchema(description: string): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Twelve Pages',
    url: SITE_ORIGIN,
    description,
    inLanguage: 'en-US',
    publisher: {
      '@id': ORGANIZATION_ID,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
