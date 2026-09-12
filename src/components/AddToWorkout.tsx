import { useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { navigate } from '../router';
import { addItem, countSets, createWorkout, workouts } from '../stores/workouts';

/**
 * "Aggiungi a scheda" dal dettaglio esercizio: apre l'elenco delle schede e
 * aggiunge senza far uscire dalla pagina. Se non ce n'è nessuna, la crea.
 */
export function AddToWorkout({ exerciseId }: { exerciseId: string }) {
  const [open, setOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const list = workouts.value;

  const addTo = async (workoutId: string, name: string) => {
    await addItem(workoutId, { type: 'catalog', id: exerciseId });
    setAddedTo(name);
    setOpen(false);
  };

  const creaEAggiungi = async () => {
    const w = await createWorkout();
    await addItem(w.id, { type: 'catalog', id: exerciseId });
    setOpen(false);
    navigate('scheda', w.id);
  };

  return (
    <>
      <button class="btn" type="button" onClick={() => setOpen(true)}>
        {addedTo ? `Aggiunto a ${addedTo}` : 'Aggiungi a scheda'}
      </button>

      {open && (
        <Sheet title="In quale scheda?" onClose={() => setOpen(false)}>
          {list.length === 0 && (
            <p class="sub">Non hai ancora schede. Ne creo una e ci metto dentro questo esercizio.</p>
          )}

          <div class="stack">
            {list.map((w) => (
              <button key={w.id} class="list-row" type="button" onClick={() => void addTo(w.id, w.name)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span class="title">{w.name}</span>
                  <span class="meta">
                    {w.items.length} esercizi · {countSets(w)} serie
                  </span>
                </span>
                <span class="pick-mark">+</span>
              </button>
            ))}
          </div>

          <button class="btn btn-ghost" type="button" onClick={() => void creaEAggiungi()}>
            Nuova scheda con questo esercizio
          </button>
        </Sheet>
      )}
    </>
  );
}
