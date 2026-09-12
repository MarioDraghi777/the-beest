import { useMemo, useState } from 'preact/hooks';
import { LineChart } from '../components/LineChart';
import { Sheet } from '../components/Sheet';
import { navigate } from '../router';
import {
  bestSet,
  countDoneSets,
  formatDateLong,
  formatDateShort,
  sessionVolume,
} from '../services/sessionMath';
import { progressionFor, summarize, trainedExercises } from '../services/progression';
import { deleteSession, sessions, sessionsLoaded } from '../stores/session';
import type { ExerciseRef, Session } from '../types';

type Metric = 'weight' | 'volume' | 'estimated1RM';

const METRICHE: { key: Metric; label: string; unit: string }[] = [
  { key: 'weight', label: 'Carico', unit: 'kg' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
  { key: 'estimated1RM', label: 'Massimale stimato', unit: 'kg' },
];

function duration(session: Session): string {
  if (!session.endedAt) return '—';
  return `${Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))}′`;
}

export function ProgressPage() {
  const list = sessions.value;
  const [open, setOpen] = useState<Session | null>(null);
  const [chosen, setChosen] = useState<ExerciseRef | null>(null);
  const [metric, setMetric] = useState<Metric>('weight');

  const trained = useMemo(() => trainedExercises(list), [list]);
  const current = chosen ?? trained[0]?.ref ?? null;
  const points = useMemo(() => (current ? progressionFor(list, current) : []), [list, current]);
  const summary = summarize(points);
  const currentName = trained.find((t) => t.ref.type === current?.type && t.ref.id === current?.id)?.name;

  const totalVolume = list.reduce((s, x) => s + sessionVolume(x), 0);
  const thisWeek = list.filter((s) => (Date.now() - s.startedAt) / 86400000 <= 7);
  const unit = METRICHE.find((m) => m.key === metric)!.unit;

  return (
    <main class="page">
      <div class="page-head">
        <h1>Progressi</h1>
        <span class="sub">
          {list.length === 0 ? 'Nessun allenamento registrato' : `${list.length} allenamenti completati`}
        </span>
      </div>

      {list.length > 0 && (
        <div class="card card-hero">
          <div class="row">
            <div style={{ flex: 1 }}>
              <div class="sub">Ultimi 7 giorni</div>
              <div class="num" style={{ fontSize: '22px' }}>
                {thisWeek.length}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div class="sub">Serie totali</div>
              <div class="num" style={{ fontSize: '22px' }}>
                {list.reduce((s, x) => s + countDoneSets(x), 0)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div class="sub">Volume totale</div>
              <div class="num" style={{ fontSize: '22px' }}>
                {Math.round(totalVolume / 1000).toLocaleString('it-IT')} t
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ progressione */}
      {trained.length > 0 && current && (
        <div class="card">
          <span class="eyebrow" style={{ color: 'var(--honey)' }}>
            Progressione
          </span>

          <div class="chips" style={{ marginTop: '10px' }} role="group" aria-label="Scegli l'esercizio">
            {trained.map((t) => (
              <button
                key={`${t.ref.type}:${t.ref.id}`}
                type="button"
                class="chip"
                aria-pressed={t.ref.id === current.id && t.ref.type === current.type}
                onClick={() => setChosen(t.ref)}
              >
                {t.name.length > 26 ? `${t.name.slice(0, 24)}…` : t.name}
                <span class="sub" style={{ marginLeft: '6px' }}>
                  {t.sessions}
                </span>
              </button>
            ))}
          </div>

          <div class="chips" style={{ marginTop: '8px' }} role="group" aria-label="Che cosa guardare">
            {METRICHE.map((m) => (
              <button
                key={m.key}
                type="button"
                class="chip"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '12px' }}>
            <LineChart points={points.map((p) => ({ date: p.date, value: p[metric] }))} unit={unit} />
          </div>

          {summary && (
            <>
              <div class="row" style={{ marginTop: '6px' }}>
                <div style={{ flex: 1 }}>
                  <div class="sub">Adesso</div>
                  <div class="num" style={{ fontSize: '19px' }}>
                    {summary.last.weight} kg × {summary.last.reps}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div class="sub">Migliore</div>
                  <div class="num" style={{ fontSize: '19px' }}>
                    {summary.best.weight} kg
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div class="sub">Dall'inizio</div>
                  <div
                    class="num"
                    style={{
                      fontSize: '19px',
                      color: summary.deltaWeight > 0 ? 'var(--go)' : summary.deltaWeight < 0 ? 'var(--stop)' : undefined,
                    }}
                  >
                    {summary.deltaWeight > 0 ? '+' : ''}
                    {summary.deltaWeight} kg
                  </div>
                </div>
              </div>
              <p class="sub" style={{ marginTop: '8px' }}>
                {currentName} · {points.length} sessioni, dal {formatDateShort(summary.first.date)}
                {metric === 'estimated1RM' && ' · il massimale è una stima dalla serie migliore, non un test'}
              </p>
            </>
          )}
        </div>
      )}

      {!sessionsLoaded.value && <p class="empty">Carico…</p>}

      {sessionsLoaded.value && list.length === 0 && (
        <p class="empty">
          Qui finiscono gli allenamenti che chiudi con «Workout completato», con i carichi di ogni serie.
        </p>
      )}

      <div class="stack">
        {list.map((s) => (
          <button key={s.id} class="list-row" type="button" onClick={() => setOpen(s)}>
            <span class="hexbadge" style={{ width: '44px', height: '50px' }}>
              <b>{new Date(s.startedAt).getDate()}</b>
              <span>{formatDateShort(s.date).split(' ')[2]?.toUpperCase()}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span class="title">{s.name}</span>
              <span class="meta">
                {formatDateShort(s.date)} · {duration(s)} · {countDoneSets(s)} serie ·{' '}
                {sessionVolume(s).toLocaleString('it-IT')} kg
              </span>
            </span>
          </button>
        ))}
      </div>

      <button class="btn btn-ghost" type="button" onClick={() => navigate('dati')}>
        Backup ed esportazione
      </button>

      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <span class="sub">
            {formatDateLong(open.date)} · {duration(open)} · {sessionVolume(open).toLocaleString('it-IT')} kg
          </span>

          <div class="setgrid">
            {open.entries.map((e, i) => {
              const best = bestSet(e.setLogs);
              const doneSets = e.setLogs.filter((l) => l.done);
              return (
                <div key={i} class="stack" style={{ gap: '4px' }}>
                  <span class="item-name">{e.name}</span>
                  <span class="sub num">
                    {doneSets.length === 0
                      ? 'non fatto'
                      : doneSets.map((l) => `${l.reps}${l.weight != null ? `×${l.weight}` : ''}`).join('  ·  ')}
                    {best?.weight != null && doneSets.length > 1 && `   (max ${best.weight} kg)`}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            class="btn btn-ghost btn-danger"
            type="button"
            onClick={async () => {
              await deleteSession(open.id);
              setOpen(null);
            }}
          >
            Elimina dallo storico
          </button>
        </Sheet>
      )}
    </main>
  );
}
