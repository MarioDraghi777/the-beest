import { useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { ShareLinks, appUrl } from './ShareLinks';

const MESSAGGIO =
  'Uso The Beest per le schede e gli allenamenti in palestra: 1.324 esercizi illustrati, ' +
  'funziona offline e non serve registrarsi. Si apre e basta';

/**
 * Invito all'app. Il link è semplicemente l'indirizzo: chi lo apre si ritrova
 * l'app funzionante, con i suoi dati sul suo telefono e nessun account da
 * creare. Non c'è niente da condividere oltre all'URL, ed è il punto.
 */
export function InviteApp({ variant = 'ghost' }: { variant?: 'ghost' | 'solid' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button class={variant === 'solid' ? 'btn' : 'btn btn-ghost'} type="button" onClick={() => setOpen(true)}>
        Consiglia The Beest a qualcuno
      </button>

      {open && (
        <Sheet title="Passa parola" onClose={() => setOpen(false)}>
          <p class="sub">
            Chi apre il link ha l'app subito, senza installare e senza registrarsi. I suoi dati
            restano sul suo telefono: non vedrà i tuoi e tu non vedrai i suoi.
          </p>
          <ShareLinks url={appUrl()} title="The Beest" message={MESSAGGIO} />
        </Sheet>
      )}
    </>
  );
}
