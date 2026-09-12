/**
 * Schermo acceso e avviso sonoro durante l'allenamento.
 *
 * Due limiti di iOS che decidono come è fatto questo file:
 * - il Wake Lock funziona solo su HTTPS o in locale, e va riacquisito ogni
 *   volta che si torna sulla scheda: iOS lo rilascia appena si esce;
 * - il web non può far vibrare il telefono, quindi l'avviso di fine recupero
 *   è un suono, e l'audio va sbloccato da un tocco dell'utente — per questo
 *   `unlockAudio()` viene chiamata dal tap su "Inizia allenamento" e non dopo.
 */

let lock: WakeLockSentinel | null = null;
let audio: AudioContext | null = null;

export async function keepScreenAwake(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    // Batteria bassa o permesso negato: l'allenamento funziona lo stesso.
  }
}

export function releaseScreen(): void {
  void lock?.release();
  lock = null;
}

/** iOS rilascia il lock quando si esce dall'app: qui lo si riprende. */
export function watchVisibility(active: () => boolean): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && active() && !lock) void keepScreenAwake();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}

/** Da chiamare dentro un gesto dell'utente, altrimenti iOS non dà audio. */
export function unlockAudio(): void {
  if (audio) {
    void audio.resume();
    return;
  }
  try {
    audio = new AudioContext();
    // Un campione muto: è il modo standard di "aprire" l'audio su iOS.
    const buffer = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start(0);
  } catch {
    audio = null;
  }
}

/** Tre note brevi in ambra sonora: fine recupero, torna sotto il bilanciere. */
export function beep(times = 3): void {
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === times - 1 ? 1046 : 784; // sol, poi do più alto
    gain.gain.setValueAtTime(0.0001, now + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.18);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + 0.2);
  }
}

/** Vibrazione dove esiste (Android). Su iPhone non fa nulla, ed è previsto. */
export function buzz(): void {
  if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
}
