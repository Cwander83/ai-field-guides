import type { APIRoute } from 'astro';
import { SITE_ORIGIN } from '../lib/schema';

export const GET: APIRoute = () => {
  const allowedAgents = [
    '*',
    'Googlebot',
    'Bingbot',
    'Applebot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'GPTBot',
    'Claude-SearchBot',
    'Claude-User',
    'ClaudeBot',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
  ];

  const disallowedAgents = ['Bytespider', 'CCBot'];

  const blocks = [
    ...allowedAgents.map((ua) => `User-agent: ${ua}\nAllow: /`),
    ...disallowedAgents.map((ua) => `User-agent: ${ua}\nDisallow: /`),
  ];
  const body = [
    ...blocks,
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    `# LLMs: ${SITE_ORIGIN}/llms.txt`,
    `# LLMs Full: ${SITE_ORIGIN}/llms-full.txt`,
    `# RSS: ${SITE_ORIGIN}/rss.xml`,
    `# JSON Feed: ${SITE_ORIGIN}/feed.json`,
    '',
  ].join('\n\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
