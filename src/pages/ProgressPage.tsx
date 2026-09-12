import { useState } from 'preact/hooks';
import { Sheet } from '../components/Sheet';
import {
  bestSet,
  countDoneSets,
  formatDateLong,
  formatDateShort,
  sessionVolume,
} from '../services/sessionMath';
import { deleteSession, sessions, sessionsLoaded } from '../stores/session';
import type { Session } from '../types';

function duration(session: Session): string {
  if (!session.endedAt) return '—';
  return `${Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))}′`;
}

export function ProgressPage() {
  const list = sessions.value;
  const [open, setOpen] = useState<Session | null>(null);

  const totalVolume = list.reduce((s, x) => s + sessionVolume(x), 0);
  const thisWeek = list.filter((s) => {
    const days = (Date.now() - s.startedAt) / 86400000;
    return days <= 7;
  });

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
                      : doneSets
                          .map((l) => `${l.reps}${l.weight != null ? `×${l.weight}` : ''}`)
                          .join('  ·  ')}
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
