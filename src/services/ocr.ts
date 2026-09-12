/**
 * Lettura automatica di una scheda fotografata.
 *
 * Tesseract gira nel browser ma pesa: il motore e il modello di lingua sono
 * una quindicina di megabyte, scaricati da una CDN al primo utilizzo. Per
 * questo NON è nel bundle e NON è il percorso principale: sta dietro un
 * bottone, si carica solo se lo premi, e se non funziona l'app lo dice e
 * rimanda alla trascrizione a mano, che su una scheda scritta a penna resta
 * comunque più affidabile.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

interface TesseractGlobal {
  recognize: (
    image: string,
    langs: string,
    options?: { logger?: (m: { status: string; progress: number }) => void }
  ) => Promise<{ data: { text: string } }>;
}

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

/** Serve una connessione: offline il modello non si può scaricare. */
export function ocrAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

let loading: Promise<TesseractGlobal> | null = null;

function loadTesseract(): Promise<TesseractGlobal> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  loading ??= new Promise<TesseractGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN;
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('motore non disponibile'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('non riesco a scaricare il motore di lettura'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Restituisce il testo letto, ripulito dalle righe di puro rumore.
 * Il risultato va sempre corretto a mano: è un punto di partenza, non una
 * trascrizione fedele.
 */
export async function readOcr(imageUrl: string): Promise<string> {
  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(imageUrl, 'ita+eng');
  return result.data.text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    // Righe di sole due lettere o di soli simboli: è quasi sempre sporco.
    .filter((line) => line.length > 2 && /[a-zà-ù]{3}/i.test(line))
    .join('\n');
}
