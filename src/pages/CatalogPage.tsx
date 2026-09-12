import { useEffect, useMemo } from 'preact/hooks';
import { VirtualList } from '../components/VirtualList';
import { navigate } from '../router';
import {
  MEDIA_ATTRIBUTION,
  catalogError,
  catalogState,
  exercises,
  filterExercises,
  label,
  muscleLabel,
  taxonomy,
  thumbUrl,
} from '../services/catalog';
import * as f from '../stores/catalogFilters';
import { favorites } from '../stores/favorites';
import { pick, pickedNow, pickerWorkoutId, pickerWorkoutName, stopPicking } from '../stores/picker';
import type { Exercise } from '../types';

const ROW_HEIGHT = 84; // riga 76px + 8 di gap: deve restare allineato al CSS

function Thumb({ id }: { id: string }) {
  const url = thumbUrl(id);
  if (!url) {
    return (
      <div class="media media-placeholder" style={{ width: '56px' }} aria-hidden="true">
        GIF
      </div>
    );
  }
  return (
    <img
      class="media"
      style={{ width: '56px' }}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      width="56"
      height="56"
    />
  );
}

export function CatalogPage() {
  const all = exercises.value;
  const tax = taxonomy.value;
  const favs = favorites.value;

  const query = f.query.value;
  const bodyPart = f.bodyPart.value;
  const equipment = f.equipment.value;
  const onlyFavorites = f.onlyFavorites.value;

  const results = useMemo(() => {
    const base = filterExercises(all, { query, bodyPart, equipment });
    return onlyFavorites ? base.filter((e) => favs.includes(e.id)) : base;
  }, [all, query, bodyPart, equipment, onlyFavorites, favs]);

  // Torni dal dettaglio e la lista riparte da dove eri.
  useEffect(() => {
    if (f.scrollY.value) window.scrollTo(0, f.scrollY.value);
  }, []);

  const picking = pickerWorkoutId.value !== null;
  const picked = pickedNow.value;

  // In modalità scelta toccare una riga aggiunge alla scheda invece di aprire
  // il dettaglio: si resta nella lista e se ne aggiungono cinque di fila.
  const tapRow = (id: string) => {
    if (picking) {
      void pick(id);
      return;
    }
    f.scrollY.value = window.scrollY;
    navigate('esercizio', id);
  };

  if (catalogState.value === 'error') {
    return (
      <main class="page">
        <h1>Catalogo</h1>
        <div class="card">
          <p>Non riesco a caricare il catalogo degli esercizi.</p>
          <p class="sub">{catalogError.value}</p>
          <p class="sub">
            Se è la prima volta che apri l'app serve una connessione: da lì in poi funziona offline.
          </p>
        </div>
      </main>
    );
  }

  if (catalogState.value !== 'ready' || !tax) {
    return (
      <main class="page">
        <h1>Catalogo</h1>
        <p class="empty">Carico i 1.324 esercizi…</p>
      </main>
    );
  }

  return (
    <main class="page">
      {picking ? (
        <div class="picker-bar">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span class="eyebrow" style={{ color: 'var(--honey)' }}>Aggiungi a</span>
            <span class="picker-target">{pickerWorkoutName()}</span>
            <span class="sub num">
              {picked.length === 0 ? 'tocca un esercizio' : `${picked.length} aggiunt${picked.length === 1 ? 'o' : 'i'}`}
            </span>
          </span>
          <button class="btn" style={{ width: 'auto', minHeight: '48px' }} type="button" onClick={stopPicking}>
            Fine
          </button>
        </div>
      ) : (
        <div class="page-head">
          <h1>Catalogo</h1>
          <span class="sub">{all.length} esercizi · cerca in italiano o in inglese</span>
        </div>
      )}

      <div class="field">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--drone)"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id="catalog-search"
          type="search"
          placeholder="panca piana, squat, curl…"
          value={query}
          onInput={(e) => (f.query.value = (e.target as HTMLInputElement).value)}
          aria-label="Cerca un esercizio"
        />
      </div>

      <div class="chips" role="group" aria-label="Filtra per parte del corpo">
        <button
          type="button"
          class="chip"
          aria-pressed={onlyFavorites}
          onClick={() => (f.onlyFavorites.value = !onlyFavorites)}
        >
          ★ Preferiti {favs.length > 0 && <span class="sub" style={{ marginLeft: '6px' }}>{favs.length}</span>}
        </button>
        {tax.bodyParts.map((t) => (
          <button
            key={t.key}
            type="button"
            class="chip"
            aria-pressed={bodyPart === t.key}
            onClick={() => (f.bodyPart.value = bodyPart === t.key ? undefined : t.key)}
          >
            {t.label}
            <span class="sub" style={{ marginLeft: '6px' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div class="chips" role="group" aria-label="Filtra per attrezzo">
        {tax.equipment.slice(0, 14).map((t) => (
          <button
            key={t.key}
            type="button"
            class="chip"
            aria-pressed={equipment === t.key}
            onClick={() => (f.equipment.value = equipment === t.key ? undefined : t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div class="row">
        <span class="sub num" style={{ flex: 1 }}>
          {results.length} risultat{results.length === 1 ? 'o' : 'i'}
        </span>
        {f.hasFilters() && (
          <button class="chip" type="button" onClick={() => f.clearFilters()}>
            Azzera filtri
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p class="empty">
          {onlyFavorites && favs.length === 0
            ? 'Non hai ancora preferiti. Aprine uno e tocca la stella.'
            : 'Nessun esercizio con questi filtri. Prova a togliere qualcosa.'}
        </p>
      ) : (
        <VirtualList
          items={results}
          rowHeight={ROW_HEIGHT}
          renderRow={(e: Exercise) => (
            <div key={e.id} style={{ height: `${ROW_HEIGHT}px`, paddingBottom: '8px' }}>
              <button class="list-row" type="button" style={{ height: '76px' }} onClick={() => tapRow(e.id)}>
                <Thumb id={e.id} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span class="title">{e.name}</span>
                  <span class="meta">
                    {label('equipment', e.eq)} · {muscleLabel(e.tg)}
                  </span>
                </span>
                {picking ? (
                  <span class={picked.includes(e.id) ? 'pick-mark added' : 'pick-mark'} aria-hidden="true">
                    {picked.includes(e.id) ? '✓' : '+'}
                  </span>
                ) : (
                  favs.includes(e.id) && (
                    <span style={{ color: 'var(--honey)', fontSize: '15px' }} aria-label="Nei preferiti">
                      ★
                    </span>
                  )
                )}
              </button>
            </div>
          )}
        />
      )}

      <p class="attribution">{MEDIA_ATTRIBUTION}</p>
    </main>
  );
}
