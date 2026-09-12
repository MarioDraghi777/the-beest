import { canPromptInstall, installHint, promptInstall } from '../services/install';

/**
 * Spiega come mettere l'app sulla Home, con il testo giusto per il telefono
 * che si ha in mano. Su iPhone non esiste nessun bottone che installi: c'è
 * solo il pulsante Condividi di Safari, e va detto a parole.
 */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  canPromptInstall.value; // dipendenza esplicita per il ridisegno
  const hint = installHint();

  if (hint === 'gia-installata' || hint === 'niente') return null;

  if (hint === 'bottone') {
    return (
      <div class="card install-card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Mettila sul telefono
        </span>
        {!compact && (
          <p style={{ margin: '8px 0 12px', fontSize: '14.5px' }}>
            Installata parte a schermo intero, tiene acceso lo schermo durante l'allenamento e
            conserva i dati anche se non la apri per settimane.
          </p>
        )}
        <button class="btn" type="button" onClick={() => void promptInstall()}>
          Installa l'app
        </button>
      </div>
    );
  }

  if (hint === 'ios-altro-browser') {
    return (
      <div class="card install-card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Mettila sul telefono
        </span>
        <p style={{ margin: '8px 0 0', fontSize: '14.5px' }}>
          Su iPhone l'installazione la fa solo Safari. Apri questo stesso indirizzo in Safari e
          troverai qui le istruzioni.
        </p>
      </div>
    );
  }

  // iOS + Safari: le istruzioni vere
  return (
    <div class="card install-card">
      <span class="eyebrow" style={{ color: 'var(--honey)' }}>
        Mettila sulla Home
      </span>
      {!compact && (
        <p style={{ margin: '8px 0 0', fontSize: '14.5px' }}>
          Su iPhone conta più di quanto sembri: Safari <b>cancella i dati dei siti che non apri da
          7 giorni</b>, mentre un'app sulla Home li tiene. E solo così hai schermo intero e schermo
          che resta acceso mentre ti alleni.
        </p>
      )}
      <ol class="install-steps">
        <li>
          Tocca <b>Condividi</b>
          <svg class="ios-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 3v12M8.5 6.5 12 3l3.5 3.5" />
            <path d="M6 11H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9h-1" />
          </svg>
          in fondo allo schermo
        </li>
        <li>
          Scorri e scegli <b>Aggiungi a Home</b>
        </li>
        <li>
          Conferma con <b>Aggiungi</b>
        </li>
      </ol>
    </div>
  );
}
