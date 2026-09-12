/**
 * Ricerca e confronto di nomi.
 *
 * Il catalogo è di 1.324 record: non serve nessuna libreria di indicizzazione,
 * un match per token su una stringa precalcolata è istantaneo. La distanza di
 * Levenshtein qui accanto servirà al matching degli import (fase 5), dove i
 * nomi arrivano scritti a mano e con errori di battitura.
 */

/** Minuscolo, senza accenti, senza punteggiatura. Stessa forma usata in ingestion. */
export function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(raw: string): string[] {
  const n = normalize(raw);
  return n ? n.split(' ') : [];
}

/**
 * Vero se il blob di ricerca contiene tutti i token della query, ciascuno
 * come inizio di parola: "pan pia" trova "panca piana", "ben pre" trova
 * "barbell bench press".
 */
export function matchesAll(haystack: string, queryTokens: string[]): boolean {
  for (const t of queryTokens) {
    if (!haystack.startsWith(t) && !haystack.includes(` ${t}`)) return false;
  }
  return true;
}

/** Distanza di Levenshtein fra due stringhe già normalizzate. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarità 0..1 fra due stringhe (1 = identiche). */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}

/**
 * Punteggio di rilevanza.
 *
 * Conta doppio ciò che sta nel nome vero dell'esercizio e semplice ciò che sta
 * solo negli alias italiani: cercando "panca" viene prima "barbell bench press"
 * (che ha "panca" fra gli alias del nome) di un esercizio che la nomina solo
 * di striscio. A parità di punteggio vince il nome più corto, che quasi sempre
 * è l'esercizio base invece della sua variante.
 */
export function relevance(name: string, blob: string, queryTokens: string[]): number {
  const n = normalize(name);
  let score = 0;
  for (const t of queryTokens) {
    score += positionScore(n, t) * 2 + positionScore(blob, t);
  }
  // bonus se la query compare tutta di fila, non sparsa
  const phrase = queryTokens.join(' ');
  if (phrase && (n.includes(phrase) || blob.includes(phrase))) score += 4;
  return score - n.length / 500;
}

function positionScore(haystack: string, token: string): number {
  const at = haystack.indexOf(token);
  if (at < 0) return 0;
  if (at === 0) return 3;
  return haystack[at - 1] === ' ' ? 2 : 1;
}
