import type { Exercise } from '../types';
import { levenshtein, normalize, similarity, tokenize } from './search';

/**
 * Riconoscimento dei nomi importati dentro il catalogo.
 *
 * I nomi arrivano scritti a mano, in italiano, con abbreviazioni e refusi
 * ("lat machne", "panca pian"), mentre il catalogo è in inglese.
 *
 * Funziona su tre livelli, dal più certo al più incerto:
 *  1. traduzione canonica — "panca piana" È quella col bilanciere, e lo dice
 *     una tabella scritta a mano, non un punteggio;
 *  2. nome inglese identico;
 *  3. punteggio su token interi, con tolleranza ai refusi.
 *
 * Le soglie sono tarate per sbagliare dalla parte giusta: meglio una conferma
 * in più che un esercizio sbagliato infilato in scheda di nascosto.
 */

/** Sopra questa confidenza si accetta da solo. */
export const AUTO = 0.82;
/** Sotto questa non si propone nemmeno: diventa un esercizio tuo. */
export const MIN = 0.45;
/** Distacco minimo dal secondo candidato per non chiedere conferma. */
const DISTACCO = 0.1;

/** Parole che non aiutano a distinguere niente. */
const VUOTE = new Set(['con', 'di', 'da', 'a', 'al', 'alla', 'il', 'la', 'lo', 'i', 'le', 'per', 'su', 'in', 'e']);

export interface Candidate {
  exercise: Exercise;
  score: number;
}

export type MatchKind = 'automatico' | 'incerto' | 'nessuno';

export interface MatchResult {
  kind: MatchKind;
  candidates: Candidate[];
}

const tokenCache = new WeakMap<Exercise, string[]>();

function exerciseTokens(exercise: Exercise): string[] {
  let tokens = tokenCache.get(exercise);
  if (!tokens) {
    tokens = exercise.q.split(' ').filter(Boolean);
    tokenCache.set(exercise, tokens);
  }
  return tokens;
}

function queryTokens(query: string): string[] {
  const tokens = tokenize(query).filter((t) => !VUOTE.has(t));
  return tokens.length ? tokens : tokenize(query);
}

/** Un token conta se c'è tale e quale, o se ci va vicino (un refuso). */
function tokenHit(token: string, tokens: string[]): number {
  if (tokens.includes(token)) return 1;
  if (token.length < 4) return 0;
  let best = 0;
  for (const t of tokens) {
    if (Math.abs(t.length - token.length) > 2) continue;
    const distance = levenshtein(token, t);
    if (distance > 2) continue;
    best = Math.max(best, 1 - distance / Math.max(token.length, t.length));
  }
  return best >= 0.75 ? best : 0;
}

/**
 * Punteggio 0..1 fra un nome scritto a mano e un esercizio del catalogo:
 * il meglio fra la somiglianza col nome inglese e la copertura dei token,
 * con una penalità per i nomi pieni di parole in più rispetto a quanto
 * chiesto — "curl" deve preferire "dumbbell biceps curl" a "dumbbell seated
 * revers grip concentration curl".
 */
export function scoreExercise(query: string, exercise: Exercise): number {
  const tokens = queryTokens(query);
  if (!tokens.length) return 0;

  const direct = similarity(query, exercise.name);

  const catalogTokens = exerciseTokens(exercise);
  const coverage = tokens.reduce((sum, t) => sum + tokenHit(t, catalogTokens), 0) / tokens.length;

  const nameWords = normalize(exercise.name).split(' ').length;
  const extra = Math.max(0, nameWords - tokens.length);
  const brevity = 1 - Math.min(0.25, extra * 0.04);

  return Math.max(direct, coverage * brevity);
}

/**
 * Il dizionario delle traduzioni canoniche, generato dalla ingestion.
 * Va passato da fuori perché il matcher resti una funzione pura e testabile.
 */
export type Canonical = Record<string, string>;

function fuzzyCanonical(clean: string, canonical: Canonical): string | undefined {
  if (clean.length < 5) return undefined;
  let best: { id: string; score: number } | undefined;
  for (const [term, id] of Object.entries(canonical)) {
    if (Math.abs(term.length - clean.length) > 2) continue;
    const score = similarity(clean, term);
    if (score >= 0.85 && (!best || score > best.score)) best = { id, score };
  }
  return best?.id;
}

export function matchExercise(
  query: string,
  catalog: Exercise[],
  canonical: Canonical = {},
  limit = 3
): MatchResult {
  const clean = normalize(query);
  if (clean.length < 2) return { kind: 'nessuno', candidates: [] };

  // 1. traduzione canonica: qui non si tira a indovinare.
  // Il confronto tollera un refuso, perché i termini più usati sono anche
  // quelli che si scrivono di fretta ("trazionii", "panca pian").
  const canonicalId = canonical[clean] ?? fuzzyCanonical(clean, canonical);
  if (canonicalId) {
    const exercise = catalog.find((e) => e.id === canonicalId);
    if (exercise) return { kind: 'automatico', candidates: [{ exercise, score: 1 }] };
  }

  // 2. nome inglese identico
  const exact = catalog.find((e) => normalize(e.name) === clean);
  if (exact) return { kind: 'automatico', candidates: [{ exercise: exact, score: 1 }] };

  // 3. punteggio
  const scored = catalog
    .map((exercise) => ({ exercise, score: scoreExercise(clean, exercise) }))
    .filter((c) => c.score >= MIN)
    .sort((a, b) => b.score - a.score || a.exercise.name.length - b.exercise.name.length)
    .slice(0, limit);

  if (scored.length === 0) return { kind: 'nessuno', candidates: [] };

  // Automatico solo se il primo stacca il secondo: fra due esercizi quasi
  // uguali deve decidere una persona.
  const stacca = scored.length === 1 || scored[0].score - scored[1].score > DISTACCO;
  return { kind: scored[0].score >= AUTO && stacca ? 'automatico' : 'incerto', candidates: scored };
}
