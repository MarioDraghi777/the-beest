import { useState } from 'preact/hooks';
import { Sheet } from '../components/Sheet';
import { ShareSheet } from '../components/ShareSheet';
import { Stepper } from '../components/Stepper';
import { goBack, navigate } from '../router';
import { label as taxLabel, taxonomy } from '../services/catalog';
import { workoutPayload } from '../services/shareCodec';
import { summary } from '../services/workoutFormat';
import { startPicking } from '../stores/picker';
import { active, startOrResume } from '../stores/session';
import {
  countSets,
  createCustomExercise,
  customExercises,
  deleteWorkout,
  estimateMinutes,
  getWorkout,
  moveItem,
  refName,
  removeItem,
  replaceItem,
  updateWorkout,
  workouts,
} from '../stores/workouts';
import type { LoadUnit, WorkoutItem } from '../types';

const UNITS: LoadUnit[] = ['kg', 'lb', 'corpo', 'elastico'];
const SUPERSETS = ['A', 'B', 'C', 'D'];

export function WorkoutEditPage({ id }: { id: string }) {
  workouts.value; // dipendenza esplicita: il signal rirende la pagina
  const workout = getWorkout(id);

  const [editing, setEditing] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!workout) {
    return (
      <main class="page">
        <button class="btn btn-ghost" type="button" onClick={() => goBack('schede')}>
          Indietro
        </button>
        <p class="empty">Questa scheda non esiste più.</p>
      </main>
    );
  }

  const item = editing != null ? workout.items[editing] : undefined;
  const patch = (change: Partial<WorkoutItem>) => {
    if (editing == null || !item) return;
    void replaceItem(id, editing, { ...item, ...change });
  };

  return (
    <main class="page">
      <div class="row">
        <button class="icon-btn" type="button" onClick={() => goBack('schede')} aria-label="Torna alle schede">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <span class="sub num" style={{ flex: 1 }}>
          {workout.items.length} esercizi · {countSets(workout)} serie · ~{estimateMinutes(workout)}′
        </span>
        <button
          class="icon-btn"
          type="button"
          onClick={() => setSharing(true)}
          aria-label="Condividi la scheda"
          disabled={workout.items.length === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        </button>
        <button
          class="icon-btn"
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Elimina la scheda"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
          </svg>
        </button>
      </div>

      <input
        class="title-input"
        value={workout.name}
        aria-label="Nome della scheda"
        onInput={(e) => {
          const name = (e.target as HTMLInputElement).value;
          void updateWorkout(id, (w) => ({ ...w, name }));
        }}
      />

      <textarea
        class="notes-input"
        placeholder="Note della scheda (riscaldamento, obiettivo del blocco…)"
        value={workout.notes ?? ''}
        rows={2}
        onInput={(e) => {
          const notes = (e.target as HTMLTextAreaElement).value;
          void updateWorkout(id, (w) => ({ ...w, notes }));
        }}
      />

      {workout.items.length === 0 ? (
        <p class="empty">Scheda vuota. Aggiungi il primo esercizio qui sotto.</p>
      ) : (
        <div class="stack">
          {workout.items.map((it, index) => (
            <div key={index} class="card item-row">
              <div class="item-order">
                {it.supersetGroup ? (
                  <span class="superset-tag">{it.supersetGroup}</span>
                ) : (
                  <span class="num">{index + 1}</span>
                )}
              </div>

              <button class="item-main" type="button" onClick={() => setEditing(index)}>
                <span class="item-name">{refName(it.ref)}</span>
                <span class="num item-summary">{summary(it)}</span>
                {it.notes && <span class="sub item-note">{it.notes}</span>}
              </button>

              <div class="item-move">
                <button
                  class="icon-btn small"
                  type="button"
                  aria-label="Sposta su"
                  disabled={index === 0}
                  onClick={() => void moveItem(id, index, -1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="m6 15 6-6 6 6" />
                  </svg>
                </button>
                <button
                  class="icon-btn small"
                  type="button"
                  aria-label="Sposta giù"
                  disabled={index === workout.items.length - 1}
                  onClick={() => void moveItem(id, index, 1)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {workout.items.length > 0 && (
        <button class="btn" type="button" onClick={() => void startOrResume(id)}>
          {active.value ? "Torna all'allenamento" : 'Inizia allenamento'}
        </button>
      )}
      <button class="btn btn-ghost" type="button" onClick={() => startPicking(id)}>
        Aggiungi dal catalogo
      </button>
      <button class="btn btn-ghost" type="button" onClick={() => setCustomOpen(true)}>
        Aggiungi un esercizio mio
      </button>

      {/* ------------------------------------------------ modifica di una riga */}
      {item && editing != null && (
        <Sheet title={refName(item.ref)} onClose={() => setEditing(null)}>
          <Stepper label="Serie" value={item.sets} min={1} max={20} onChange={(sets) => patch({ sets })} />

          <label class="form-row">
            <span class="stepper-label">Ripetizioni</span>
            <input
              class="cell-input"
              value={item.reps}
              placeholder="8-10, max, 30s"
              onInput={(e) => patch({ reps: (e.target as HTMLInputElement).value })}
            />
          </label>

          <label class="form-row">
            <span class="stepper-label">Carico</span>
            <span class="row" style={{ gap: '8px' }}>
              <input
                class="cell-input"
                type="number"
                inputMode="decimal"
                step="0.5"
                style={{ width: '86px' }}
                value={item.load ?? ''}
                placeholder="—"
                onInput={(e) => {
                  const raw = (e.target as HTMLInputElement).value;
                  patch({ load: raw === '' ? undefined : Number(raw) });
                }}
              />
              <select
                class="cell-input"
                value={item.loadUnit ?? 'kg'}
                onChange={(e) => patch({ loadUnit: (e.target as HTMLSelectElement).value as LoadUnit })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <Stepper
            label="Recupero"
            value={item.restSec ?? 90}
            step={15}
            min={0}
            max={600}
            unit="s"
            onChange={(restSec) => patch({ restSec })}
          />

          <label class="form-row">
            <span class="stepper-label">Tempo</span>
            <input
              class="cell-input"
              value={item.tempo ?? ''}
              placeholder="3-0-1-0"
              onInput={(e) => patch({ tempo: (e.target as HTMLInputElement).value || undefined })}
            />
          </label>

          <div class="form-row">
            <span class="stepper-label">Superset</span>
            <div class="chips" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                class="chip"
                aria-pressed={!item.supersetGroup}
                onClick={() => patch({ supersetGroup: undefined })}
              >
                nessuno
              </button>
              {SUPERSETS.map((g) => (
                <button
                  key={g}
                  type="button"
                  class="chip"
                  aria-pressed={item.supersetGroup === g}
                  onClick={() => patch({ supersetGroup: g })}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <textarea
            class="notes-input"
            placeholder="Note dell'esercizio (presa, macchina, assetto…)"
            rows={2}
            value={item.notes ?? ''}
            onInput={(e) => patch({ notes: (e.target as HTMLTextAreaElement).value || undefined })}
          />

          <div class="row" style={{ gap: '8px', marginTop: '6px' }}>
            {item.ref.type === 'catalog' && (
              <button
                class="btn btn-ghost"
                type="button"
                onClick={() => {
                  setEditing(null);
                  navigate('esercizio', item.ref.id);
                }}
              >
                Vedi esecuzione
              </button>
            )}
            <button
              class="btn btn-ghost btn-danger"
              type="button"
              onClick={() => {
                void removeItem(id, editing);
                setEditing(null);
              }}
            >
              Togli dalla scheda
            </button>
          </div>
        </Sheet>
      )}

      {/* -------------------------------------------------- esercizio custom */}
      {customOpen && (
        <CustomExerciseSheet
          onClose={() => setCustomOpen(false)}
          onCreate={async (name, bp, eq) => {
            const custom = await createCustomExercise({ name, bp, eq });
            await updateWorkout(id, (w) => ({
              ...w,
              items: [...w.items, { ref: { type: 'custom', id: custom.id }, sets: 3, reps: '10', restSec: 90, loadUnit: 'kg' }],
            }));
            setCustomOpen(false);
          }}
        />
      )}

      {sharing && (
        <ShareSheet
          payload={workoutPayload(workout, customExercises.value)}
          title={workout.name}
          onClose={() => setSharing(false)}
        />
      )}

      {/* --------------------------------------------------------- eliminazione */}
      {confirmDelete && (
        <Sheet title="Eliminare la scheda?" onClose={() => setConfirmDelete(false)}>
          <p>
            «{workout.name}» verrà cancellata con i suoi {workout.items.length} esercizi. Non si torna
            indietro.
          </p>
          <button
            class="btn btn-danger-solid"
            type="button"
            onClick={async () => {
              await deleteWorkout(id);
              navigate('schede');
            }}
          >
            Elimina la scheda
          </button>
          <button class="btn btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>
            Annulla
          </button>
        </Sheet>
      )}
    </main>
  );
}

function CustomExerciseSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, bp?: string, eq?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [bp, setBp] = useState<string | undefined>();
  const [eq, setEq] = useState<string | undefined>();
  const tax = taxonomy.value;

  return (
    <Sheet title="Esercizio mio" onClose={onClose}>
      <p class="sub">Per quello che in palestra c'è e nel catalogo no.</p>
      <input
        class="cell-input"
        style={{ width: '100%' }}
        placeholder="Nome dell'esercizio"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />

      {tax && (
        <>
          <span class="eyebrow" style={{ marginTop: '4px' }}>
            Parte del corpo
          </span>
          <div class="chips">
            {tax.bodyParts.map((t) => (
              <button
                key={t.key}
                type="button"
                class="chip"
                aria-pressed={bp === t.key}
                onClick={() => setBp(bp === t.key ? undefined : t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span class="eyebrow" style={{ marginTop: '4px' }}>
            Attrezzo
          </span>
          <div class="chips">
            {tax.equipment.slice(0, 10).map((t) => (
              <button
                key={t.key}
                type="button"
                class="chip"
                aria-pressed={eq === t.key}
                onClick={() => setEq(eq === t.key ? undefined : t.key)}
              >
                {taxLabel('equipment', t.key)}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        class="btn"
        type="button"
        disabled={name.trim().length < 2}
        onClick={() => void onCreate(name.trim(), bp, eq)}
      >
        Aggiungi alla scheda
      </button>
    </Sheet>
  );
}
