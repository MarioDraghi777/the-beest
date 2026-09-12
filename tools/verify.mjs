/**
 * Verifica dei dati prodotti dalla ingestion.
 *
 *   node tools/verify.mjs
 *
 * Fallisce con exit code 1 al primo problema: è pensato per girare in CI
 * prima del build, così un dataset rotto non arriva mai online.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public', 'data');
const MEDIA = path.resolve(process.argv.includes('--media') ? 'media-build' : '');

const problems = [];
const ok = [];
const check = (label, condition, detail = '') => {
  (condition ? ok : problems).push(condition ? label : `${label}${detail ? ` — ${detail}` : ''}`);
};

const catalog = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(path.join(DATA, 'taxonomy.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'));

check('1.324 esercizi nel catalogo', catalog.length === 1324, `trovati ${catalog.length}`);
check('meta.count coerente', meta.count === catalog.length);

const ids = catalog.map((x) => x.id);
check('id tutti univoci', new Set(ids).size === ids.length);
check('id nel formato 0000', ids.every((id) => /^\d{4}$/.test(id)));

check('nomi tutti valorizzati', catalog.every((x) => x.name && x.name.trim().length > 1));
const names = catalog.map((x) => x.name);
check('nomi tutti distinti', new Set(names).size === names.length,
  `duplicati: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
check('nessun mojibake residuo', !catalog.some((x) => /[а-яА-Я]|Ã|â€/.test(x.name)));

check('istruzioni presenti su tutti', catalog.every((x) => Array.isArray(x.st) && x.st.length >= 3));
check('nessuno step vuoto', !catalog.some((x) => x.st.some((s) => !s.trim())));
const english = /\b(the|your|with|shoulder-width|repeat)\b/i;
check('istruzioni tutte in italiano', !catalog.some((x) => x.st.some((s) => english.test(s))));

check('blob di ricerca su tutti', catalog.every((x) => x.q && x.q.length > 5));
const withItalian = catalog.filter((x) => /\b(bilanciere|manubri|cavi|corpo|panca|squat|trazioni|curl)\b/.test(x.q));
check('ricerca italiana significativa', withItalian.length > 600, `solo ${withItalian.length} esercizi con alias italiani`);

const taxKeys = {
  bp: new Set(taxonomy.bodyParts.map((t) => t.key)),
  eq: new Set(taxonomy.equipment.map((t) => t.key)),
  muscles: new Set(taxonomy.muscles.map((t) => t.key)),
};
check('tassonomie con etichetta italiana',
  [...taxonomy.bodyParts, ...taxonomy.equipment, ...taxonomy.targets, ...taxonomy.muscles].every((t) => t.label));
check('ogni body part è nella tassonomia', catalog.every((x) => taxKeys.bp.has(x.bp)));
check('ogni attrezzo è nella tassonomia', catalog.every((x) => taxKeys.eq.has(x.eq)));
check('ogni muscolo è nella tassonomia', catalog.every((x) => [x.tg, x.mg, ...x.sm].every((m) => taxKeys.muscles.has(m))));
check('conteggi delle faccette coerenti',
  taxonomy.bodyParts.reduce((s, t) => s + t.count, 0) === catalog.length);

if (fs.existsSync(path.join(MEDIA, 'manifest.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(MEDIA, 'manifest.json'), 'utf8'));
  const anim = new Set(fs.readdirSync(path.join(MEDIA, 'anim')));
  const thumbs = new Set(fs.readdirSync(path.join(MEDIA, 'thumbs')));
  const missing = ids.filter((id) => !anim.has(`${id}.webp`) || !thumbs.has(`${id}.webp`));
  check(`media presenti per tutti i ${ids.length} esercizi`, missing.length === 0,
    `mancano ${missing.length}: ${missing.slice(0, 5).join(', ')}`);
  check('manifest allineato al catalogo', manifest.count === ids.length);
} else {
  ok.push('media non ancora convertiti (salto il controllo)');
}

console.log(`\n${ok.length} controlli superati:`);
for (const o of ok) console.log('  ok   ', o);
if (problems.length) {
  console.error(`\n${problems.length} PROBLEMI:`);
  for (const p of problems) console.error('  FAIL ', p);
  process.exit(1);
}
console.log(`\nCatalogo valido: ${catalog.length} esercizi, generato il ${meta.generatedAt.slice(0, 10)}.`);
