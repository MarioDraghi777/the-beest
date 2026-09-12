import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { ShareLinks, appUrl } from './ShareLinks';
import { encodePayload, type WirePayload } from '../services/shareCodec';
import { downloadFile } from '../services/ics';

interface Props {
  payload: WirePayload;
  /** Nome mostrato nel messaggio, es. "Upper A — Spinta". */
  title: string;
  onClose: () => void;
}

/** Oltre questa lunghezza il link diventa fragile nelle app di messaggistica. */
const URL_LIMIT = 8000;

export function ShareSheet({ payload, title, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);

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

      <ShareLinks url={url} title={title} message={message} />

      <span class="sub num" style={{ textAlign: 'center' }}>
        {url.length} caratteri
      </span>
    </Sheet>
  );
}
