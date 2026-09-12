import { signal } from '@preact/signals';
import type { CatalogMeta, Exercise, Taxonomy } from '../types';
import { matchesAll, relevance, tokenize } from './search';

/**
 * Il catalogo statico: 1.324 esercizi, circa 980 KB di JSON (120 in gzip).
 * Si carica una volta sola all'avvio e resta in memoria — nessun motivo di
 * metterlo in IndexedDB, e il service worker lo tiene offline dal primo giro.
 */

export const exercises = signal<Exercise[]>([]);
export const taxonomy = signal<Taxonomy | null>(null);
export const meta = signal<CatalogMeta | null>(null);
export const catalogState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
export const catalogError = signal<string>('');

const byId = new Map<string, Exercise>();

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

/** Etichetta italiana di una chiave di tassonomia; se manca, torna la chiave. */
export function label(kind: keyof Taxonomy, key: string): string {
  const list = taxonomy.value?.[kind];
  return list?.find((t) => t.key === key)?.label ?? key;
}

/** Etichetta di un muscolo, cercata fra i muscoli e poi fra i target. */
export function muscleLabel(key: string): string {
  const t = taxonomy.value;
  return t?.muscles.find((m) => m.key === key)?.label ?? t?.targets.find((m) => m.key === key)?.label ?? key;
}

export async function loadCatalog(): Promise<void> {
  if (catalogState.value === 'loading' || catalogState.value === 'ready') return;
  catalogState.value = 'loading';
  try {
    const base = import.meta.env.BASE_URL;
    const [cat, tax, met] = await Promise.all([
      fetch(`${base}data/catalog.json`).then((r) => r.json() as Promise<Exercise[]>),
      fetch(`${base}data/taxonomy.json`).then((r) => r.json() as Promise<Taxonomy>),
      fetch(`${base}data/meta.json`).then((r) => r.json() as Promise<CatalogMeta>),
    ]);
    byId.clear();
    for (const e of cat) byId.set(e.id, e);
    exercises.value = cat;
    taxonomy.value = tax;
    meta.value = met;
    catalogState.value = 'ready';
  } catch (err) {
    catalogError.value = err instanceof Error ? err.message : String(err);
    catalogState.value = 'error';
  }
}

export interface CatalogFilters {
  query: string;
  bodyPart?: string;
  equipment?: string;
  muscle?: string;
}

/** Filtra e ordina il catalogo. Su 1.324 record costa meno di un millisecondo. */
export function filterExercises(all: Exercise[], f: CatalogFilters): Exercise[] {
  const tokens = tokenize(f.query);
  const out: Exercise[] = [];

  for (const e of all) {
    if (f.bodyPart && e.bp !== f.bodyPart) continue;
    if (f.equipment && e.eq !== f.equipment) continue;
    if (f.muscle && e.tg !== f.muscle && e.mg !== f.muscle && !e.sm.includes(f.muscle)) continue;
    if (tokens.length && !matchesAll(e.q, tokens)) continue;
    out.push(e);
  }

  if (tokens.length) {
    out.sort((a, b) => relevance(b.name, b.q, tokens) - relevance(a.name, a.q, tokens));
  } else {
    out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

/**
 * URL dei media. Stanno su un dominio separato, configurabile: i file sono
 * © Gym visual e l'app deve poter funzionare anche senza, mostrando i
 * segnaposto. Se VITE_MEDIA_BASE è vuota, qui torna null e la UI si adatta.
 */
const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE ?? '').replace(/\/$/, '');

export function thumbUrl(id: string): string | null {
  return MEDIA_BASE ? `${MEDIA_BASE}/thumbs/${id}.webp` : null;
}

export function animUrl(id: string): string | null {
  return MEDIA_BASE ? `${MEDIA_BASE}/anim/${id}.webp` : null;
}

export const MEDIA_ATTRIBUTION = '© Gym visual — gymvisual.com';
