import type { APIRoute } from 'astro';
import { SITE_ORIGIN } from '../../lib/schema';

export const GET: APIRoute = () => {
  const body = [
    'Contact: https://github.com/Cwander83/ai-field-guides/security/advisories',
    'Expires: 2027-11-16T00:00:00Z',
    'Preferred-Languages: en',
    `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
    `Policy: ${SITE_ORIGIN}/terms`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
