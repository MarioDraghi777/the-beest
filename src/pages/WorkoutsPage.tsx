import { navigate } from '../router';
import { startOrResume } from '../stores/session';
import {
  countSets,
  createWorkout,
  duplicateWorkout,
  estimateMinutes,
  refName,
  workouts,
  workoutsLoaded,
} from '../stores/workouts';

export function WorkoutsPage() {
  const list = workouts.value;

  const nuova = async () => {
    const w = await createWorkout();
    navigate('scheda', w.id);
  };

  return (
    <main class="page">
      <div class="page-head">
        <h1>Schede</h1>
        <span class="sub">
          {list.length === 0 ? 'Nessuna scheda' : `${list.length} sched${list.length === 1 ? 'a' : 'e'}`}
        </span>
      </div>

      <button class="btn" type="button" onClick={() => void nuova()}>
        Nuova scheda
      </button>
      <button class="btn btn-ghost" type="button" onClick={() => navigate('importa')}>
        Importa da testo, file o foto
      </button>

      {!workoutsLoaded.value && <p class="empty">Carico…</p>}

      {workoutsLoaded.value && list.length === 0 && (
        <div class="card card-hero">
          <span class="eyebrow">Da dove si comincia</span>
          <p style={{ margin: '10px 0 0' }}>
            Crea una scheda vuota e riempila con gli esercizi del catalogo, oppure aggiungi i tuoi.
          </p>
          <p class="sub" style={{ margin: '8px 0 0' }}>
            Oppure importane una: incolla il testo che ti ha mandato l'allenatore, o fotografala.
          </p>
        </div>
      )}

      <div class="stack">
        {list.map((w) => (
          <div key={w.id} class="card workout-card">
            <button class="workout-open" type="button" onClick={() => navigate('scheda', w.id)}>
              <span class="workout-title">{w.name}</span>
              <span class="sub num">
                {w.items.length} esercizi · {countSets(w)} serie · ~{estimateMinutes(w)}′
              </span>
              {w.items.length > 0 && (
                <span class="workout-preview">
                  {w.items.slice(0, 3).map((i) => refName(i.ref)).join(' · ')}
                  {w.items.length > 3 && ` · +${w.items.length - 3}`}
                </span>
              )}
            </button>
            <button
              class="icon-btn"
              type="button"
              aria-label={`Duplica ${w.name}`}
              onClick={() => void duplicateWorkout(w.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h8" />
              </svg>
            </button>
            {w.items.length > 0 && (
              <button
                class="icon-btn start"
                type="button"
                aria-label={`Inizia ${w.name}`}
                onClick={() => void startOrResume(w.id)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
