#!/usr/bin/env node
// Publica en la web las notas de tu bóveda de Obsidian marcadas con «publish: true».
//
//   npm run publicar            copia lo marcado, comprueba que la web se construye, te enseña qué
//                               cambia y, si dices que sí, lo sube (GitHub la publica en un par de minutos)
//   npm run publicar -- --ver   copia lo marcado y abre la web en tu equipo para verla antes
//
// Qué tiene que llevar una nota en la cabecera para publicarse (lo explica el README):
//   ---
//   publish: true
//   tipo: writeup          # o técnica, investigación, apuntes, certificación
//   ---
// El resto de la bóveda no sale de tu equipo. De HackTheBox, solo máquinas retiradas, y nunca nada
// de clientes. La bóveda se busca en ~/Documentos/eJPT; si está en otro sitio:
//   BOVEDA=/ruta/a/la/boveda npm run publicar

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { parse, stringify } from 'yaml';
import { slug as anclaDe } from 'github-slugger';

const RAIZ = resolve(import.meta.dirname, '..');
const BOVEDA = resolve(process.env.BOVEDA ?? join(homedir(), 'Documentos', 'eJPT'));
const WEB = 'https://enjoyingpochiq.github.io';
const RAMA = 'main';
const MANIFIESTO = 'src/content/.boveda.json';
const CARPETA = { writeups: 'src/content/writeups', blog: 'src/content/blog' };
const PUBLICOS = 'public/adjuntos';
const RUTAS = ['src/content', PUBLICOS];
const IMAGENES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
const TIPOS = ['writeup', 'tecnica', 'investigacion', 'apuntes', 'certificacion'];
const DIFICULTADES = { facil: 'facil', easy: 'facil', media: 'media', medium: 'media', dificil: 'dificil', hard: 'dificil', insana: 'insana', insane: 'insana' };

