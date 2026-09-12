/**
 * CSV in lettura e scrittura, senza librerie.
 *
 * Il caso che conta è "esportato da Excel": campi fra virgolette, virgolette
 * raddoppiate dentro i campi, separatore che in Italia è quasi sempre il
 * punto e virgola perché la virgola fa già il decimale.
 */

/** Indovina il separatore contando cosa compare di più nella prima riga. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => ({ d, n: first.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ';';
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const clean = text.replace(/^﻿/, ''); // BOM di Excel

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];

    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export function toCsv(header: string[], rows: (string | number | undefined)[][], delimiter = ';'): string {
  const escape = (value: string | number | undefined): string => {
    const text = value == null ? '' : String(value);
    return /["\n\r;,\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((r) => r.map(escape).join(delimiter)).join('\r\n');
}

/* ------------------------------------------------- riconoscimento colonne */

const COLONNE: Record<string, RegExp> = {
  name: /^(esercizio|nome|exercise|movimento)/i,
  sets: /^(serie|sets?|s)$/i,
  reps: /^(rip(etizioni)?|reps?|ripetizion)/i,
  load: /^(carico|peso|kg|load|weight)/i,
  rest: /^(rec(upero)?|rest|riposo|pausa)/i,
  notes: /^(note|commento|notes?)/i,
};

export type ColumnMap = Partial<Record<keyof typeof COLONNE, number>>;

/** Associa le intestazioni alle colonne che ci servono. */
export function mapColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  header.forEach((cell, index) => {
    const clean = cell.trim();
    for (const [key, re] of Object.entries(COLONNE)) {
      if (map[key as keyof ColumnMap] == null && re.test(clean)) map[key as keyof ColumnMap] = index;
    }
  });
  return map;
}

/** Vero se la prima riga sembra un'intestazione e non già un esercizio. */
export function looksLikeHeader(row: string[]): boolean {
  const map = mapColumns(row);
  return map.name != null || Object.keys(map).length >= 2;
}
