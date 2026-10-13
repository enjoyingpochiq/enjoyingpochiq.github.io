// La imagen que sale al compartir un enlace (LinkedIn, Telegram, WhatsApp…): 1200 × 630.
// Se genera al construir la web, una por página, con satori (de HTML a SVG) y resvg (de SVG a PNG).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export interface DatosTarjeta {
  antetitulo: string; // «Write-up de HackTheBox», «Apuntes para la CPTS»…
  titulo: string;
  subtitulo?: string;
  etiquetas?: { texto: string; color?: string }[];
  cadena?: string[];
}

const COLOR = {
  fondo: '#141518',
  superficie: '#1b1d21',
  linea: '#2b2e34',
  texto: '#ecebe8',
  tenue: '#a6a6ad',
  carmesi: '#e11d48',
  carmesiClaro: '#fb7185',
};

const carpeta = join(process.cwd(), 'node_modules/@fontsource/atkinson-hyperlegible-next/files');
const fuentes = ([400, 700, 800] as const).map((weight) => ({
  name: 'Atkinson',
  data: readFileSync(join(carpeta, `atkinson-hyperlegible-next-latin-${weight}-normal.woff`)),
  weight,
  style: 'normal' as const,
}));

type Nodo = { type: string; props: Record<string, unknown> } | string;
const h = (type: string, style: Record<string, unknown>, ...children: (Nodo | Nodo[] | false | undefined)[]): Nodo => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== false && c !== undefined) },
});

// Flecha entre pasos de la cadena, dibujada (la fuente no trae «→» en su juego latino)
const flecha = (): Nodo => ({
  type: 'svg',
  props: {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    children: [
      { type: 'path', props: { d: 'M5 12h13M13 6l6 6-6 6', fill: 'none', stroke: COLOR.tenue, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } },
    ],
  },
});

export async function tarjeta(d: DatosTarjeta): Promise<Uint8Array> {
  const largo = d.titulo.length;
  const tamTitulo = largo <= 14 ? 112 : largo <= 30 ? 80 : largo <= 55 ? 62 : 50;
  const cadena = d.cadena ?? [];

  const arbol = h(
    'div',
    {
      // satori suma el relleno al tamaño (content-box): 1200 − 88 − 72 y 630 − 64 − 56
      width: 1040,
      height: 510,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px 56px 88px',
      backgroundColor: COLOR.fondo,
      backgroundImage: `radial-gradient(circle at 100% 0%, rgba(225, 29, 72, 0.22), rgba(20, 21, 24, 0) 55%)`,
      fontFamily: 'Atkinson',
      color: COLOR.texto,
      position: 'relative',
    },
    // La franja carmesí de la izquierda
    h('div', { position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, backgroundColor: COLOR.carmesi }),
    h(
      'div',
      { flexDirection: 'column', gap: 18 },
      h('div', { fontSize: 30, color: COLOR.tenue }, d.antetitulo),
      h('div', { fontSize: tamTitulo, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: '#ffffff', maxWidth: 1000 }, d.titulo),
      d.subtitulo ? h('div', { fontSize: 32, color: COLOR.tenue, lineHeight: 1.35, maxWidth: 980, marginTop: 6 }, d.subtitulo) : false,
      d.etiquetas?.length
        ? h(
            'div',
            { gap: 14, marginTop: 10 },
            d.etiquetas.map((e) =>
              h('div', { fontSize: 28, fontWeight: 700, color: e.color ?? COLOR.texto, border: `2px solid ${e.color ?? COLOR.linea}`, borderRadius: 10, padding: '4px 16px' }, e.texto),
            ),
          )
        : false,
    ),
    cadena.length
      ? h(
          'div',
          { flexWrap: 'wrap', alignItems: 'center', gap: 12, maxWidth: 1040 },
          cadena.flatMap((paso, i) => {
            const final = i === cadena.length - 1;
            const pastilla = h(
              'div',
              {
                fontSize: 26,
                fontWeight: final ? 700 : 400,
                color: final ? COLOR.carmesiClaro : COLOR.texto,
                backgroundColor: final ? 'rgba(225, 29, 72, 0.16)' : COLOR.superficie,
                border: `2px solid ${final ? 'rgba(251, 113, 133, 0.5)' : COLOR.linea}`,
                borderRadius: 10,
                padding: '6px 14px',
              },
              paso,
            );
            return final ? [pastilla] : [pastilla, flecha()];
          }),
        )
      : false,
    h(
      'div',
      { justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 26, color: COLOR.tenue },
      h('div', { color: COLOR.texto, fontWeight: 700 }, 'Alejandro Juan Hervás Vogt'),
      h('div', {}, 'enjoyingpochiq.github.io'),
    ),
  );

  const svg = await satori(arbol as never, { width: 1200, height: 630, fonts: fuentes });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
