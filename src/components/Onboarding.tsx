import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { InstallCard } from './InstallCard';
import { db } from '../db/schema';
import { isStandalone } from '../services/install';

const KEY = 'onboarded';

export const onboardingDone = signal<boolean | null>(null);

export async function loadOnboarding(): Promise<void> {
  const row = await db.settings.get(KEY);
  onboardingDone.value = row?.value === true;
}

async function markDone(): Promise<void> {
  onboardingDone.value = true;
  await db.settings.put({ key: KEY, value: true });
}

/**
 * Primo avvio: tre righe su cosa fa l'app e come metterla sul telefono.
 *
 * Appare una volta sola. Se si arriva da un link condiviso non appare affatto:
 * chi apre la scheda di un amico vuole vedere la scheda, non un benvenuto.
 */
export function Onboarding() {
  const done = onboardingDone.value;
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Chi è già in standalone ha capito il concetto: niente benvenuto.
    if (done === false && isStandalone()) void markDone();
  }, [done]);

  if (done !== false || isStandalone()) return null;

  return (
    <div class="onboarding">
      <div class="onboarding-inner">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          width="76"
          height="76"
          alt=""
          style={{ borderRadius: '18px' }}
        />

        {step === 0 ? (
          <>
            <div>
              <h1 style={{ fontSize: '34px' }}>The Beest</h1>
              <p class="sub" style={{ fontSize: '14px', marginTop: '4px' }}>
                Lavora come un'ape. Alzati come una bestia.
              </p>
            </div>

            <ul class="onboarding-list">
              <li>
                <b>1.324 esercizi</b> con animazione e istruzioni in italiano
              </li>
              <li>
                <b>Schede e piano annuale</b>, con il timer e il log dei carichi in palestra
              </li>
              <li>
                <b>Nessun account.</b> I dati stanno nel tuo telefono, non su un server
              </li>
              <li>
                <b>Funziona offline</b>, che in sala pesi conta più della connessione
              </li>
            </ul>

            <button class="btn" type="button" onClick={() => setStep(1)}>
              Comincia
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: '26px' }}>Ultima cosa</h1>
            </div>
            <InstallCard />
            <button class="btn" type="button" onClick={() => void markDone()}>
              Fatto, entriamo
            </button>
            <button class="btn btn-ghost" type="button" onClick={() => void markDone()}>
              Lo faccio dopo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
