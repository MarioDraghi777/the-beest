import { signal } from '@preact/signals';

/**
 * Stato della schermata Catalogo, tenuto fuori dal componente apposta.
 *
 * Cerchi "panca", apri un esercizio, torni indietro: la ricerca e i filtri
 * devono essere ancora lì, e la lista deve ripartire dal punto in cui eri.
 * Con lo stato dentro useState si perderebbe tutto a ogni cambio di rotta.
 */

export const query = signal('');
export const bodyPart = signal<string | undefined>(undefined);
export const equipment = signal<string | undefined>(undefined);
export const onlyFavorites = signal(false);

/** Ultima posizione di scroll del catalogo, ripristinata al ritorno. */
export const scrollY = signal(0);

export function clearFilters(): void {
  query.value = '';
  bodyPart.value = undefined;
  equipment.value = undefined;
  onlyFavorites.value = false;
}

export function hasFilters(): boolean {
  return Boolean(query.value || bodyPart.value || equipment.value || onlyFavorites.value);
}
