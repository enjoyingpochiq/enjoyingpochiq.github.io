// Fuente RSS con todo lo publicado: write-ups y blog
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { registro } from '../lib/contenido';
import { perfil } from '../data/perfil';

export async function GET(context: APIContext) {
  const publicaciones = await registro();
  return rss({
    title: `${perfil.nombreCorto}: write-ups y blog`,
    description: perfil.descripcion,
    site: context.site!,
    items: publicaciones.map((p) => ({
      title: p.titulo,
      link: p.url,
      pubDate: p.fecha,
      description: p.resumen,
      categories: [p.tipo],
    })),
    customData: '<language>es-es</language>',
  });
}
