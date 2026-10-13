// Una imagen para compartir por página: /og/inicio.png, /og/writeups/forest.png, /og/blog/footprinting.png…
import type { APIRoute, GetStaticPaths } from 'astro';
import { tarjeta, type DatosTarjeta } from '../../lib/tarjeta';
import { writeups, posts, cadena, DIFICULTADES, TIPOS } from '../../lib/contenido';
import { certificaciones } from '../../data/certificaciones';
import { perfil } from '../../data/perfil';
import { mismaCert } from '../../lib/contenido';

const COLORES_DIFICULTAD = { facil: '#6ee7b7', media: '#fcd34d', dificil: '#fda4af', insana: '#c4b5fd' };

export const getStaticPaths = (async () => {
  const rutas: { params: { ruta: string }; props: DatosTarjeta }[] = [
    {
      params: { ruta: 'inicio' },
      props: {
        antetitulo: perfil.puesto,
        titulo: perfil.nombre,
        subtitulo: 'Write-ups de máquinas retiradas, técnicas, investigaciones y apuntes de certificaciones.',
      },
    },
    {
      params: { ruta: 'writeups' },
      props: { antetitulo: perfil.nombre, titulo: 'Write-ups', subtitulo: 'Máquinas retiradas, de la enumeración a root.' },
    },
    {
      params: { ruta: 'blog' },
      props: { antetitulo: perfil.nombre, titulo: 'Blog', subtitulo: 'Técnicas, investigaciones, apuntes y certificaciones.' },
    },
  ];
  for (const w of await writeups()) {
    rutas.push({
      params: { ruta: `writeups/${w.id}` },
      props: {
        antetitulo: `Write-up de ${w.data.plataforma}`,
        titulo: w.data.maquina,
        etiquetas: [
          { texto: w.data.so },
          { texto: DIFICULTADES[w.data.dificultad].nombre, color: COLORES_DIFICULTAD[w.data.dificultad] },
        ],
        cadena: cadena(w),
      },
    });
  }
  for (const p of await posts()) {
    const cert = certificaciones.find((c) => mismaCert(c.id, p.data.certificacion) || mismaCert(c.nombre, p.data.certificacion));
    const certNombre = cert?.nombre ?? p.data.certificacion;
    rutas.push({
      params: { ruta: `blog/${p.id}` },
      props: {
        antetitulo: certNombre ? `${TIPOS[p.data.tipo].una} para la ${certNombre}` : TIPOS[p.data.tipo].una,
        titulo: p.data.titulo,
        etiquetas: p.data.tags.slice(0, 3).map((t) => ({ texto: t })),
      },
    });
  }
  return rutas;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(await tarjeta(props as DatosTarjeta), { headers: { 'Content-Type': 'image/png' } });
