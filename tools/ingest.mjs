/**
 * Ingestion: dataset grezzo -> file dati dell'app.
 *
 *   node tools/ingest.mjs [--src D:/exercises-dataset]
 *
 * Legge exercises.json (sola lettura, il dataset non viene mai toccato) e
 * scrive in public/data:
 *   catalog.json   i 1.324 esercizi in formato compatto, solo italiano
 *   taxonomy.json  i valori dei filtri con etichetta italiana e conteggio
 *   meta.json      provenienza, conteggi, attribuzione media
 *
 * Scelte fatte qui, tutte documentate nella fase 1 dell'analisi:
 * - si usa instruction_steps.it e NON instructions.it: il testo unico ha due
 *   record con frasi rimaste in inglese, gli step sono puliti su tutti e 1.324
 * - si scartano le altre 9 lingue (16 MB -> 900 KB)
 * - si scarta "category", identico a body_part su tutti i record
 * - i muscoli vengono normalizzati (traps/trapezius, lats/latissimus dorsi…)
 * - i 4 nomi con mojibake vengono corretti, i 6 duplicati disambiguati
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MUSCLE_CANON,
  MUSCLE_IT,
  BODY_PART_IT,
  EQUIPMENT_IT,
  NAME_ALIASES,
  NAME_FIXES,
  DUPLICATE_SUFFIX,
} from './dictionary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argSrc = process.argv.indexOf('--src');
const SRC = argSrc > -1 ? process.argv[argSrc + 1] : 'D:/exercises-dataset';
const OUT = path.join(ROOT, 'public', 'data');

const ATTRIBUTION = '© Gym visual — https://gymvisual.com/';

/** Minuscolo, senza accenti, senza punteggiatura: la forma su cui si cerca. */
function normalize(raw) {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Muscolo del dataset -> chiave canonica (i doppioni collassano). */
const canon = (m) => MUSCLE_CANON[m] ?? m;

/** Termini italiani da indicizzare per un nome inglese. */
function italianAliases(name) {
  const n = ` ${normalize(name)} `;
  const found = new Set();
  for (const [en, it] of Object.entries(NAME_ALIASES)) {
    if (n.includes(` ${normalize(en)} `) || n.includes(`${normalize(en)} `) || n.includes(` ${normalize(en)}`)) {
      for (const w of it.split(' ')) found.add(w);
    }
  }
  return [...found];
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'exercises.json'), 'utf8'));
  console.log(`Letti ${raw.length} record da ${SRC}`);

  // I duplicati di nome vanno disambiguati: si marca il secondo per id.
  const byName = new Map();
  for (const x of raw) {
    if (!byName.has(x.name)) byName.set(x.name, []);
    byName.get(x.name).push(x.id);
  }
  const needsSuffix = new Set();
  for (const ids of byName.values()) {
    if (ids.length > 1) ids.sort().slice(1).forEach((id) => needsSuffix.add(id));
  }

  const missingLabel = new Set();
  const catalog = raw.map((x) => {
    let name = x.name;
    for (const [re, to] of NAME_FIXES) name = name.replace(re, to);
    if (needsSuffix.has(x.id)) name += DUPLICATE_SUFFIX;

    const target = canon(x.target);
    const muscle = canon(x.muscle_group);
    const secondary = [...new Set(x.secondary_muscles.map(canon))].filter((m) => m !== target);

    for (const m of [target, muscle, ...secondary]) if (!MUSCLE_IT[m]) missingLabel.add(`muscolo: ${m}`);
    if (!BODY_PART_IT[x.body_part]) missingLabel.add(`body part: ${x.body_part}`);
    if (!EQUIPMENT_IT[x.equipment]) missingLabel.add(`attrezzo: ${x.equipment}`);

    // Blob di ricerca: nome inglese + alias italiani + etichette italiane.
    // Precalcolato qui così il client non deve caricare il dizionario.
    const q = [
      normalize(name),
      ...italianAliases(name),
      normalize(BODY_PART_IT[x.body_part] ?? ''),
      normalize(EQUIPMENT_IT[x.equipment] ?? ''),
      normalize(MUSCLE_IT[target] ?? ''),
      normalize(MUSCLE_IT[muscle] ?? ''),
      ...secondary.map((m) => normalize(MUSCLE_IT[m] ?? '')),
    ]
      .join(' ')
      .split(' ')
      .filter(Boolean);

    return {
      id: x.id,
      name,
      bp: x.body_part,
      eq: x.equipment,
      tg: target,
      mg: muscle,
      sm: secondary,
      st: x.instruction_steps.it,
      q: [...new Set(q)].join(' '),
    };
  });

  if (missingLabel.size) {
    console.error('\nManca la traduzione italiana per:');
    for (const m of missingLabel) console.error('  -', m);
    process.exit(1);
  }

  // Tassonomie: solo i valori realmente presenti, con conteggio, ordinati
  // per frequenza (i filtri utili stanno in cima).
  const facet = (key, labels, pick = (x) => [x[key]]) => {
    const count = new Map();
    for (const x of catalog) for (const v of pick(x)) count.set(v, (count.get(v) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key2, n]) => ({ key: key2, label: labels[key2], count: n }));
  };

  const taxonomy = {
    bodyParts: facet('bp', BODY_PART_IT),
    equipment: facet('eq', EQUIPMENT_IT),
    targets: facet('tg', MUSCLE_IT),
    muscles: facet('mg', MUSCLE_IT, (x) => [...new Set([x.tg, x.mg, ...x.sm])]),
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    count: catalog.length,
    source: 'exercises-dataset (hasaneyldrm) — dati MIT',
    language: 'it',
    mediaAttribution: ATTRIBUTION,
    renamedDuplicates: [...needsSuffix].sort(),
  };

  fs.mkdirSync(OUT, { recursive: true });
  const write = (file, data) => {
    const json = JSON.stringify(data);
    fs.writeFileSync(path.join(OUT, file), json);
    console.log(`  ${file.padEnd(14)} ${(json.length / 1024).toFixed(1).padStart(7)} KB`);
  };
  console.log('\nScritti in public/data:');
  write('catalog.json', catalog);
  write('taxonomy.json', taxonomy);
  write('meta.json', meta);

  console.log(`\n${catalog.length} esercizi · ${taxonomy.bodyParts.length} parti del corpo · ` +
    `${taxonomy.equipment.length} attrezzi · ${taxonomy.muscles.length} muscoli`);
  console.log(`Nomi disambiguati: ${needsSuffix.size} · ${[...needsSuffix].sort().join(', ')}`);
}

main();
