import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../components/Sheet';
import { navigate } from '../router';
import { label, muscleLabel, getExercise, thumbUrl } from '../services/catalog';
import {
  bestSet,
  countDoneSets,
  countPlannedSets,
  formatClock,
  loadDelta,
  sessionVolume,
} from '../services/sessionMath';
import { watchVisibility } from '../services/wakeAndSound';
import {
  active,
  addRest,
  addSet,
  completeSet,
  currentIndex,
  discardSession,
  finishSession,
  goToExercise,
  now,
  patchSet,
  restRemainingMs,
  sessions,
  skipRest,
  undoSet,
} from '../stores/session';

export function LivePage() {
  const session = active.value;
  const [confirmExit, setConfirmExit] = useState(false);
  const [summary, setSummary] = useState(false);

  // iOS rilascia il Wake Lock quando esci dall'app: lo si riprende al rientro.
  useEffect(() => watchVisibility(() => active.value !== null), []);

  if (!session) {
    return (
      <main class="page">
        <div class="page-head">
          <h1>Nessun allenamento in corso</h1>
          <span class="sub">Aprine uno da una scheda e premi «Inizia allenamento».</span>
        </div>
        <button class="btn" type="button" onClick={() => navigate('schede')}>
          Vai alle schede
        </button>
      </main>
    );
  }

  const done = countDoneSets(session);
  const planned = countPlannedSets(session);
  const allDone = done >= planned;
  const elapsed = now.value - session.startedAt;

  if (summary || allDone) {
    return <FinishView session={session} onBack={() => setSummary(false)} />;
  }

  const entry = session.entries[currentIndex.value];
  const nextSetIndex = entry.setLogs.findIndex((l) => !l.done);
  const exerciseDone = nextSetIndex === -1;
  const catalogExercise = entry.ref.type === 'catalog' ? getExercise(entry.ref.id) : undefined;
  const thumb = entry.ref.type === 'catalog' ? thumbUrl(entry.ref.id) : null;
  const restMs = restRemainingMs();

  const primary = () => {
    if (!exerciseDone) {
      completeSet(currentIndex.value, nextSetIndex);
      return;
    }
    if (currentIndex.value < session.entries.length - 1) {
      goToExercise(currentIndex.value + 1);
      skipRest();
    }
  };

  return (
    <main class="page live">
      <div class="hazard" aria-hidden="true" />

      <div class="live-bar">
        <span class="row" style={{ gap: '8px' }}>
          <i class="live-dot" aria-hidden="true" />
          <span class="num" style={{ fontSize: '14px' }}>
            {formatClock(elapsed)}
          </span>
        </span>
        <span class="sub num">
          esercizio {currentIndex.value + 1} / {session.entries.length} · {done}/{planned} serie
        </span>
        <button class="icon-btn small" type="button" onClick={() => setConfirmExit(true)} aria-label="Chiudi allenamento">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div class="row">
        {thumb ? (
          <img class="media" style={{ width: '58px' }} src={thumb} alt="" width="58" height="58" />
        ) : (
          <div class="media media-placeholder" style={{ width: '58px' }} aria-hidden="true">
            GIF
          </div>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '19px' }}>{entry.name}</h2>
          <span class="sub">
            {catalogExercise
              ? `${label('equipment', catalogExercise.eq)} · ${muscleLabel(catalogExercise.tg)}`
              : 'esercizio tuo'}
          </span>
        </span>
        {catalogExercise && (
          <button
            class="icon-btn"
            type="button"
            aria-label="Vedi come si esegue"
            onClick={() => navigate('esercizio', entry.ref.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
          </button>
        )}
      </div>

      <div class="setgrid">
        {entry.setLogs.map((set, i) => {
          const isCurrent = i === nextSetIndex;
          return (
            <div key={i} class={`setrow${set.done ? ' done' : ''}${isCurrent ? ' current' : ''}`}>
              <span class="setrow-idx num">{i + 1}</span>
              <label class="setrow-cell">
                <input
                  class="live-input"
                  type="number"
                  inputMode="numeric"
                  value={set.reps}
                  aria-label={`Ripetizioni serie ${i + 1}`}
                  onInput={(e) =>
                    patchSet(currentIndex.value, i, { reps: Number((e.target as HTMLInputElement).value) || 0 })
                  }
                />
                <span class="unit">rip</span>
              </label>
              <label class="setrow-cell">
                <input
                  class="live-input"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={set.weight ?? ''}
                  placeholder="—"
                  aria-label={`Carico serie ${i + 1}`}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    patchSet(currentIndex.value, i, { weight: raw === '' ? undefined : Number(raw) });
                  }}
                />
                <span class="unit">kg</span>
              </label>
              {set.done ? (
                <button
                  class="setrow-state done"
                  type="button"
                  onClick={() => undoSet(currentIndex.value, i)}
                  aria-label={`Annulla serie ${i + 1}`}
                >
                  ✓
                </button>
              ) : (
                <span class="setrow-state">{isCurrent ? '▸' : '–'}</span>
              )}
            </div>
          );
        })}
        <button class="chip" type="button" onClick={() => addSet(currentIndex.value)}>
          + Serie extra
        </button>
      </div>

      {restMs > 0 && (
        <div class="card rest-card">
          <div>
            <div class="sub">Recupero</div>
            <div class="timer">{formatClock(restMs)}</div>
          </div>
          <div class="rest-actions">
            <button class="btn btn-ghost" type="button" onClick={() => addRest(30)}>
              +30s
            </button>
            <button class="btn btn-ghost" type="button" onClick={skipRest}>
              Salta
            </button>
          </div>
        </div>
      )}

      <div class="live-nav">
        <button
          class="icon-btn"
          type="button"
          disabled={currentIndex.value === 0}
          onClick={() => goToExercise(currentIndex.value - 1)}
          aria-label="Esercizio precedente"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <button class="btn btn-live" type="button" onClick={primary}>
          {exerciseDone
            ? currentIndex.value < session.entries.length - 1
              ? 'Prossimo esercizio'
              : 'Finito'
            : `Serie ${nextSetIndex + 1} fatta`}
        </button>
        <button
          class="icon-btn"
          type="button"
          disabled={currentIndex.value >= session.entries.length - 1}
          onClick={() => goToExercise(currentIndex.value + 1)}
          aria-label="Esercizio successivo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {confirmExit && (
        <Sheet title="Chiudere l'allenamento?" onClose={() => setConfirmExit(false)}>
          <p class="sub">
            Hai fatto {done} serie su {planned}.
          </p>
          <button
            class="btn"
            type="button"
            onClick={() => {
              setConfirmExit(false);
              setSummary(true);
            }}
          >
            Chiudi e salva
          </button>
          <button
            class="btn btn-ghost btn-danger"
            type="button"
            onClick={async () => {
              await discardSession();
              navigate('schede');
            }}
          >
            Butta via l'allenamento
          </button>
          <button class="btn btn-ghost" type="button" onClick={() => setConfirmExit(false)}>
            Continua ad allenarti
          </button>
        </Sheet>
      )}
    </main>
  );
}

