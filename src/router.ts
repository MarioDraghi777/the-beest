import { signal } from '@preact/signals';

/**
 * Rotte derivate dall'hash dell'URL: dà il "indietro" nativo del telefono
 * senza librerie, e rende condivisibile qualunque schermata.
 */

export type PageName = 'oggi' | 'piano' | 'schede' | 'catalogo' | 'progressi' | 'esercizio' | 'scheda' | 'allenamento' | 'condiviso';

export interface Route {
  page: PageName;
  param?: string;
}

const VALID: PageName[] = ['oggi', 'piano', 'schede', 'catalogo', 'progressi', 'esercizio', 'scheda', 'allenamento', 'condiviso'];

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [page, param] = raw.split('/');
  return {
    page: VALID.includes(page as PageName) ? (page as PageName) : 'oggi',
    param: param ? decodeURIComponent(param) : undefined,
  };
}

export const route = signal<Route>(parseHash());

window.addEventListener('hashchange', () => {
  route.value = parseHash();
});

/** Diventa vero appena si naviga dentro l'app: serve a goBack(). */
let navigatedInside = false;

export function navigate(page: PageName, param?: string): void {
  navigatedInside = true;
  location.hash = param ? `/${page}/${encodeURIComponent(param)}` : `/${page}`;
}

/**
 * Indietro. Se si è arrivati qui da un link esterno (una scheda condivisa,
 * un preferito del browser) la cronologia è vuota e history.back() farebbe
 * uscire dall'app: in quel caso si va sulla schermata indicata.
 */
export function goBack(fallback: PageName = 'catalogo'): void {
  if (navigatedInside) history.back();
  else navigate(fallback);
}
