import { useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';
import { db } from '../db/schema';
import { buildIcs, downloadFile } from '../services/ics';
import { localDate } from '../services/sessionMath';
import { activePlan, planEntries } from '../stores/plan';
import { workouts } from '../stores/workouts';

const SEQ_KEY = 'icsSequence';

/**
 * "Aggiungi al calendario": genera il file .ics delle sedute future.
 *
 * È il canale di promemoria principale dell'app, non un ripiego. Su iPhone è
 * l'unico modo perché un avviso arrivi con l'app chiusa senza tirarsi dietro
 * un server, e in più funziona identico per chiunque riceva il link.
 */
export function CalendarExport({ onClose }: { onClose: () => void }) {
  const [time, setTime] = useState('18:30');
  const [durationMin, setDurationMin] = useState(75);
  const [alarmMin, setAlarmMin] = useState(45);
  const [onlyFuture, setOnlyFuture] = useState(true);
  const [done, setDone] = useState(false);

  const plan = activePlan();
  if (!plan) return null;

  const today = localDate();
  const all = planEntries(plan.id).filter((e) => e.status === 'previsto');
  const selected = onlyFuture ? all.filter((e) => e.date >= today) : all;

  const exporta = async () => {
    const row = await db.settings.get(SEQ_KEY);
    const sequence = ((row?.value as number) ?? 0) + 1;
    await db.settings.put({ key: SEQ_KEY, value: sequence });

    const ics = buildIcs(plan, selected, workouts.value, { time, durationMin, alarmMin, sequence });
    downloadFile(`${plan.name.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-')}.ics`, ics, 'text/calendar');
    setDone(true);
  };

  return (
    <Sheet title="Promemoria nel calendario" onClose={onClose}>
      <p class="sub">
        L'app prepara un file con le tue sedute e l'avviso già dentro. Lo apri una volta e da lì in poi
        se ne occupa il Calendario del telefono: l'avviso arriva anche con l'app chiusa e senza rete.
      </p>

      <label class="form-row">
        <span class="stepper-label">Ora di inizio</span>
        <input
          class="cell-input"
          type="time"
          value={time}
          onInput={(e) => setTime((e.target as HTMLInputElement).value)}
        />
      </label>

      <Stepper label="Durata" value={durationMin} step={15} min={15} max={240} unit="′" onChange={setDurationMin} />
      <Stepper label="Avvisami prima" value={alarmMin} step={15} min={0} max={180} unit="′" onChange={setAlarmMin} />

      <div class="form-row">
        <span class="stepper-label">Quali sedute</span>
        <div class="chips">
          <button type="button" class="chip" aria-pressed={onlyFuture} onClick={() => setOnlyFuture(true)}>
            Da oggi
          </button>
          <button type="button" class="chip" aria-pressed={!onlyFuture} onClick={() => setOnlyFuture(false)}>
            Tutte
          </button>
        </div>
      </div>

      {done ? (
        <div class="card" style={{ borderColor: 'var(--go)' }}>
          <b>File scaricato.</b>
          <div class="sub">
            Aprilo per aggiungere le sedute al calendario. Se in futuro cambi il piano, riesporta: gli
            eventi si aggiornano da soli invece di duplicarsi.
          </div>
        </div>
      ) : (
        <button class="btn" type="button" disabled={selected.length === 0} onClick={() => void exporta()}>
          {selected.length === 0 ? 'Nessuna seduta da esportare' : `Scarica ${selected.length} sedute`}
        </button>
      )}
    </Sheet>
  );
}
