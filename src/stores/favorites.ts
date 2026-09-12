import { signal } from '@preact/signals';
import { db } from '../db/schema';

/**
 * Preferiti: gli esercizi che usi davvero, che sono sempre gli stessi venti
 * su milletrecento. Stanno in IndexedDB come singola riga di impostazioni,
 * non serve una tabella.
 */

const KEY = 'favorites';

export const favorites = signal<string[]>([]);
export const favoritesLoaded = signal(false);

export async function loadFavorites(): Promise<void> {
  const row = await db.settings.get(KEY);
  favorites.value = Array.isArray(row?.value) ? (row.value as string[]) : [];
  favoritesLoaded.value = true;
}

export function isFavorite(id: string): boolean {
  return favorites.value.includes(id);
}

export async function toggleFavorite(id: string): Promise<void> {
  const next = isFavorite(id) ? favorites.value.filter((x) => x !== id) : [...favorites.value, id];
  favorites.value = next;
  await db.settings.put({ key: KEY, value: next });
}
