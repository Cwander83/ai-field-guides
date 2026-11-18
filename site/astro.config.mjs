import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://twelve-pages.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
});
