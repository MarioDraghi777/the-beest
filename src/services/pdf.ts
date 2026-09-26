/**
 * Lettura di una scheda in PDF.
 *
 * Come per l'OCR, il motore (pdf.js) NON è nel bundle: pesa un paio di
 * megabyte e serve solo a chi importa un PDF, quindi si scarica da CDN al
 * primo utilizzo. Due strade, decise dal file stesso:
 *
 *  - PDF "vero" (esportato da Word, Excel, un gestionale): ha uno strato di
 *    testo, lo si estrae e finisce nel parser normale;
 *  - PDF scansionato (la scheda fotocopiata): di testo non ne ha, allora si
 *    disegna la pagina in un'immagine e si passa la palla alla foto/OCR.
 */

const VERSION = '3.11.174';
const CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${VERSION}/build/pdf.min.js`;
const WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${VERSION}/build/pdf.worker.min.js`;

/** Oltre questo non è una scheda: è un libro. Si legge l'inizio e basta. */
const MAX_PAGES = 20;

interface TextItem {
  str: string;
  width: number;
  transform: number[];
}

interface PdfPage {
  getTextContent: () => Promise<{ items: (TextItem | Record<string, unknown>)[] }>;
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

interface PdfjsGlobal {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsGlobal;
  }
}

/** Il motore arriva dalla rete: offline il PDF non si può aprire. */
export function pdfAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

let loading: Promise<PdfjsGlobal> | null = null;

function loadPdfjs(): Promise<PdfjsGlobal> {
  const ready = (lib: PdfjsGlobal) => {
    lib.GlobalWorkerOptions.workerSrc = WORKER;
    return lib;
  };
  if (window.pdfjsLib) return Promise.resolve(ready(window.pdfjsLib));
  loading ??= new Promise<PdfjsGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) resolve(ready(window.pdfjsLib));
      else reject(new Error('motore non disponibile'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('non riesco a scaricare il motore di lettura PDF'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

async function open(file: Blob): Promise<[PdfjsGlobal, PdfDoc]> {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return [lib, await lib.getDocument({ data }).promise];
}

function isText(item: TextItem | Record<string, unknown>): item is TextItem {
  return typeof (item as TextItem).str === 'string' && Array.isArray((item as TextItem).transform);
}

/**
 * pdf.js restituisce frammenti sparsi, non righe: ogni pezzo porta con sé la
 * propria posizione. Si rimettono in fila per coordinata verticale (stessa
 * quota, a due punti di tolleranza = stessa riga) e poi per coordinata
 * orizzontale. È questo che fa uscire le tabelle come righe leggibili.
 */
export function toLines(items: (TextItem | Record<string, unknown>)[]): string[] {
  const pieces = items
    .filter(isText)
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
    .filter((p) => p.str.length > 0);

  pieces.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

  const lines: string[] = [];
  let current = '';
  let currentY: number | null = null;
  let endX = 0;

  for (const p of pieces) {
    if (currentY === null || Math.abs(p.y - currentY) > 2) {
      if (current.trim()) lines.push(current);
      current = p.str;
      currentY = p.y;
    } else {
      // Un buco orizzontale è uno spazio (o una colonna): senza, "Panca
      // piana4x8" arriva attaccato e il parser non ci capisce niente.
      const gap = p.x - endX;
      const attaccati = /\s$/.test(current) || /^\s/.test(p.str);
      current += attaccati || gap < 1 ? p.str : ' ' + p.str;
    }
    endX = p.x + p.w;
  }
  if (current.trim()) lines.push(current);

  return lines;
}

/** Il testo del PDF, una riga per riga visiva. Vuoto se è una scansione. */
export async function readPdfText(file: Blob): Promise<string> {
  const [, doc] = await open(file);
  try {
    const lines: string[] = [];
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      lines.push(...toLines(content.items));
    }
    return lines
      .map((line) => line.replace(/\s{2,}/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');
  } finally {
    void doc.destroy();
  }
}

/**
 * La pagina disegnata come immagine, per i PDF scansionati: da lì si prosegue
 * con l'OCR o ricopiando a mano, esattamente come per una foto.
 */
export async function renderPdfPage(file: Blob, pageNumber = 1): Promise<string> {
  const [, doc] = await open(file);
  try {
    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages));
    // 1600px sul lato lungo: abbastanza per leggerla e per l'OCR, senza
    // riempire la memoria di un telefono.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 1600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas non disponibile');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    void doc.destroy();
  }
}

export function isPdf(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
}
