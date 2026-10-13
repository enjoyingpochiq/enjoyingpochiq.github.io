import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import remarkBreaks from 'remark-breaks';
import rehypeCallouts from 'rehype-callouts';

export default defineConfig({
  site: 'https://enjoyingpochiq.github.io',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    // Como en Obsidian: un salto de línea en la nota es un salto de línea en la web
    remarkPlugins: [remarkBreaks],
    // Los callouts de Obsidian (> [!note], > [!warning]…)
    rehypePlugins: [[rehypeCallouts, { theme: 'obsidian' }]],
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
