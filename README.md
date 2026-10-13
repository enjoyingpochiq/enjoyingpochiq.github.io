# enjoyingpochiq.github.io

Mi web: write-ups de máquinas retiradas, técnicas, investigaciones, apuntes y certificaciones.
Está hecha con Astro y Tailwind, y GitHub la publica sola cada vez que se sube algo a `main`.

**Web:** https://enjoyingpochiq.github.io

## En local

```bash
npm ci          # la primera vez
npm run dev     # la web en http://localhost:4321, se recarga al guardar
npm run build   # lo mismo que hace GitHub antes de publicar
```

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| Nombre, correo, enlaces y herramientas | `src/data/perfil.ts` |
| Certificaciones y módulos terminados | `src/data/certificaciones.ts` |
| Write-ups | `src/content/writeups/` |
| Blog: técnicas, investigaciones, apuntes y certificaciones | `src/content/blog/` |
| Colores y tipografía | `src/styles/global.css` |

## Publicar desde la bóveda de Obsidian

```bash
npm run publicar             # copia lo marcado, te enseña qué cambia y lo sube si dices que sí
npm run publicar -- --ver    # para verlo antes en http://localhost:4321
```

Solo se publican las notas con `publish: true` y un `tipo`. El resto de la bóveda no sale del equipo.
La bóveda se busca en `~/Documentos/eJPT`; si está en otro sitio: `BOVEDA=/ruta npm run publicar`.

Un write-up:

```yaml
---
publish: true
tipo: writeup
plataforma: HackTheBox
so: Linux
dificultad: Fácil        # fácil, media, difícil o insana
cadena: [SMB anónimo, CVE-2007-2447]   # los pasos del ataque; root o SYSTEM se añade solo
fecha: 2026-10-13        # si no la pones, se usa la de la última edición
tags: [SMB, CVE-2007-2447]
resumen: Una frase para las listas (opcional)
---
```

Cualquier otra nota:

```yaml
---
publish: true
tipo: técnica            # técnica, investigación, apuntes o certificación
certificacion: CPTS      # opcional: si es de la preparación de una certificación
fecha: 2026-10-13
tags: [Web, SSRF]
---
```

- El título es el nombre de la nota. Si quieres otro, pon `titulo:` (o `maquina:` en un write-up).
- Las imágenes pegadas en Obsidian (`![[captura.png]]`) se copian solas.
- Los enlaces a notas que no publicas quedan como texto normal, y los comentarios `%%…%%` no salen.
- De la cabecera solo se copian los campos de arriba: cualquier otro dato que tengas ahí no se publica.
- Si quitas `publish: true`, la nota se retira en la siguiente publicación. Pero sigue en el historial de este repositorio, que es público: lo que se publica, mejor darlo por publicado para siempre.
- De HackTheBox, solo máquinas retiradas. Y nada de clientes.

El script apunta lo que publicó en `src/content/.boveda.json` para saber qué retirar después. Lo que escribas a mano en `src/content` no lo toca.
