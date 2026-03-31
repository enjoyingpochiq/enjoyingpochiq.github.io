// src/content.config.ts
import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders'; 

// 1. La colección del Micro-blog (La que ya tenías)
const microblogCollection = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/microblog" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    category: z.string(),
    readTime: z.string(),
  }),
});

// 2. NUEVA: La colección de Writeups de CTFs
const ctfsCollection = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/ctfs" }),
  schema: z.object({
    machine: z.string(),
    platform: z.string(),
    os: z.string(),
    difficulty: z.string(),
    diffColor: z.string(), // Clases de color para la etiqueta (ej. verde, rojo)
    date: z.string(),
    tags: z.array(z.string()), // Array de etiquetas técnicas
  }),
});

// 3. Exportamos ambas
export const collections = {
  'microblog': microblogCollection,
  'ctfs': ctfsCollection,
};