import { useState } from 'preact/hooks';

interface Props {
  url: string;
  /** Titolo per la condivisione nativa. */
  title: string;
  /** Messaggio che accompagna il link. */
  message: string;
}

/**
 * I canali di condivisione, uguali ovunque nell'app: condivisione nativa dove
 * c'è, poi WhatsApp, Telegram, email e copia. WhatsApp e Telegram sono
 * semplici link, quindi funzionano anche dove il browser non concede la
 * condivisione nativa (che vuole un contesto sicuro).
 */
export function ShareLinks({ url, title, message }: Props) {
  const [copied, setCopied] = useState(false);
  const full = `${message}\n${url}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // l'utente ha annullato: non è un errore
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

  return (
    <>
      {canNativeShare && (
        <button class="btn" type="button" onClick={() => void nativeShare()}>
          Condividi
        </button>
      )}
      <a class="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noopener">
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
      <a class="btn btn-ghost" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}`}>
        Email
      </a>
      <button class="btn btn-ghost" type="button" onClick={() => void copy()}>
        {copied ? 'Link copiato' : 'Copia il link'}
      </button>
    </>
  );
}

/** Indirizzo dell'app senza la rotta corrente: regge anche un cambio di hosting. */
export function appUrl(): string {
  return `${location.origin}${location.pathname}`;
}