const tty = process.stdout.isTTY;
const color = (c, t) => (tty ? `\x1b[${c}m${t}\x1b[0m` : t);
const info = (t) => console.log(`${color('1;32', '[+]')} ${t}`);
const aviso = (t) => console.log(`${color('1;33', '[!]')} ${t}`);
const fallo = (t) => {
  console.error(`${color('1;31', '[x]')} ${t}`);
  process.exit(1);
};
const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
const plano = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const slugDe = (s) => plano(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nota';
const posix = (ruta) => ruta.split(sep).join('/');

const modo = process.argv.includes('--ver') ? 'ver' : 'publicar';
if (!existsSync(BOVEDA)) fallo(`No encuentro la bóveda en ${BOVEDA}. Si está en otro sitio: BOVEDA=/ruta npm run publicar`);

// ── 0 · Antes de tocar nada ──────────────────────────────────────────────────

const leerManifiesto = (texto) => {
  try {
    return JSON.parse(texto).ficheros ?? [];
  } catch {
    return [];
  }
};
const enHead = (ruta) => {
  try {
    return execFileSync('git', ['show', `HEAD:${ruta}`], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};
// Lo que este script publicó la otra vez (lo subido y lo que dejara a medias un --ver)
const anteriores = new Set([
  ...leerManifiesto(enHead(MANIFIESTO) ?? '{}'),
  ...leerManifiesto(existsSync(join(RAIZ, MANIFIESTO)) ? readFileSync(join(RAIZ, MANIFIESTO), 'utf8') : '{}'),
]);

if (modo === 'publicar') {
  const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (rama !== RAMA) fallo(`Estás en la rama «${rama}» y la web se publica desde «${RAMA}»:  git switch ${RAMA}`);
  // Cambios tuyos a mano en las carpetas que toca este script: mejor no mezclarlos
  const estado = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', ...RUTAS], { cwd: RAIZ, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const ajenos = [];
  for (let i = 0; i < estado.length; i++) {
    const ruta = estado[i].slice(3);
    if (estado[i][0] === 'R' || estado[i][0] === 'C') i++; // en un renombrado, la siguiente entrada es el origen
    if (ruta !== MANIFIESTO && !anteriores.has(ruta)) ajenos.push(ruta);
  }
  if (ajenos.length) {
    fallo(`Tienes cambios sin subir que no son de la bóveda:\n${ajenos.map((r) => `    ${r}`).join('\n')}\n    Haz commit o descártalos antes de publicar.`);
  }
  const traer = spawnSync('git', ['pull', '--ff-only', '-q'], { cwd: RAIZ, stdio: 'inherit' });
  if (traer.status !== 0) fallo('No he podido traer lo último de GitHub (git pull). Arréglalo y vuelve a lanzarlo.');
}

// ── 1 · Lo que hay en la bóveda (sin carpetas ni ficheros ocultos: .obsidian, .git, .trash…) ──

function recorrer(dir, salida = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const ruta = join(dir, e.name);
    if (e.isDirectory()) recorrer(ruta, salida);
    else if (e.isFile()) salida.push(ruta);
  }
  return salida;
}

function cabecera(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { datos: {}, cuerpo: texto };
  try {
    const datos = parse(m[1]);
    return { datos: datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {}, cuerpo: texto.slice(m[0].length) };
  } catch {
    return { error: true, datos: {}, cuerpo: texto };
  }
}

const ficheros = recorrer(BOVEDA).sort();
const notasPorNombre = new Map(); // «lame» → [rutas]
const adjuntosPorNombre = new Map(); // «captura.png» → ruta (la primera, como Obsidian con nombres repetidos)
for (const f of ficheros) {
  if (f.endsWith('.md')) {
    const n = basename(f, '.md').toLowerCase();
    notasPorNombre.set(n, [...(notasPorNombre.get(n) ?? []), f]);
  } else if (!adjuntosPorNombre.has(basename(f).toLowerCase())) {
    adjuntosPorNombre.set(basename(f).toLowerCase(), f);
  }
}

const problemas = [];
const publicadas = [];
for (const ruta of ficheros.filter((f) => f.endsWith('.md'))) {
  const rel = posix(relative(BOVEDA, ruta));
  const texto = readFileSync(ruta, 'utf8');
  const { datos, cuerpo, error } = cabecera(texto);
  if (error) {
    if (/^publish:\s*["']?true/m.test(texto.slice(0, 3000))) problemas.push(`${rel}: la cabecera tiene un error y no la entiendo`);
    continue;
  }
  if (datos.publish !== true && datos.publish !== 'true') continue;

  const nombre = basename(ruta, '.md');
  const tipo = plano(datos.tipo).replace(/[-\s]/g, '');
  if (!TIPOS.includes(tipo)) {
    problemas.push(`${rel}: le falta «tipo» o no lo entiendo (writeup, técnica, investigación, apuntes o certificación)`);
    continue;
  }
  const coleccion = tipo === 'writeup' ? 'writeups' : 'blog';

  let fecha = datos.fecha ?? datos.date ?? datos.created;
  if (fecha instanceof Date) fecha = fecha.toISOString().slice(0, 10);
  if (typeof fecha === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha.trim())) {
    const [d, m, a] = fecha.trim().split('/');
    fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (fecha === undefined || fecha === null || fecha === '') fecha = statSync(ruta).mtime.toISOString().slice(0, 10);
  if (Number.isNaN(new Date(String(fecha)).valueOf())) {
    problemas.push(`${rel}: no entiendo la fecha «${fecha}» (ponla como 2026-10-13)`);
    continue;
  }

  let tags = datos.tags ?? datos.etiquetas ?? [];
  if (typeof tags === 'string') tags = tags.split(',');
  tags = [].concat(tags).map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean);

  const comunes = {
    fecha: String(fecha),
    tags,
    ...(datos.resumen ?? datos.summary ? { resumen: String(datos.resumen ?? datos.summary) } : {}),
    ...(datos.borrador === true ? { borrador: true } : {}),
  };
  let campos;
  if (coleccion === 'writeups') {
    const plataforma = datos.plataforma ?? datos.platform;
    const so = datos.so ?? datos.os;
    const dificultad = DIFICULTADES[plano(datos.dificultad ?? datos.difficulty)];
    const faltan = [!plataforma && 'plataforma', !so && 'so', !dificultad && 'dificultad'].filter(Boolean);
    if (faltan.length) {
      problemas.push(`${rel}: a este write-up le falta ${faltan.map((f) => `«${f}»`).join(', ')} (dificultad: fácil, media, difícil o insana)`);
      continue;
    }
    campos = { maquina: String(datos.maquina ?? datos.machine ?? nombre), plataforma: String(plataforma), so: String(so), dificultad, ...comunes };
  } else {
    const cert = datos.certificacion ?? datos.cert;
    campos = { titulo: String(datos.titulo ?? datos.title ?? nombre), tipo, ...(cert ? { certificacion: String(cert) } : {}), ...comunes };
  }

  const slug = slugDe(datos.slug ?? nombre);
  publicadas.push({
    ruta,
    rel,
    coleccion,
    slug,
    campos,
    cuerpo,
    titulo: campos.maquina ?? campos.titulo,
    url: `/${coleccion}/${slug}/`,
    destino: `${CARPETA[coleccion]}/${slug}.md`,
    avisos: [],
  });
}

// Dos notas no pueden acabar en la misma dirección, ni pisar algo que escribiste a mano en la web
const porDestino = new Map();
const descartadas = new Set();
for (const n of publicadas) porDestino.set(n.destino, [...(porDestino.get(n.destino) ?? []), n]);
for (const [destino, lista] of porDestino) {
  if (lista.length > 1) {
    problemas.push(`${lista.map((n) => n.rel).join(' y ')} acabarían en la misma dirección (${destino}); cambia el nombre de una`);
    for (const n of lista) descartadas.add(n);
  } else if (existsSync(join(RAIZ, destino)) && !anteriores.has(destino)) {
    problemas.push(`${lista[0].rel}: ya existe ${destino} y no lo publicó este script; cambia el nombre de la nota o borra el antiguo`);
    descartadas.add(lista[0]);
  }
}
for (let i = publicadas.length - 1; i >= 0; i--) if (descartadas.has(publicadas[i])) publicadas.splice(i, 1);
if (problemas.length) {
  aviso('Estas notas tienen «publish: true» pero no las puedo publicar:');
  for (const p of problemas) console.log(`    ${p}`);
}
const publicadaPorRuta = new Map(publicadas.map((n) => [n.ruta, n]));

// ── 2 · Pasar cada nota de Obsidian a Markdown normal ────────────────────────

const dentro = (r) => r.startsWith(BOVEDA + sep) && !relative(BOVEDA, r).split(sep).some((p) => p.startsWith('.'));
const decodificar = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function resolverNota(destino, desde) {
  const limpio = destino.replace(/\.md$/i, '');
  for (const c of [join(BOVEDA, `${limpio}.md`), join(dirname(desde), `${limpio}.md`)]) {
    const r = resolve(c);
    if (dentro(r) && existsSync(r)) return r;
  }
  return notasPorNombre.get(basename(limpio).toLowerCase())?.[0];
}

function resolverAdjunto(destino, desde) {
  for (const c of [join(BOVEDA, destino), join(dirname(desde), destino)]) {
    const r = resolve(c);
    if (dentro(r) && !r.endsWith('.md') && existsSync(r) && statSync(r).isFile()) return r;
  }
  const r = adjuntosPorNombre.get(basename(destino).toLowerCase());
  return r && dentro(r) ? r : undefined;
}

const escritos = new Map(); // ruta en la web → contenido (string) o fichero de origen
function nombreSeguro(origen, nota) {
  nota.nombres ??= new Map();
  const ext = extname(origen).toLowerCase();
  let nombre = `${slugDe(basename(origen, extname(origen)))}${ext}`;
  for (let i = 2; nota.nombres.has(nombre) && nota.nombres.get(nombre) !== origen; i++) {
    nombre = `${slugDe(basename(origen, extname(origen)))}-${i}${ext}`;
  }
  nota.nombres.set(nombre, origen);
  return nombre;
}

// Las imágenes que se ven en la nota van junto a ella (la web las optimiza); lo demás (PDF…), a public/
function enlazarAdjunto(origen, nota, { incrustar, texto }) {
  const nombre = nombreSeguro(origen, nota);
  if (incrustar && IMAGENES.has(extname(origen).toLowerCase())) {
    escritos.set(`${CARPETA[nota.coleccion]}/${nota.slug}/${nombre}`, { origen });
    return `![${texto.replace(/[[\]]/g, '')}](./${nota.slug}/${nombre})`;
  }
  escritos.set(`${PUBLICOS}/${nota.slug}/${nombre}`, { origen });
  return `[${texto}](/adjuntos/${nota.slug}/${nombre})`;
}

const NO_PUBLICADAS = new Map(); // nombre de la nota → notas que la enlazan

function aNota(destino, texto, nota, ancla) {
  const r = resolverNota(destino, nota.ruta);
  const pub = r && publicadaPorRuta.get(r);
  if (pub) return `[${texto}](${pub.url}${ancla ? `#${anclaDe(ancla)}` : ''})`;
  if (r) {
    const nombre = basename(r, '.md');
    NO_PUBLICADAS.set(nombre, [...new Set([...(NO_PUBLICADAS.get(nombre) ?? []), nota.titulo])]);
  }
  return texto;
}

function wikienlace(contenido, nota, incrustar) {
  const [destinoBruto, ...resto] = contenido.split(/\\?\|/);
  const alias = resto.join('|').trim();
  const [archivoBruto, ...partes] = destinoBruto.split('#');
  const archivo = archivoBruto.trim();
  const ancla = partes.join('#').trim();
  const ext = extname(archivo).toLowerCase();

  if (ext && ext !== '.md') {
    const origen = resolverAdjunto(archivo, nota.ruta);
    if (!origen) {
      nota.avisos.push(`no encuentro «${archivo}» en la bóveda`);
      return incrustar ? '' : alias || archivo;
    }
    const tamano = /^\d+(x\d+)?$/.test(alias); // ![[captura.png|400]]: es un tamaño, no un texto
    return enlazarAdjunto(origen, nota, { incrustar, texto: alias && !tamano ? alias : basename(archivo, extname(archivo)) });
  }
  if (!archivo) {
    // [[#Sección]]: un enlace dentro de la propia nota
    if (incrustar || ancla.startsWith('^')) return '';
    return `[${alias || ancla}](#${anclaDe(ancla)})`;
  }
  const texto = alias || basename(archivo).replace(/\.md$/i, '');
  if (incrustar) {
    // ![[Otra nota]]: en la web no se incrusta; queda un enlace si esa nota también se publica
    const enlace = aNota(archivo, texto, nota, ancla && !ancla.startsWith('^') ? ancla : '');
    if (enlace === texto) {
      nota.avisos.push(`incrusta «${texto}», que no se publica: en la web no saldrá`);
      return '';
    }
    return enlace;
  }
  return aNota(archivo, texto, nota, ancla && !ancla.startsWith('^') ? ancla : '');
}

function enlaceMarkdown(texto, url, nota, incrustar, original) {
  let destino = url.trim().replace(/\s+"[^"]*"$/, '').replace(/^<(.*)>$/, '$1');
  if (/^[a-z][a-z0-9+.-]*:/i.test(destino) || destino.startsWith('/') || destino.startsWith('#')) return original;
  destino = decodificar(destino);
  const [archivo, ancla = ''] = destino.split('#');
  const ext = extname(archivo).toLowerCase();
  if (ext && ext !== '.md') {
    const origen = resolverAdjunto(archivo, nota.ruta);
    if (!origen) {
      nota.avisos.push(`no encuentro «${archivo}» en la bóveda`);
      return incrustar ? '' : texto;
    }
    return enlazarAdjunto(origen, nota, { incrustar, texto: texto || basename(archivo, ext) });
  }
  return aNota(archivo, texto, nota, ancla);
}

const ENLACES = /!\[\[([^\]\n]+)\]\]|\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(([^)\n]+)\)|\[([^\]\n]+)\]\(([^)\n]+)\)|==([^=\n]+)==/g;
const transformar = (texto, nota) =>
  texto.replace(ENLACES, (m, inc, wiki, alt, img, txt, url, marca) => {
    if (inc !== undefined) return wikienlace(inc, nota, true);
    if (wiki !== undefined) return wikienlace(wiki, nota, false);
    if (img !== undefined) return enlaceMarkdown(alt, img, nota, true, m);
    if (url !== undefined) return enlaceMarkdown(txt, url, nota, false, m);
    return `<mark>${marca}</mark>`;
  });

