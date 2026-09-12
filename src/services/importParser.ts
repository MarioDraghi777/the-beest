/**
 * Lettura di una scheda scritta da un essere umano.
 *
 * Il testo che arriva da un allenatore, da un foglio o da un PDF non ha un
 * formato: è "Panca piana 4x8 60kg rec 90"" oppure "3 x 10 @ 80" oppure
 * "Trazioni 4xmax". Qui si tira fuori quello che si può e si lascia il resto
 * all'utente, che poi conferma riga per riga. Nessuna riga viene scartata in
 * silenzio: quello che non si capisce arriva comunque nella revisione.
 */

export interface DraftRow {
  /** La riga originale, sempre conservata: è quello che l'utente riconosce. */
  raw: string;
  /** Nome dell'esercizio ripulito dai numeri. */
  name: string;
  sets?: number;
  reps?: string;
  load?: number;
  loadUnit?: 'kg' | 'lb';
  restSec?: number;
  notes?: string;
}

export interface DraftWorkout {
  name: string;
  rows: DraftRow[];
}

const GIORNI = /^(lun|mar|mer|gio|ven|sab|dom)/i;
const TITOLO = /^(giorno|day|scheda|workout|sessione|allenamento|settimana|week)\b/i;

/** Numerazioni e trattini iniziali: "1)", "1.", "-", "•", "a)". */
const PREFISSO = /^\s*(?:[-*•–—]|\d+\s*[).:]|[a-z]\s*[).])\s*/i;

/** "4x8", "4 × 8", "3x10-12", "4xmax", "3x30s", "5 x 5" */
const SERIE_RIP = /(\d{1,2})\s*[x×]\s*(\d{1,3}\s*(?:-\s*\d{1,3})?\s*(?:s|sec|"|secondi)?|max|amrap|cedimento|ced\.?)/i;

/** "60kg", "82,5 kg", "@80", "x 100 lb" */
const CARICO = /(?:@\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(kg|lb|libbre|chili)?\b/gi;

/** "rec 90", "recupero 2'", "rest 90s", "r. 120" */
const RECUPERO = /\b(?:rec(?:upero)?|rest|riposo|r)\b\s*[.:]?\s*(\d{1,3})\s*(['′]|"|s|sec|secondi|min|m)?/i;

/** Note fra parentesi o dopo "//". */
const NOTE = /[([]([^)\]]{2,})[)\]]|\/\/\s*(.+)$/;

function cleanName(text: string): string {
  return text
    .replace(PREFISSO, '')
    .replace(/[-–—:,;]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Una riga che non contiene numeri di serie e sembra un titolo di giornata. */
function isHeader(line: string): boolean {
  const t = line.replace(PREFISSO, '').trim();
  if (!t || t.length > 48) return false;
  if (SERIE_RIP.test(t)) return false;
  if (/\d/.test(t) && !TITOLO.test(t) && !GIORNI.test(t)) return false;
  return TITOLO.test(t) || GIORNI.test(t) || t.endsWith(':');
}

function parseRest(line: string): number | undefined {
  const match = RECUPERO.exec(line);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  // L'apostrofo dopo un numero piccolo significa minuti: "rec 2'" sono 120s.
  if (unit === 'min' || unit === 'm' || ((unit === "'" || unit === '′') && value <= 10)) return value * 60;
  return value;
}

/**
 * Il carico è il numero che resta dopo aver tolto serie, ripetizioni e
 * recupero: cercarlo prima porterebbe a leggere "4x8" come 4 kg.
 */
function parseLoad(line: string, consumed: string[]): { load?: number; unit?: 'kg' | 'lb' } {
  let rest = line;
  for (const piece of consumed) rest = rest.replace(piece, ' ');

  CARICO.lastIndex = 0;
  let best: { load: number; unit?: 'kg' | 'lb' } | null = null;
  let match: RegExpExecArray | null;
  while ((match = CARICO.exec(rest))) {
    const value = Number(match[1].replace(',', '.'));
    const unitRaw = (match[2] ?? '').toLowerCase();
    const unit = unitRaw.startsWith('lb') || unitRaw === 'libbre' ? 'lb' : unitRaw ? 'kg' : undefined;
    if (!Number.isFinite(value) || value <= 0 || value > 999) continue;
    // Con l'unità scritta è certo; senza, si prende comunque il primo numero
    // rimasto, ma l'unità resta indefinita e l'utente la conferma.
    if (unit) return { load: value, unit };
    if (!best) best = { load: value };
  }
  return best ?? {};
}

export function parseLine(raw: string): DraftRow | null {
  const line = raw.trim();
  if (!line) return null;

  const row: DraftRow = { raw: line, name: '' };
  const consumed: string[] = [];

  const noteMatch = NOTE.exec(line);
  if (noteMatch) {
    row.notes = (noteMatch[1] ?? noteMatch[2] ?? '').trim();
    consumed.push(noteMatch[0]);
  }

  const restMatch = RECUPERO.exec(line);
  if (restMatch) {
    row.restSec = parseRest(line);
    consumed.push(restMatch[0]);
  }

  const setsMatch = SERIE_RIP.exec(line);
  if (setsMatch) {
    row.sets = Number(setsMatch[1]);
    row.reps = setsMatch[2].replace(/\s+/g, '').toLowerCase();
    consumed.push(setsMatch[0]);
  }

  const { load, unit } = parseLoad(line, consumed);
  if (load != null) {
    row.load = load;
    row.loadUnit = unit ?? 'kg';
  }

  // Il nome è quello che sta prima dei numeri.
  const cut = setsMatch ? line.indexOf(setsMatch[0]) : restMatch ? line.indexOf(restMatch[0]) : line.length;
  let name = cleanName(line.slice(0, cut));
  if (!name) name = cleanName(line.replace(SERIE_RIP, ' ').replace(RECUPERO, ' '));
  row.name = name;

  return row.name ? row : null;
}

/**
 * Divide il testo in una o più schede. Le righe che sembrano titoli di
 * giornata ("Giorno A", "Lunedì — spinta") aprono una scheda nuova.
 */
export function parseWorkoutText(text: string): DraftWorkout[] {
  const lines = text.split(/\r?\n/);
  const workouts: DraftWorkout[] = [];
  let current: DraftWorkout | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (isHeader(line)) {
      current = { name: cleanName(line).replace(/:$/, ''), rows: [] };
      workouts.push(current);
      continue;
    }

    const row = parseLine(line);
    if (!row) continue;

    if (!current) {
      current = { name: 'Scheda importata', rows: [] };
      workouts.push(current);
    }
    current.rows.push(row);
  }

  return workouts.filter((w) => w.rows.length > 0);
}
