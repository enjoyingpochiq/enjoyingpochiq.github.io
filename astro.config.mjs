import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkBreaks from 'remark-breaks';

export default defineConfig({
  site: 'https://enjoyingpochiq.github.io', 
  vite: {
    plugins: [tailwindcss()]
  },
  markdown: {
    remarkPlugins: [remarkBreaks],
  }
});