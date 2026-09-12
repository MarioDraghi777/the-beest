/**
 * Conversione media: GIF/JPG del dataset -> WebP per la repo media.
 *
 *   node tools/convert-media.mjs                 tutto (circa 1 minuto)
 *   node tools/convert-media.mjs --only 20       prova rapida su 20 esercizi
 *   node tools/convert-media.mjs --force         riconverte anche ciò che c'è
 *   node tools/convert-media.mjs --out ../altro  cartella di destinazione
 *
 * Perché WebP q=65: misurato sul dataset, 128,7 MB di GIF diventano ~40 MB
 * senza differenze visibili a 180×180. Le miniature passano da 8,9 a ~3,4 MB.
 *
 * ATTENZIONE — i media NON sono MIT. Sono © Gym visual e la repo di origine
 * li ridistribuisce con un permesso concesso al suo autore, non a chi clona.
 * Questa cartella va pubblicata come repo separata proprio per poterla
 * staccare in qualunque momento senza toccare l'app: basta cambiare
 * VITE_MEDIA_BASE. L'attribuzione resta obbligatoria ovunque i media appaiano.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const SRC = arg('--src', 'D:/exercises-dataset');
const OUT = path.resolve(arg('--out', 'media-build'));
const ONLY = Number(arg('--only', 0));
const FORCE = process.argv.includes('--force');

const ANIM_QUALITY = 65;
const THUMB_QUALITY = 72;
const CONCURRENCY = 6;

const ATTRIBUTION = '© Gym visual — https://gymvisual.com/';

async function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'exercises.json'), 'utf8'));
  const list = ONLY ? raw.slice(0, ONLY) : raw;

  fs.mkdirSync(path.join(OUT, 'anim'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true });

  let done = 0;
  let skipped = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  const started = Date.now();

  async function convert(x) {
    const gif = path.join(SRC, path.basename(path.dirname(x.gif_url)), path.basename(x.gif_url));
    const jpg = path.join(SRC, path.basename(path.dirname(x.image)), path.basename(x.image));
    const anim = path.join(OUT, 'anim', `${x.id}.webp`);
    const thumb = path.join(OUT, 'thumbs', `${x.id}.webp`);

    if (!FORCE && fs.existsSync(anim) && fs.existsSync(thumb)) {
      skipped++;
      return;
    }
    bytesIn += fs.statSync(gif).size + fs.statSync(jpg).size;

    await sharp(fs.readFileSync(gif), { animated: true })
      .webp({ quality: ANIM_QUALITY, effort: 4 })
      .toFile(anim);
    await sharp(fs.readFileSync(jpg)).webp({ quality: THUMB_QUALITY, effort: 4 }).toFile(thumb);

    bytesOut += fs.statSync(anim).size + fs.statSync(thumb).size;
    done++;
    if (done % 100 === 0) process.stdout.write(`  ${done} convertiti…\n`);
  }

  // Pool a concorrenza fissa: sharp è già multi-thread, inutile esagerare.
  const queue = [...list];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const x = queue.shift();
        try {
          await convert(x);
        } catch (err) {
          console.error(`  ERRORE su ${x.id}: ${err.message}`);
        }
      }
    })
  );

  // Manifest + note di licenza: la repo media deve spiegarsi da sola.
  const ids = list.map((x) => x.id).sort();
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: ids.length, attribution: ATTRIBUTION, ids })
  );
  fs.writeFileSync(
    path.join(OUT, 'NOTICE.md'),
    `# Media\n\nAnimazioni e miniature degli esercizi: **${ATTRIBUTION}**\n\n` +
      `Convertite in WebP 180×180 a partire da exercises-dataset. La risoluzione originale\n` +
      `(180×180) è mantenuta come richiedono i termini del titolare dei diritti, e\n` +
      `l'attribuzione va conservata ovunque i file vengano mostrati.\n\n` +
      `Termini: https://gymvisual.com/content/3-terms-and-conditions-of-use\n`
  );

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const size = (dir) =>
    fs.readdirSync(path.join(OUT, dir)).reduce((s, f) => s + fs.statSync(path.join(OUT, dir, f)).size, 0);
  console.log(`\nConvertiti ${done}, saltati ${skipped} (già presenti), in ${secs}s`);
  if (bytesIn) console.log(`Compressione: ${(bytesIn / 1e6).toFixed(1)} MB -> ${(bytesOut / 1e6).toFixed(1)} MB`);
  console.log(`Totale cartella: anim ${(size('anim') / 1e6).toFixed(1)} MB · thumbs ${(size('thumbs') / 1e6).toFixed(1)} MB`);
  console.log(`Destinazione: ${OUT}`);
}

run();