// Trozos de una línea: lo que va entre comillas invertidas (código) no se toca
function trozos(linea) {
  const res = [];
  let i = 0;
  while (i < linea.length) {
    const j = linea.indexOf('`', i);
    if (j === -1) {
      res.push({ codigo: false, texto: linea.slice(i) });
      break;
    }
    if (j > i) res.push({ codigo: false, texto: linea.slice(i, j) });
    let n = 0;
    while (linea[j + n] === '`') n++;
    const cierre = linea.indexOf('`'.repeat(n), j + n);
    if (cierre === -1) {
      res.push({ codigo: false, texto: linea.slice(j) });
      break;
    }
    res.push({ codigo: true, texto: linea.slice(j, cierre + n) });
    i = cierre + n;
  }
  return res;
}

function convertir(nota) {
  const salida = [];
  let valla = null; // ``` o ~~~ de un bloque de código abierto
  let comentario = false; // dentro de %% … %%: no sale en la web
  for (const linea of nota.cuerpo.split(/\r?\n/)) {
    if (valla) {
      if (!comentario) salida.push(linea);
      const t = linea.trim();
      if (/^(`{3,}|~{3,})$/.test(t) && t[0] === valla[0] && t.length >= valla.length) valla = null;
      continue;
    }
    const apertura = !comentario && linea.match(/^\s*(`{3,}|~{3,})/);
    if (apertura) {
      valla = apertura[1];
      salida.push(linea);
      continue;
    }
    let nueva = '';
    for (const t of trozos(linea)) {
      if (t.codigo) {
        if (!comentario) nueva += t.texto;
        continue;
      }
      let resto = t.texto;
      let visible = '';
      while (resto) {
        const p = resto.indexOf('%%');
        if (comentario) {
          if (p === -1) resto = '';
          else {
            resto = resto.slice(p + 2);
            comentario = false;
          }
        } else if (p === -1) {
          visible += resto;
          resto = '';
        } else {
          visible += resto.slice(0, p);
          resto = resto.slice(p + 2);
          comentario = true;
        }
      }
      nueva += transformar(visible, nota);
    }
    // Las referencias de bloque de Obsidian (^abc123) al final de una línea, fuera
    salida.push(nueva.replace(/\s\^[A-Za-z0-9-]+\s*$/, ''));
  }
  return salida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

for (const nota of publicadas) {
  const cuerpo = convertir(nota);
  escritos.set(nota.destino, { contenido: `---\n${stringify(nota.campos, { lineWidth: 0 }).trim()}\n---\n\n${cuerpo}\n` });
}

// ── 3 · Escribir en la web y retirar lo que ya no está marcado ───────────────

const nuevos = new Set(escritos.keys());
for (const [ruta, { contenido, origen }] of escritos) {
  const absoluta = join(RAIZ, ruta);
  mkdirSync(dirname(absoluta), { recursive: true });
  if (contenido !== undefined) {
    if (!existsSync(absoluta) || readFileSync(absoluta, 'utf8') !== contenido) writeFileSync(absoluta, contenido);
  } else {
    copyFileSync(origen, absoluta);
  }
}
const retirados = [...anteriores].filter((r) => !nuevos.has(r));
for (const r of retirados) rmSync(join(RAIZ, r), { force: true });
function podarVacias(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) podarVacias(join(dir, e.name));
  if (readdirSync(dir).length === 0 && ![...Object.values(CARPETA)].map((c) => join(RAIZ, c)).includes(dir)) rmSync(dir, { recursive: true });
}
for (const c of [...Object.values(CARPETA), PUBLICOS]) podarVacias(join(RAIZ, c));
writeFileSync(
  join(RAIZ, MANIFIESTO),
  `${JSON.stringify({ aviso: 'Lo mantiene scripts/publicar.mjs: no lo edites a mano', ficheros: [...nuevos].sort() }, null, 2)}\n`,
);

const nWriteups = publicadas.filter((n) => n.coleccion === 'writeups').length;
info(`${publicadas.length} notas marcadas (${nWriteups} write-ups y ${publicadas.length - nWriteups} del blog).`);
for (const n of publicadas) for (const a of n.avisos) aviso(`${n.rel}: ${a}`);
if (NO_PUBLICADAS.size) {
  info('Enlazan a notas que no publicas; en la web esos enlaces quedan como texto normal:');
  for (const [nombre] of [...NO_PUBLICADAS].sort().slice(0, 12)) console.log(`      ${nombre}`);
  if (NO_PUBLICADAS.size > 12) console.log(`      … y ${NO_PUBLICADAS.size - 12} más`);
}

if (modo === 'ver') {
  info('Abro la web en tu equipo: http://localhost:4321 (Ctrl+C para salir). Si te gusta:  npm run publicar');
  spawnSync('npx', ['astro', 'dev'], { cwd: RAIZ, stdio: 'inherit' });
  process.exit(0);
}

// ── 4 · Repasar, construir, preguntar y subir ────────────────────────────────

const tocados = [...new Set([...anteriores, ...nuevos, MANIFIESTO])];
function restaurar() {
  const existentes = RUTAS.filter((r) => existsSync(join(RAIZ, r)));
  if (existentes.length) git('reset', '-q', '--', ...existentes);
  const enHeadAhora = new Set(git('ls-tree', '-r', '--name-only', 'HEAD', '--', ...RUTAS).split('\n').filter(Boolean));
  for (const f of tocados) {
    if (enHeadAhora.has(f)) git('checkout', 'HEAD', '--', f);
    else rmSync(join(RAIZ, f), { force: true });
  }
  for (const c of [...Object.values(CARPETA), PUBLICOS]) podarVacias(join(RAIZ, c));
}

function subir() {
  const r = spawnSync('git', ['push', '-q', 'origin', RAMA], { cwd: RAIZ, stdio: 'inherit' });
  if (r.status !== 0) fallo('No he podido subirlo (el error de git está justo encima). Cuando lo arregles, vuelve a lanzarlo y se sube lo pendiente.');
  info(`Subido. En un par de minutos estará en ${WEB} (si tarda o falla, mira la pestaña Actions del repositorio en GitHub).`);
}

git('add', '-A', '--', ...RUTAS.filter((r) => existsSync(join(RAIZ, r))));
const cambios = git('-c', 'core.quotePath=false', 'diff', '--cached', '--name-status', '--', ...RUTAS)
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'));
if (cambios.length === 0) {
  let pendientes = '0';
  try {
    pendientes = git('rev-list', '--count', '@{u}..HEAD');
  } catch {}
  if (pendientes !== '0') {
    info('Nada nuevo, pero hay una publicación anterior que no llegó a GitHub. La subo ahora.');
    subir();
  } else info('Nada nuevo que publicar: la web ya está al día.');
  process.exit(0);
}

console.log();
info('Cambios respecto a lo publicado (+ nueva, ~ cambiada, - se retira, > movida):');
const cuenta = { A: 0, M: 0, D: 0, R: 0 };
for (const [estado, a, b] of cambios) {
  const ruta = b ?? a;
  if (ruta === MANIFIESTO) continue;
  const tipo = estado[0];
  if (!ruta.endsWith('.md')) {
    cuenta[tipo] = (cuenta[tipo] ?? 0) + 1;
    continue;
  }
  const signo = { A: '+', D: '-', R: '>' }[tipo] ?? '~';
  const nota = publicadas.find((n) => n.destino === ruta);
  console.log(`  ${signo} ${ruta.replace(/^src\/content\//, '')}${nota ? `  (${nota.rel})` : ''}`);
}
const resumenAdj = [
  cuenta.A && `${cuenta.A} nuevos`,
  cuenta.M && `${cuenta.M} cambiados`,
  cuenta.D && `${cuenta.D} retirados`,
  cuenta.R && `${cuenta.R} movidos`,
].filter(Boolean);
if (resumenAdj.length) console.log(`  y adjuntos (imágenes, PDF…): ${resumenAdj.join(', ')}`);

// Lo que no debería salir nunca a Internet. Solo mira lo nuevo o cambiado, para no repetirte lo que ya aceptaste.
const SOSPECHOSO = [
  /\bey\.(com|net)\b/i,
  /\bernst ?(&|and|y) ?young\b/i,
  /\bconfiden(cial|tial)\b/i,
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/,
  /\.ts\.net\b/i,
  /\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/,
];
const CARPETAS_SOSPECHOSAS = /(^|\/)(clientes?|clients?|ey|trabajo|work|proyectos?)(\/|$)/i;
const revisar = [];
for (const [estado, a, b] of cambios) {
  const ruta = b ?? a;
  if (estado[0] === 'D' || !ruta.endsWith('.md') || ruta === MANIFIESTO) continue;
  const nota = publicadas.find((n) => n.destino === ruta);
  if (nota && CARPETAS_SOSPECHOSAS.test(nota.rel)) revisar.push(`carpeta: ${nota.rel}`);
  readFileSync(join(RAIZ, ruta), 'utf8')
    .split('\n')
    .forEach((l, i) => {
      if (SOSPECHOSO.some((re) => re.test(l))) revisar.push(`${ruta.replace(/^src\/content\//, '')}:${i + 1}: ${l.trim().slice(0, 120)}`);
    });
}
if (revisar.length) {
  console.log();
  aviso('OJO, revisa esto antes de decir que sí (parece de EY o de un cliente, un secreto o de tu red de casa):');
  for (const l of revisar.slice(0, 20)) console.log(`    ${l}`);
}
if (cuenta.A || cuenta.M) aviso('Las capturas no las puedo revisar yo: míralas tú antes de decir que sí.');

console.log();
info('Compruebo que la web se construye con estos cambios…');
const build = spawnSync('npx', ['astro', 'build'], { cwd: RAIZ, encoding: 'utf8' });
if (build.status !== 0) {
  console.log(`${build.stdout}\n${build.stderr}`.trim().split('\n').slice(-25).join('\n'));
  restaurar();
  fallo('La web no se construye con estos cambios (el error está justo encima). No he subido nada.');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const respuesta = await rl.question(`\n¿Lo publico en ${WEB}? [s/N] `).catch(() => '');
rl.close();
if (!/^s/i.test(respuesta.trim())) {
  restaurar();
  info('No he publicado nada; la web se queda como estaba.');
  process.exit(0);
}
const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 16);
git('commit', '-q', '-m', `Publicar desde la bóveda (${hoy})`);
subir();