/** Schermata di chiusura: il riepilogo e il tasto che accende la cella del favo. */
function FinishView({ session, onBack }: { session: NonNullable<typeof active.value>; onBack: () => void }) {
  const history = sessions.value;
  const done = countDoneSets(session);
  const planned = countPlannedSets(session);
  const minutes = Math.round((Date.now() - session.startedAt) / 60000);
  const volume = sessionVolume(session);

  return (
    <main class="page live">
      <div class="hazard" aria-hidden="true" />
      <div class="page-head">
        <h1>{session.name}</h1>
        <span class="sub">Tutte le serie chiuse. Manca solo premere il tasto.</span>
      </div>

      <div class="card card-hero">
        <div class="row">
          <div style={{ flex: 1 }}>
            <div class="sub">Durata</div>
            <div class="num" style={{ fontSize: '22px' }}>
              {minutes}′
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div class="sub">Volume</div>
            <div class="num" style={{ fontSize: '22px' }}>
              {volume.toLocaleString('it-IT')} kg
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div class="sub">Serie</div>
            <div class="num" style={{ fontSize: '22px' }}>
              {done}/{planned}
            </div>
          </div>
        </div>
      </div>

      <div class="setgrid">
        {session.entries.map((e, i) => {
          const best = bestSet(e.setLogs);
          const delta = loadDelta(history, e.ref, best?.weight);
          return (
            <div key={i} class="setrow done" style={{ gridTemplateColumns: '1fr auto' }}>
              <span class="finish-name">{e.name}</span>
              <span class="num">
                {e.setLogs.filter((l) => l.done).length}×{best?.reps ?? '—'}
                {best?.weight != null && ` · ${best.weight}`}
                {delta != null && (
                  <span style={{ color: delta > 0 ? 'var(--go)' : 'var(--drone)' }}>
                    {delta > 0 ? ` ↑${delta}` : ` ↓${Math.abs(delta)}`}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <button
        class="btn btn-live"
        type="button"
        onClick={async () => {
          await finishSession();
          navigate('progressi');
        }}
      >
        Workout completato
      </button>
      <button class="btn btn-ghost" type="button" onClick={onBack}>
        Torna alle serie
      </button>
    </main>
  );
}
