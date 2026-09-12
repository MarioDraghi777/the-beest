import { navigate } from '../router';
import { WEEKDAYS, addDays, blockOfWeek, startOfWeek, weekOf } from '../services/planMath';
import { countDoneSets, formatDateLong, localDate, sessionVolume } from '../services/sessionMath';
import { activePlan, entriesOn } from '../stores/plan';
import { sessions, startSession } from '../stores/session';
import { countSets, estimateMinutes, refName, workouts } from '../stores/workouts';
import type { PlanEntry } from '../types';

/**
 * La schermata che risponde a "che faccio adesso".
 * Un tap per iniziare, il resto è contesto.
 */
export function TodayPage() {
  const today = localDate();
  const plan = activePlan();
  const todayEntries = entriesOn(today);
  const todaySessions = sessions.value.filter((s) => s.date === today);
  const week = plan ? weekOf(plan, today) : 0;
  const block = plan && week ? blockOfWeek(plan, week) : null;
  const weekStart = startOfWeek(today);

  const weekSessions = sessions.value.filter((s) => s.date >= weekStart && s.date <= addDays(weekStart, 6));
  const weekVolume = weekSessions.reduce((sum, s) => sum + sessionVolume(s), 0);
  const weekSets = weekSessions.reduce((sum, s) => sum + countDoneSets(s), 0);

  const plannedThisWeek = plan
    ? Array.from({ length: 7 }, (_, i) => entriesOn(addDays(weekStart, i)).length).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <main class="page">
      <div class="page-head">
        <h1>Oggi</h1>
        <span class="sub">
          {formatDateLong(today)}
          {plan && week > 0 && block
            ? ` · ${plan.blocks[block.index].name} · settimana ${week}`
            : plan
              ? ` · ${plan.name}`
              : ''}
        </span>
      </div>

      {todayEntries.length === 0 && todaySessions.length === 0 && <RestCard hasPlan={Boolean(plan)} />}

      {todayEntries.map((entry) => (
        <TodayCard key={entry.id} entry={entry} />
      ))}

      {todaySessions.map((s) => (
        <div key={s.id} class="card card-hero">
          <span class="eyebrow" style={{ color: 'var(--go)' }}>
            Fatto oggi
          </span>
          <h2 style={{ marginTop: '6px' }}>{s.name}</h2>
          <div class="sub num" style={{ marginTop: '4px' }}>
            {countDoneSets(s)} serie · {sessionVolume(s).toLocaleString('it-IT')} kg
          </div>
        </div>
      ))}

      <div class="card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Questa settimana
        </span>
        <div class="row" style={{ marginTop: '10px' }}>
          <div style={{ flex: 1 }}>
            <div class="sub">Allenamenti</div>
            <div class="num" style={{ fontSize: '20px' }}>
              {weekSessions.length}
              {plannedThisWeek > 0 && <span class="sub"> / {plannedThisWeek}</span>}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div class="sub">Serie</div>
            <div class="num" style={{ fontSize: '20px' }}>
              {weekSets}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div class="sub">Volume</div>
            <div class="num" style={{ fontSize: '20px' }}>
              {weekVolume.toLocaleString('it-IT')} kg
            </div>
          </div>
        </div>

        <div class="week-strip" style={{ marginTop: '12px' }}>
          {WEEKDAYS.map((label, i) => {
            const date = addDays(weekStart, i);
            const has = entriesOn(date).length > 0;
            const done = sessions.value.some((s) => s.date === date);
            return (
              <button
                key={date}
                type="button"
                class={`week-day${done ? ' done' : ''}${date === today ? ' today' : ''}`}
                onClick={() => navigate('piano')}
              >
                <span class="week-day-name">{label}</span>
                <span class="num week-day-num">{Number(date.slice(8))}</span>
                <span class="week-day-dot">{done ? '✓' : has ? '•' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function TodayCard({ entry }: { entry: PlanEntry }) {
  const workout = workouts.value.find((w) => w.id === entry.workoutId);
  if (!workout) return null;

  const start = async () => {
    await startSession(workout.id, entry.id);
    navigate('allenamento');
  };

  if (entry.status === 'fatto') {
    return (
      <div class="card">
        <span class="eyebrow" style={{ color: 'var(--go)' }}>
          Completato
        </span>
        <h2 style={{ marginTop: '4px' }}>{workout.name}</h2>
      </div>
    );
  }

  return (
    <div class="card card-hero" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Previsto oggi
        </span>
        <h2 style={{ fontSize: '22px', marginTop: '4px' }}>{workout.name}</h2>
        <div class="sub num" style={{ marginTop: '2px' }}>
          {workout.items.length} esercizi · {countSets(workout)} serie · ~{estimateMinutes(workout)}′
        </div>
      </div>

      <div class="setgrid">
        {workout.items.slice(0, 3).map((item, i) => (
          <div key={i} class="setrow" style={{ gridTemplateColumns: '1fr auto' }}>
            <span class="finish-name">{refName(item.ref)}</span>
            <span class="num">
              {item.sets}×{item.reps}
              {item.load != null && ` · ${item.load}`}
            </span>
          </div>
        ))}
        {workout.items.length > 3 && (
          <span class="sub" style={{ paddingLeft: '10px' }}>
            + altri {workout.items.length - 3} esercizi
          </span>
        )}
      </div>

      <button class="btn btn-live" type="button" onClick={() => void start()}>
        Inizia allenamento
      </button>
    </div>
  );
}

function RestCard({ hasPlan }: { hasPlan: boolean }) {
  return (
    <div class="card card-hero">
      <span class="eyebrow">Oggi</span>
      <h2 style={{ marginTop: '6px' }}>{hasPlan ? 'Riposo' : 'Nessun piano attivo'}</h2>
      <p class="sub" style={{ margin: '8px 0 14px' }}>
        {hasPlan
          ? 'Il piano non prevede niente. Se hai voglia comunque, parti da una scheda.'
          : 'Crea un piano per vedere qui la seduta del giorno, oppure allenati a mano da una scheda.'}
      </p>
      <div class="stack">
        <button class="btn btn-ghost" type="button" onClick={() => navigate('schede')}>
          Vai alle schede
        </button>
        {!hasPlan && (
          <button class="btn btn-ghost" type="button" onClick={() => navigate('piano')}>
            Crea il piano
          </button>
        )}
      </div>
    </div>
  );
}
