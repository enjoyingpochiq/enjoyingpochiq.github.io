// Lo que comparten todas las páginas para listar y mostrar publicaciones.
import { getCollection, type CollectionEntry } from 'astro:content';
import { certificaciones } from '../data/certificaciones';

export type Writeup = CollectionEntry<'writeups'>;
export type Post = CollectionEntry<'blog'>;
export type TipoPost = Post['data']['tipo'];

export const TIPOS: Record<TipoPost, { una: string; varias: string }> = {
  tecnica: { una: 'Técnica', varias: 'Técnicas' },
  investigacion: { una: 'Investigación', varias: 'Investigaciones' },
  apuntes: { una: 'Apuntes', varias: 'Apuntes' },
  certificacion: { una: 'Certificación', varias: 'Certificaciones' },
};

export const DIFICULTADES: Record<Writeup['data']['dificultad'], { nombre: string; clase: string }> = {
  facil: { nombre: 'Fácil', clase: 'text-emerald-300 border-emerald-300/30' },
  media: { nombre: 'Media', clase: 'text-amber-300 border-amber-300/30' },
  dificil: { nombre: 'Difícil', clase: 'text-rose-300 border-rose-300/40' },
  insana: { nombre: 'Insana', clase: 'text-violet-300 border-violet-300/40' },
};

// Los borradores se ven al trabajar en local (npm run dev), nunca en la web publicada
const visible = ({ data }: { data: { borrador: boolean } }) => !import.meta.env.PROD || !data.borrador;
const masReciente = (a: { data: { fecha: Date } }, b: { data: { fecha: Date } }) =>
  b.data.fecha.valueOf() - a.data.fecha.valueOf();

export async function writeups() {
  return (await getCollection('writeups', visible)).sort(masReciente);
}

export async function posts() {
  return (await getCollection('blog', visible)).sort(masReciente);
}

const formatoFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fecha = (d: Date) => formatoFecha.format(d).replace('.', '');

// Unas 200 palabras por minuto; el código cuenta, que también se lee
export function minutos(texto = '') {
  return Math.max(1, Math.round(texto.split(/\s+/).filter(Boolean).length / 200));
}

// El resumen de la nota o, si no tiene, su primer párrafo de texto
export function extracto(entrada: Writeup | Post, max = 180) {
  if (entrada.data.resumen) return entrada.data.resumen;
  const cuerpo = (entrada.body ?? '').replace(/```[\s\S]*?```/g, '');
  const parrafo =
    cuerpo
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !/^(#|>|\||!\[|<|-{3,}|[-*+] |\d+\. )/.test(p)) ?? '';
  const limpio = parrafo
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpio.length <= max) return limpio;
  return limpio.slice(0, limpio.lastIndexOf(' ', max)) + '…';
}

export const urlWriteup = (w: Writeup) => `/writeups/${w.id}/`;
export const urlPost = (p: Post) => `/blog/${p.id}/`;

// Todo lo publicado junto, de lo más nuevo a lo más antiguo: es «Lo último» de la portada y el RSS
export interface Publicacion {
  titulo: string;
  url: string;
  fecha: Date;
  tipo: string;
  resumen: string;
  detalle?: string;
}

export async function registro(): Promise<Publicacion[]> {
  const deWriteups = (await writeups()).map((w) => ({
    titulo: w.data.maquina,
    url: urlWriteup(w),
    fecha: w.data.fecha,
    tipo: 'Write-up',
    resumen: extracto(w),
    detalle: `${w.data.plataforma}, ${DIFICULTADES[w.data.dificultad].nombre.toLowerCase()}`,
  }));
  const dePosts = (await posts()).map((p) => ({
    titulo: p.data.titulo,
    url: urlPost(p),
    fecha: p.data.fecha,
    tipo: TIPOS[p.data.tipo].una,
    resumen: extracto(p),
    detalle: p.data.certificacion,
  }));
  return [...deWriteups, ...dePosts].sort((a, b) => b.fecha.valueOf() - a.fecha.valueOf());
}

// La certificación que estás preparando, con su avance
export function enCurso() {
  const c = certificaciones.find((c) => c.estado === 'en-curso');
  if (!c) return undefined;
  const total = c.modulos?.length ?? 0;
  const hechos = c.modulos?.filter((m) => m.hecho).length ?? 0;
  return { ...c, total, hechos, porcentaje: total ? Math.round((hechos / total) * 100) : 0 };
}

export const mismaCert = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '');
