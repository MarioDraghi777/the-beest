import { useEffect, useState } from 'preact/hooks';
import { HexBadge } from '../components/HexBadge';
import { goBack } from '../router';
import {
  MEDIA_ATTRIBUTION,
  animUrl,
  catalogState,
  getExercise,
  label,
  muscleLabel,
} from '../services/catalog';
import { favorites, toggleFavorite } from '../stores/favorites';
import { pick, pickedNow, pickerWorkoutId, pickerWorkoutName } from '../stores/picker';
import { AddToWorkout } from '../components/AddToWorkout';

interface Props {
  id: string;
}

/** L'animazione: 29 KB scaricati solo qui, mai nella lista. */
function Animation({ id, name }: { id: string; name: string }) {
  const url = animUrl(id);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div class="exercise-media media media-placeholder">
        {failed ? 'animazione non disponibile' : 'media non configurati'}
      </div>
    );
  }
  return (
    <img
      class="exercise-media media"
      src={url}
      alt={`Animazione dell'esercizio ${name}`}
      width="180"
      height="180"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ExercisePage({ id }: Props) {
  const ready = catalogState.value === 'ready';
  const exercise = ready ? getExercise(id) : undefined;
  const fav = favorites.value.includes(id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!ready) {
    return (
      <main class="page">
        <p class="empty">Carico…</p>
      </main>
    );
  }

  if (!exercise) {
    return (
      <main class="page">
        <button class="btn btn-ghost" type="button" onClick={() => goBack()}>
          Indietro
        </button>
        <p class="empty">Questo esercizio non esiste nel catalogo.</p>
      </main>
    );
  }

  const secondary = exercise.sm.filter((m) => m !== exercise.tg && m !== exercise.mg);

  return (
    <main class="page">
      <div class="row">
        <button class="icon-btn" type="button" onClick={() => goBack()} aria-label="Torna indietro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <span class="sub num" style={{ flex: 1 }}>
          {exercise.id}
        </span>
        <button
          class="icon-btn"
          type="button"
          aria-pressed={fav}
          aria-label={fav ? 'Togli dai preferiti' : 'Salva nei preferiti'}
          onClick={() => void toggleFavorite(id)}
        >
          <svg
            viewBox="0 0 24 24"
            fill={fav ? 'var(--honey)' : 'none'}
            stroke={fav ? 'var(--honey)' : 'currentColor'}
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.3-5.5-3-5.5 3 1-6.3L3 9.6l6.3-.9z" />
          </svg>
        </button>
      </div>

      <Animation id={exercise.id} name={exercise.name} />
      <p class="attribution">{MEDIA_ATTRIBUTION}</p>

      <div class="page-head">
        <h1>{exercise.name}</h1>
        <span class="sub">
          {label('bodyParts', exercise.bp)} · {label('equipment', exercise.eq)}
        </span>
      </div>

      <div class="badges">
        <HexBadge label={muscleLabel(exercise.tg)} role="TARGET" />
        {exercise.mg !== exercise.tg && <HexBadge label={muscleLabel(exercise.mg)} role="SINERG." />}
        {secondary.map((m) => (
          <HexBadge key={m} label={muscleLabel(m)} role="SEC." muted />
        ))}
      </div>

      <div class="card">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Esecuzione
        </span>
        <ol class="steps">
          {exercise.st.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      {pickerWorkoutId.value ? (
        <button
          class="btn"
          type="button"
          disabled={pickedNow.value.includes(id)}
          onClick={() => void pick(id)}
        >
          {pickedNow.value.includes(id) ? 'Aggiunto' : `Aggiungi a ${pickerWorkoutName()}`}
        </button>
      ) : (
        <AddToWorkout exerciseId={id} />
      )}

      <button class="btn btn-ghost" type="button" onClick={() => void toggleFavorite(id)}>
        {fav ? 'Togli dai preferiti' : 'Salva nei preferiti'}
      </button>
    </main>
  );
}
