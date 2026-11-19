import type { APIRoute } from 'astro';
import { SITE_ORIGIN } from '../../lib/schema';

const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

export const GET: APIRoute = () => {
  const expiresAt = new Date(Date.now() + ONE_HUNDRED_EIGHTY_DAYS_MS)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');

  const body = [
    'Contact: https://github.com/Cwander83/ai-field-guides/security/advisories',
    `Expires: ${expiresAt}`,
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
