// Qué campos lleva cada publicación. Los write-ups y las notas que publicas desde la bóveda
// (npm run publicar) llegan ya con estos campos; si escribes una a mano aquí, usa los mismos.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// «Fácil», «facil» y «FÁCIL» valen lo mismo; también los nombres en inglés de HackTheBox
const normalizar = (valor: unknown) => {
  if (typeof valor !== 'string') return valor;
  const v = valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const ingles: Record<string, string> = { easy: 'facil', medium: 'media', hard: 'dificil', insane: 'insana' };
  return ingles[v] ?? v;
};

const comunes = {
  fecha: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  // Una o dos frases para las listas; si no hay, se usa el primer párrafo
  resumen: z.string().optional(),
  // Los borradores solo se ven con «npm run dev», nunca en la web publicada
  borrador: z.boolean().default(false),
};

const writeups = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/writeups' }),
  schema: z.object({
    maquina: z.string(),
    plataforma: z.string(),
    so: z.string(),
    dificultad: z.preprocess(normalizar, z.enum(['facil', 'media', 'dificil', 'insana'])),
    ...comunes,
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    tipo: z.preprocess(normalizar, z.enum(['tecnica', 'investigacion', 'apuntes', 'certificacion'])),
    // Si la nota es de la preparación de una certificación: CPTS, CRTP…
    certificacion: z.string().optional(),
    ...comunes,
  }),
});

export const collections = { writeups, blog };
