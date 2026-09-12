import { signal } from '@preact/signals';

/**
 * Installazione sulla schermata Home.
 *
 * Non è un vezzo, soprattutto su iPhone: Safari cancella i dati dei siti non
 * aperti da 7 giorni, mentre una PWA installata ne è esente. In più solo in
 * standalone si hanno schermo intero e Wake Lock durante l'allenamento.
 *
 * I due mondi funzionano in modo opposto: Android ed Edge offrono un evento
 * che permette di mostrare un vero bottone "installa"; iOS non lo offre, e
 * l'unica strada è spiegare a parole dove sta il pulsante Condividi.
 */

/** L'app sta girando installata, non dentro il browser. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

/** iPhone o iPad. Gli iPad recenti si dichiarano Mac: li tradisce il touch. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Safari vero, non Chrome o Firefox su iOS (che non possono installare). */
export function isIOSSafari(): boolean {
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Presente solo dove il browser offre l'installazione con un bottone. */
export const canPromptInstall = signal(false);
let deferred: InstallPromptEvent | null = null;

export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Senza preventDefault il browser mostra la sua barra e l'evento si perde.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    canPromptInstall.value = true;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    canPromptInstall.value = false;
  });
}

/** Mostra il dialogo nativo. Torna true se l'utente ha installato. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  canPromptInstall.value = false;
  return outcome === 'accepted';
}

/** Che cosa mostrare a chi non ha ancora installato. */
export type InstallHint = 'gia-installata' | 'bottone' | 'ios-safari' | 'ios-altro-browser' | 'niente';

export function installHint(): InstallHint {
  if (isStandalone()) return 'gia-installata';
  if (canPromptInstall.value) return 'bottone';
  if (isIOSSafari()) return 'ios-safari';
  if (isIOS()) return 'ios-altro-browser';
  return 'niente';
}
