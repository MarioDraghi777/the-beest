import { useState } from 'preact/hooks';
import { CalendarExport } from '../components/CalendarExport';
import { Favo, FavoLegend } from '../components/Favo';
import { ShareSheet } from '../components/ShareSheet';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { navigate } from '../router';
import {
  WEEKDAYS,
  addDays,
  adherence,
  blockOfWeek,
  favoYear,
  planWeeks,
  startOfWeek,
  weekOf,
  weekStreak,
} from '../services/planMath';
import { formatDateLong, localDate } from '../services/sessionMath';
import { planPayload } from '../services/shareCodec';
import {
  activePlan,
  addEntry,
  createPlan,
  deleteEntry,
  deletePlan,
  emptyBlock,
  entriesOn,
  planEntries,
  prepareEdit,
  rebuildEntries,
  resetEntry,
  skipEntry,
  updatePlan,
  type PropagationScope,
} from '../stores/plan';
import { sessions, startOrResume } from '../stores/session';
import { customExercises, workouts } from '../stores/workouts';
import type { PlanBlock, PlanEntry } from '../types';

const today = () => localDate();

export function PlanPage() {
  const plan = activePlan();
  const [creating, setCreating] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [editBlocks, setEditBlocks] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!plan) {
    return (
      <main class="page">
        <div class="page-head">
          <h1>Piano</h1>
          <span class="sub">Nessun piano attivo</span>
        </div>
        <div class="card card-hero">
          <span class="eyebrow">Come funziona</span>
          <p style={{ margin: '10px 0 0' }}>
            Un piano è fatto di blocchi — accumulo, ipertrofia, forza — e ogni blocco ha il suo schema
            settimanale: quali schede, in quali giorni, per quante settimane.
          </p>
          <p class="sub" style={{ margin: '8px 0 0' }}>
            Da lì l'app genera tutte le sedute a calendario e il favo dell'anno.
          </p>
        </div>
        <button class="btn" type="button" onClick={() => setCreating(true)} disabled={workouts.value.length === 0}>
          Crea il piano
        </button>
        {workouts.value.length === 0 && (
          <p class="sub" style={{ textAlign: 'center' }}>
            Prima però serve almeno una scheda.{' '}
            <button class="linkish" type="button" onClick={() => navigate('schede')}>
              Vai alle schede
            </button>
          </p>
        )}
        {creating && <PlanWizard onClose={() => setCreating(false)} />}
      </main>
    );
  }

  const all = planEntries(plan.id);
  const day = today();
  const year = Number(day.slice(0, 4));
  const days = favoYear(year, all, sessions.value, day);
  const streak = weekStreak(sessions.value, day);
  const rate = adherence(days, day);
  const currentWeek = weekOf(plan, day);
  const weekStart = startOfWeek(day);

  return (
    <main class="page">
      <div class="page-head">
        <h1>{plan.name}</h1>
        <span class="sub">
          dal {formatDateLong(plan.startDate)} · {planWeeks(plan)} settimane · {plan.blocks.length} blocchi
          {currentWeek > 0 && ` · sei alla ${currentWeek}ª`}
        </span>
      </div>

      <div class="card" style={{ display: 'flex', padding: '12px' }}>
        <div style={{ flex: 1 }}>
          <div class="sub">Serie aperta</div>
          <div class="num" style={{ fontSize: '20px', color: 'var(--honey)' }}>
            {streak} sett.
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div class="sub">Sessioni</div>
          <div class="num" style={{ fontSize: '20px' }}>
            {sessions.value.length}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div class="sub">Aderenza</div>
          <div class="num" style={{ fontSize: '20px', color: rate != null && rate >= 70 ? 'var(--go)' : undefined }}>
            {rate != null ? `${rate}%` : '—'}
          </div>
        </div>
      </div>

      <div class="card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Il favo · {year}
        </span>
        <div style={{ marginTop: '12px' }}>
          <Favo days={days} today={day} onPick={setOpenDay} />
        </div>
        <FavoLegend />
      </div>

      <WeekStrip weekStart={weekStart} onPick={setOpenDay} />

      <div class="card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Blocchi
        </span>
        <div style={{ marginTop: '6px' }}>
          {plan.blocks.map((b, i) => {
            const range = blockOfWeek(plan, 1 + plan.blocks.slice(0, i).reduce((s, x) => s + x.weeks, 0));
            const from = range?.from ?? 1;
            const to = range?.to ?? b.weeks;
            const inBlock = currentWeek >= from && currentWeek <= to;
            const blockEntries = all.filter((e) => e.blockId === b.id);
            const done = blockEntries.filter((e) => e.status === 'fatto').length;
            const pct = blockEntries.length ? Math.round((done / blockEntries.length) * 100) : 0;
            return (
              <div key={b.id} class="block-row">
                <i class="block-bar" style={{ background: inBlock ? 'var(--honey)' : 'var(--drone)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: '14px' }}>
                    {i + 1} · {b.name}
                  </b>
                  <div class="sub num">
                    sett. {from}–{to}
                    {b.focus ? ` · ${b.focus}` : ''}
                    {inBlock ? ' · in corso' : currentWeek > to ? ' · concluso' : ''}
                  </div>
                </div>
                <span class="num" style={{ color: inBlock ? 'var(--honey)' : 'var(--drone)' }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        <button class="btn btn-ghost" style={{ marginTop: '10px' }} type="button" onClick={() => setEditBlocks(true)}>
          Modifica blocchi e giorni
        </button>
      </div>

      <button class="btn" type="button" onClick={() => setCalendar(true)}>
        Aggiungi al calendario
      </button>
      <button class="btn btn-ghost" type="button" onClick={() => setSharing(true)}>
        Condividi il piano
      </button>
      <button
        class="btn btn-ghost btn-danger"
        type="button"
        onClick={async () => {
          if (confirm(`Eliminare il piano «${plan.name}»? Le sedute a calendario spariscono, lo storico resta.`)) {
            await deletePlan(plan.id);
          }
        }}
      >
        Elimina il piano
      </button>

      {calendar && <CalendarExport onClose={() => setCalendar(false)} />}
      {sharing && (
        <ShareSheet
          payload={planPayload(plan, workouts.value, customExercises.value)}
          title={plan.name}
          onClose={() => setSharing(false)}
        />
      )}
      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} />}
      {editBlocks && <BlocksSheet onClose={() => setEditBlocks(false)} />}
    </main>
  );
}

/* ------------------------------------------------------- settimana corrente */

function WeekStrip({ weekStart, onPick }: { weekStart: string; onPick: (date: string) => void }) {
  const day = today();
  return (
    <div class="card">
      <span class="eyebrow" style={{ color: 'var(--honey)' }}>
        Questa settimana
      </span>
      <div class="week-strip">
        {WEEKDAYS.map((label, i) => {
          const date = addDays(weekStart, i);
          const dayEntries = entriesOn(date);
          const done = dayEntries.some((e) => e.status === 'fatto');
          const isToday = date === day;
          return (
            <button
              key={date}
              type="button"
              class={`week-day${done ? ' done' : ''}${isToday ? ' today' : ''}`}
              onClick={() => onPick(date)}
            >
              <span class="week-day-name">{label}</span>
              <span class="num week-day-num">{Number(date.slice(8))}</span>
              <span class="week-day-dot">{dayEntries.length > 0 ? (done ? '✓' : '•') : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ giorno aperto */

function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const dayEntries = entriesOn(date);
  const daySessions = sessions.value.filter((s) => s.date === date);
  const [scopeFor, setScopeFor] = useState<PlanEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const past = date < today();

  if (scopeFor) {
    return <ScopeSheet entry={scopeFor} onClose={() => setScopeFor(null)} />;
  }

  return (
    <Sheet title={formatDateLong(date)} onClose={onClose}>
      {dayEntries.length === 0 && daySessions.length === 0 && (
        <p class="sub">Giorno di riposo. Puoi comunque metterci una scheda.</p>
      )}

      {dayEntries.map((entry) => {
        const workout = workouts.value.find((w) => w.id === entry.workoutId);
        return (
          <div key={entry.id} class="card">
            <div class="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{workout?.name ?? 'scheda eliminata'}</b>
                <div class="sub num">
                  {entry.status === 'fatto' ? 'fatto' : entry.status === 'saltato' ? 'saltato' : 'previsto'}
                  {workout && ` · ${workout.items.length} esercizi`}
                </div>
              </div>
            </div>

            <div class="stack" style={{ marginTop: '10px' }}>
              {entry.status !== 'fatto' && workout && (
                <button class="btn" type="button" onClick={() => void startOrResume(workout.id)}>
                  {date === today() ? 'Inizia allenamento' : 'Allenati comunque'}
                </button>
              )}
              {workout && (
                <button class="btn btn-ghost" type="button" onClick={() => setScopeFor(entry)}>
                  Modifica la scheda
                </button>
              )}
              {entry.status === 'previsto' && past && (
                <button class="btn btn-ghost" type="button" onClick={() => void skipEntry(entry.id)}>
                  Segna come saltato
                </button>
              )}
              {entry.status !== 'previsto' && (
                <button class="btn btn-ghost" type="button" onClick={() => void resetEntry(entry.id)}>
                  Rimetti fra le previste
                </button>
              )}
              <button class="btn btn-ghost btn-danger" type="button" onClick={() => void deleteEntry(entry.id)}>
                Togli dal piano
              </button>
            </div>
          </div>
        );
      })}

      {daySessions.map((s) => (
        <div key={s.id} class="card">
          <b>{s.name}</b>
          <div class="sub num">allenamento registrato · {s.entries.length} esercizi</div>
        </div>
      ))}

      {adding ? (
        <div class="stack">
          <span class="eyebrow">Quale scheda?</span>
          {workouts.value.map((w) => (
            <button
              key={w.id}
              class="list-row"
              type="button"
              onClick={async () => {
                await addEntry(date, w.id);
                setAdding(false);
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span class="title">{w.name}</span>
                <span class="meta">{w.items.length} esercizi</span>
              </span>
              <span class="pick-mark">+</span>
            </button>
          ))}
        </div>
      ) : (
        <button class="btn btn-ghost" type="button" onClick={() => setAdding(true)}>
          Aggiungi una seduta in questo giorno
        </button>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------ propagazione */

function ScopeSheet({ entry, onClose }: { entry: PlanEntry; onClose: () => void }) {
  const ahead = planEntries(entry.planId).filter(
    (e) => e.workoutId === entry.workoutId && e.date > entry.date && e.status === 'previsto'
  ).length;

  const go = async (scope: PropagationScope) => {
    const workoutId = await prepareEdit(entry.id, scope);
    if (workoutId) navigate('scheda', workoutId);
  };

  return (
    <Sheet title="Cosa modifichi?" onClose={onClose}>
      <p class="sub">
        Questa scheda è usata anche in {ahead} sedut{ahead === 1 ? 'a' : 'e'} successiv{ahead === 1 ? 'a' : 'e'}.
        Decidi fin dove arrivano le modifiche.
      </p>

      <button class="btn btn-ghost scope-option" type="button" onClick={() => void go('questa')}>
        <b>Solo questa occorrenza</b>
        <span class="sub">Le altre sedute restano come sono</span>
      </button>

      <button class="btn btn-ghost scope-option" type="button" onClick={() => void go('avanti')} disabled={ahead === 0}>
        <b>Da qui in avanti</b>
        <span class="sub">Questa e le {ahead} successive</span>
      </button>

      <button class="btn scope-option" type="button" onClick={() => void go('tutte')}>
        <b>Tutte le occorrenze</b>
        <span class="sub">Anche quelle già passate nel piano</span>
      </button>
    </Sheet>
  );
}

/* ----------------------------------------------------------- blocchi e giorni */

function BlocksSheet({ onClose }: { onClose: () => void }) {
  const plan = activePlan();
  const [, force] = useState(0);
  if (!plan) return null;

  const setBlock = async (index: number, change: Partial<PlanBlock>) => {
    await updatePlan(plan.id, (p) => ({
      ...p,
      blocks: p.blocks.map((b, i) => (i === index ? { ...b, ...change } : b)),
    }));
    await rebuildEntries(plan.id);
    force((n) => n + 1);
  };

  return (
    <Sheet title="Blocchi e giorni" onClose={onClose}>
      <p class="sub">
        Le modifiche valgono da oggi in avanti: quello che hai già fatto o saltato resta nello storico.
      </p>

      {plan.blocks.map((block, index) => (
        <div key={block.id} class="card">
          <input
            class="cell-input"
            style={{ width: '100%', textAlign: 'left' }}
            value={block.name}
            aria-label={`Nome del blocco ${index + 1}`}
            onInput={(e) => void setBlock(index, { name: (e.target as HTMLInputElement).value })}
          />
          <div style={{ marginTop: '10px' }}>
            <Stepper
              label="Settimane"
              value={block.weeks}
              min={1}
              max={52}
              onChange={(weeks) => void setBlock(index, { weeks })}
            />
          </div>

          <span class="eyebrow" style={{ display: 'block', marginTop: '12px' }}>
            Giorni della settimana
          </span>
          <div class="stack" style={{ marginTop: '8px' }}>
            {WEEKDAYS.map((label, dayIndex) => (
              <div key={label} class="row">
                <span class="num" style={{ width: '38px', color: 'var(--drone)' }}>
                  {label}
                </span>
                <select
                  class="cell-input"
                  style={{ flex: 1, textAlign: 'left' }}
                  value={block.weekPattern[dayIndex] ?? ''}
                  onChange={(e) => {
                    const value = (e.target as HTMLSelectElement).value || null;
                    const weekPattern = [...block.weekPattern];
                    weekPattern[dayIndex] = value;
                    void setBlock(index, { weekPattern });
                  }}
                >
                  <option value="">riposo</option>
                  {workouts.value.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        class="btn btn-ghost"
        type="button"
        onClick={async () => {
          await updatePlan(plan.id, (p) => ({
            ...p,
            blocks: [...p.blocks, emptyBlock(`Blocco ${p.blocks.length + 1}`)],
          }));
          await rebuildEntries(plan.id);
          force((n) => n + 1);
        }}
      >
        Aggiungi un blocco
      </button>
    </Sheet>
  );
}

/* -------------------------------------------------------------- creazione */

function PlanWizard({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(`Stagione ${new Date().getFullYear()}`);
  const [start, setStart] = useState(startOfWeek(today()));
  const [weeks, setWeeks] = useState(12);
  const [pattern, setPattern] = useState<(string | null)[]>([null, null, null, null, null, null, null]);
  const list = workouts.value;

  const chosen = pattern.filter(Boolean).length;

  return (
    <Sheet title="Nuovo piano" onClose={onClose}>
      <label class="form-row">
        <span class="stepper-label">Nome</span>
        <input
          class="cell-input"
          style={{ flex: 1, textAlign: 'left' }}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </label>

      <label class="form-row">
        <span class="stepper-label">Si parte il</span>
        <input
          class="cell-input"
          type="date"
          value={start}
          onInput={(e) => setStart((e.target as HTMLInputElement).value)}
        />
      </label>

      <Stepper label="Settimane del primo blocco" value={weeks} min={1} max={52} onChange={setWeeks} />

      <span class="eyebrow" style={{ marginTop: '4px' }}>
        Che cosa fai in settimana
      </span>
      <div class="stack">
        {WEEKDAYS.map((label, i) => (
          <div key={label} class="row">
            <span class="num" style={{ width: '38px', color: 'var(--drone)' }}>
              {label}
            </span>
            <select
              class="cell-input"
              style={{ flex: 1, textAlign: 'left' }}
              value={pattern[i] ?? ''}
              onChange={(e) => {
                const next = [...pattern];
                next[i] = (e.target as HTMLSelectElement).value || null;
                setPattern(next);
              }}
            >
              <option value="">riposo</option>
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        class="btn"
        type="button"
        disabled={chosen === 0 || !name.trim()}
        onClick={async () => {
          await createPlan(name.trim(), start, [
            { ...emptyBlock('Blocco 1', weeks), weekPattern: pattern },
          ]);
          onClose();
        }}
      >
        {chosen === 0 ? 'Scegli almeno un giorno' : `Crea il piano · ${chosen * weeks} sedute`}
      </button>
    </Sheet>
  );
}
