import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { encodePayload, type WirePayload } from '../services/shareCodec';
import { downloadFile } from '../services/ics';

interface Props {
  payload: WirePayload;
  /** Nome mostrato nel messaggio, es. "Upper A — Spinta". */
  title: string;
  onClose: () => void;
}

/** Indirizzo dell'app senza la rotta corrente: regge anche un cambio di hosting. */
function appUrl(): string {
  return `${location.origin}${location.pathname}`;
}

/** Oltre questa lunghezza il link diventa fragile nelle app di messaggistica. */
const URL_LIMIT = 8000;

export function ShareSheet({ payload, title, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void encodePayload(payload).then((code) => {
      if (!alive) return;
      const link = `${appUrl()}#/condiviso/${code}`;
      setUrl(link);
      setTooLong(link.length > URL_LIMIT);
    });
    return () => {
      alive = false;
    };
  }, [payload]);

  if (!url) {
    return (
      <Sheet title="Condividi" onClose={onClose}>
        <p class="empty">Preparo il link…</p>
      </Sheet>
    );
  }

  const message = `Ti mando «${title}» da The Beest: si apre nel browser, senza installare niente.`;
  const full = `${message}\n${url}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // l'utente ha annullato: nessun errore da mostrare
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (tooLong) {
    return (
      <Sheet title="Troppo grande per un link" onClose={onClose}>
        <p class="sub">
          Questo piano non entra in un indirizzo web senza rischiare di essere troncato dalle app di
          messaggistica. Mandalo come file: chi lo riceve lo apre con «Importa da file».
        </p>
        <button
          class="btn"
          type="button"
          onClick={() => downloadFile(`${title.replace(/[^\w-]+/g, '-')}.beest.json`, JSON.stringify(payload), 'application/json')}
        >
          Scarica il file
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Condividi" onClose={onClose}>
      <p class="sub">
        La scheda viaggia dentro il link: chi lo apre la vede subito, senza installare e senza
        registrarsi. Niente passa da un server — il contenuto sta dopo il «#», che il browser non
        invia a nessuno.
      </p>

      {canNativeShare && (
        <button class="btn" type="button" onClick={() => void nativeShare()}>
          Condividi
        </button>
      )}

      <a
        class="btn btn-ghost"
        href={`https://wa.me/?text=${encodeURIComponent(full)}`}
        target="_blank"
        rel="noopener"
      >
        WhatsApp
      </a>
      <a
        class="btn btn-ghost"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener"
      >
        Telegram
      </a>
      <a
        class="btn btn-ghost"
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}`}
      >
        Email
      </a>
      <button class="btn btn-ghost" type="button" onClick={() => void copy()}>
        {copied ? 'Link copiato' : 'Copia il link'}
      </button>

      <span class="sub num" style={{ textAlign: 'center' }}>
        {url.length} caratteri
      </span>
    </Sheet>
  );
}
