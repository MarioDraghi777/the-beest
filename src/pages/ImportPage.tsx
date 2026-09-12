import { useState } from 'preact/hooks';
import { goBack, navigate } from '../router';
import { canonical, exercises, getExercise, label, muscleLabel, thumbUrl } from '../services/catalog';
import { looksLikeHeader, mapColumns, parseCsv } from '../services/csv';
import { matchExercise, type MatchKind } from '../services/importMatch';
import { importPayload } from '../services/importShare';
import { parseWorkoutText, type DraftRow, type DraftWorkout } from '../services/importParser';
import type { WirePayload } from '../services/shareCodec';
import { isBackup, restoreBackup } from '../services/backup';
import { createCustomExercise, createWorkout, customExercises, saveWorkout } from '../stores/workouts';
import type { Exercise, WorkoutItem } from '../types';
import { readOcr, ocrAvailable } from '../services/ocr';

type Source = 'testo' | 'file' | 'foto';

interface ReviewRow extends DraftRow {
  kind: MatchKind;
  candidates: Exercise[];
  /** Scelta dell'utente: esercizio del catalogo, oppure "tienilo mio". */
  chosen: string | null;
  keepCustom: boolean;
}

interface ReviewWorkout {
  name: string;
  rows: ReviewRow[];
}

const ESEMPIO = `Giorno A - Spinta
Panca piana 4x8 60kg rec 90"
Lento avanti 3x10 30kg
Alzate laterali 3x15 8kg rec 45

Giorno B - Trazione
Trazioni 4xmax
Rematore bilanciere 4x10 50kg`;

export function ImportPage() {
  const [source, setSource] = useState<Source>('testo');
  const [text, setText] = useState('');
  const [review, setReview] = useState<ReviewWorkout[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const catalog = exercises.value;
  const canon = canonical.value;

  const analizza = (raw: string) => {
    const drafts = parseWorkoutText(raw);
    if (drafts.length === 0) {
      setMessage('Non ho trovato esercizi in questo testo. Controlla che ogni riga abbia un nome.');
      return;
    }
    setReview(drafts.map((d) => toReview(d, catalog, canon)));
    setMessage(null);
  };

  const apriFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const content = await file.text();

      // JSON: o un backup completo, o una scheda condivisa
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(content) as unknown;
        if (isBackup(parsed)) {
          const report = await restoreBackup(parsed);
          setMessage(
            `Ripristinati ${report.workouts} schede, ${report.sessions} allenamenti e ${report.plans} piani.`
          );
          return;
        }
        const payload = parsed as WirePayload;
        if (payload?.t === 'w' || payload?.t === 'p') {
          await importPayload(payload);
          setMessage('Importato. Lo trovi fra le tue schede.');
          return;
        }
        setMessage('Questo file JSON non è né un backup né una scheda di The Beest.');
        return;
      }

      // CSV
      const rows = parseCsv(content);
      if (rows.length === 0) {
        setMessage('Il file è vuoto.');
        return;
      }
      const hasHeader = looksLikeHeader(rows[0]);
      const cols = hasHeader ? mapColumns(rows[0]) : { name: 0, sets: 1, reps: 2, load: 3 };
      const body = hasHeader ? rows.slice(1) : rows;

      const draft: DraftWorkout = {
        name: file.name.replace(/\.[a-z]+$/i, ''),
        rows: body
          .map((cells): DraftRow => {
            const get = (key: keyof typeof cols) => {
              const index = cols[key];
              return index != null ? (cells[index] ?? '').trim() : '';
            };
            const num = (value: string) => {
              const n = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
              return Number.isFinite(n) && n > 0 ? n : undefined;
            };
            return {
              raw: cells.join(' · '),
              name: get('name'),
              sets: num(get('sets')),
              reps: get('reps') || undefined,
              load: num(get('load')),
              loadUnit: 'kg',
              restSec: num(get('rest')),
              notes: get('notes') || undefined,
            };
          })
          .filter((r) => r.name.length > 1),
      };

      if (draft.rows.length === 0) {
        setMessage('Non ho riconosciuto nessun esercizio. Serve una colonna con i nomi.');
        return;
      }
      setReview([toReview(draft, catalog, canon)]);
    } catch (err) {
      setMessage(`Non riesco a leggere il file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const leggiFoto = async (file: File) => {
    setPhoto(URL.createObjectURL(file));
    setSource('foto');
    setMessage(null);
  };

  const lanciaOcr = async () => {
    if (!photo) return;
    setBusy(true);
    setMessage('Leggo la foto… il primo utilizzo scarica il modello, ci vuole un minuto.');
    try {
      const testo = await readOcr(photo);
      setText(testo);
      setMessage(
        testo.trim()
          ? 'Ho letto questo. Correggi quello che serve e premi «Leggi la scheda».'
          : 'Non sono riuscito a leggere niente. Scrivila a mano qui sotto: i nomi li riconosco lo stesso.'
      );
    } catch (err) {
      setMessage(
        `Lettura automatica non riuscita (${err instanceof Error ? err.message : 'errore'}). ` +
          'Scrivi i nomi a mano qui sotto: il riconoscimento degli esercizi funziona comunque.'
      );
    } finally {
      setBusy(false);
    }
  };

  const salva = async () => {
    if (!review) return;
    setBusy(true);
    let first: string | null = null;

    for (const workout of review) {
      const created = await createWorkout(workout.name || 'Scheda importata');
      const items: WorkoutItem[] = [];

      for (const row of workout.rows) {
        let ref: WorkoutItem['ref'];
        if (row.chosen && !row.keepCustom) {
          ref = { type: 'catalog', id: row.chosen };
        } else {
          const existing = customExercises.value.find(
            (c) => c.name.toLowerCase() === row.name.toLowerCase()
          );
          const custom = existing ?? (await createCustomExercise({ name: row.name }));
          ref = { type: 'custom', id: custom.id };
        }
        items.push({
          ref,
          sets: row.sets ?? 3,
          reps: row.reps ?? '10',
          load: row.load,
          loadUnit: row.loadUnit ?? 'kg',
          restSec: row.restSec ?? 90,
          notes: row.notes,
        });
      }

      await saveWorkout({ ...created, items });
      first ??= created.id;
    }

    setBusy(false);
    if (first) navigate('scheda', first);
  };

  /* ------------------------------------------------------------- revisione */

  if (review) {
    const daConfermare = review.reduce(
      (sum, w) => sum + w.rows.filter((r) => r.kind === 'incerto' && !r.chosen).length,
      0
    );
    const totale = review.reduce((sum, w) => sum + w.rows.length, 0);

    return (
      <main class="page">
        <div class="row">
          <button class="icon-btn" type="button" onClick={() => setReview(null)} aria-label="Torna indietro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <span style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px' }}>Controlla</h1>
            <span class="sub num">
              {totale} esercizi · {daConfermare === 0 ? 'tutti riconosciuti' : `${daConfermare} da confermare`}
            </span>
          </span>
        </div>

        {review.map((workout, wi) => (
          <div key={wi} class="stack">
            <input
              class="title-input"
              style={{ fontSize: '20px' }}
              value={workout.name}
              aria-label="Nome della scheda"
              onInput={(e) => {
                const name = (e.target as HTMLInputElement).value;
                setReview(review.map((w, i) => (i === wi ? { ...w, name } : w)));
              }}
            />
            {workout.rows.map((row, ri) => (
              <ReviewCard
                key={ri}
                row={row}
                onChange={(next) =>
                  setReview(
                    review.map((w, i) =>
                      i !== wi ? w : { ...w, rows: w.rows.map((r, j) => (j === ri ? next : r)) }
                    )
                  )
                }
                onRemove={() =>
                  setReview(
                    review.map((w, i) => (i !== wi ? w : { ...w, rows: w.rows.filter((_, j) => j !== ri) }))
                  )
                }
              />
            ))}
          </div>
        ))}

        <button class="btn" type="button" disabled={busy || totale === 0} onClick={() => void salva()}>
          {busy ? 'Salvo…' : `Crea ${review.length > 1 ? `${review.length} schede` : 'la scheda'}`}
        </button>
      </main>
    );
  }

  /* --------------------------------------------------------------- ingresso */

  return (
    <main class="page">
      <div class="row">
        <button class="icon-btn" type="button" onClick={() => goBack('schede')} aria-label="Torna alle schede">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <h1 style={{ flex: 1, fontSize: '22px' }}>Importa</h1>
      </div>

      <div class="chips" role="group" aria-label="Da dove importi">
        {(['testo', 'file', 'foto'] as Source[]).map((s) => (
          <button
            key={s}
            type="button"
            class="chip"
            aria-pressed={source === s}
            onClick={() => {
              setSource(s);
              setMessage(null);
            }}
          >
            {s === 'testo' ? 'Testo incollato' : s === 'file' ? 'File CSV o JSON' : 'Foto'}
          </button>
        ))}
      </div>

      {message && (
        <div class="card" style={{ borderColor: 'var(--honey)' }}>
          <span class="sub">{message}</span>
        </div>
      )}

      {source === 'testo' && (
        <>
          <p class="sub">
            Incolla la scheda così com'è: da WhatsApp, da un PDF, da un foglio. Leggo serie,
            ripetizioni, carico e recupero, e riconosco i nomi anche in italiano.
          </p>
          <textarea
            class="notes-input"
            style={{ minHeight: '220px', fontFamily: 'var(--font-data)', fontSize: '13px' }}
            placeholder={ESEMPIO}
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
          <button class="btn" type="button" disabled={!text.trim()} onClick={() => analizza(text)}>
            Leggi la scheda
          </button>
          <button class="btn btn-ghost" type="button" onClick={() => setText(ESEMPIO)}>
            Prova con un esempio
          </button>
        </>
      )}

      {source === 'file' && (
        <>
          <p class="sub">
            Un CSV esportato da Excel o Fogli Google, un backup di The Beest, o una scheda ricevuta
            come file.
          </p>
          <label class="btn" style={{ cursor: 'pointer' }}>
            {busy ? 'Leggo…' : 'Scegli il file'}
            <input
              type="file"
              accept=".csv,.json,.txt,text/csv,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void apriFile(file);
              }}
            />
          </label>
          <div class="card">
            <span class="eyebrow">Colonne riconosciute</span>
            <p class="sub" style={{ margin: '8px 0 0' }}>
              esercizio, serie, ripetizioni, carico, recupero, note — in italiano o in inglese, in
              qualunque ordine. Senza intestazione leggo le prime quattro colonne in quest'ordine.
            </p>
          </div>
        </>
      )}

      {source === 'foto' && (
        <>
          <p class="sub">
            Fotografa la scheda cartacea. Puoi provare la lettura automatica, oppure — più veloce e
            più affidabile su una scrittura a mano — ricopiare i nomi guardando la foto: il
            riconoscimento degli esercizi fa il resto.
          </p>
          <label class="btn" style={{ cursor: 'pointer' }}>
            {photo ? 'Cambia foto' : 'Scatta o scegli la foto'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void leggiFoto(file);
              }}
            />
          </label>

          {photo && (
            <>
              <img src={photo} alt="La scheda fotografata" class="photo-preview" />
              {ocrAvailable() && (
                <button class="btn btn-ghost" type="button" disabled={busy} onClick={() => void lanciaOcr()}>
                  {busy ? 'Leggo la foto…' : 'Prova a leggerla in automatico'}
                </button>
              )}
              <textarea
                class="notes-input"
                style={{ minHeight: '180px', fontFamily: 'var(--font-data)', fontSize: '13px' }}
                placeholder={'Ricopia qui, una riga per esercizio:\nPanca piana 4x8 60kg'}
                value={text}
                onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
              />
              <button class="btn" type="button" disabled={!text.trim()} onClick={() => analizza(text)}>
                Leggi la scheda
              </button>
            </>
          )}
        </>
      )}
    </main>
  );
}

/* --------------------------------------------------------------- revisione */

function toReview(draft: DraftWorkout, catalog: Exercise[], canon: Record<string, string>): ReviewWorkout {
  return {
    name: draft.name,
    rows: draft.rows.map((row) => {
      const match = matchExercise(row.name, catalog, canon);
      return {
        ...row,
        kind: match.kind,
        candidates: match.candidates.map((c) => c.exercise),
        // Solo i match automatici partono già scelti: gli incerti li conferma
        // l'utente, altrimenti si ritrova esercizi sbagliati senza saperlo.
        chosen: match.kind === 'automatico' ? match.candidates[0].exercise.id : null,
        keepCustom: match.kind === 'nessuno',
      };
    }),
  };
}

function ReviewCard({
  row,
  onChange,
  onRemove,
}: {
  row: ReviewRow;
  onChange: (row: ReviewRow) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(row.kind === 'incerto' && !row.chosen);
  const scelto = row.chosen ? getExercise(row.chosen) : undefined;

  const stato = row.keepCustom
    ? { testo: 'esercizio tuo', colore: 'var(--drone)' }
    : scelto
      ? row.kind === 'automatico'
        ? { testo: 'riconosciuto', colore: 'var(--go)' }
        : { testo: 'confermato', colore: 'var(--go)' }
      : { testo: 'da confermare', colore: 'var(--honey)' };

  const thumb = scelto ? thumbUrl(scelto.id) : null;

  return (
    <div class={`card review-card${!scelto && !row.keepCustom ? ' pending' : ''}`}>
      <div class="row">
        {thumb ? (
          <img class="media" style={{ width: '48px' }} src={thumb} alt="" width="48" height="48" loading="lazy" />
        ) : (
          <div class="media media-placeholder" style={{ width: '48px' }} aria-hidden="true">
            {row.keepCustom ? 'MIO' : '?'}
          </div>
        )}
        <button class="item-main" type="button" onClick={() => setOpen(!open)}>
          <span class="item-name">{scelto?.name ?? row.name}</span>
          <span class="num item-summary">
            {row.sets ?? 3}×{row.reps ?? '10'}
            {row.load != null && ` · ${row.load} kg`}
            {row.restSec != null && ` · rec ${row.restSec}″`}
          </span>
          <span class="sub" style={{ color: stato.colore }}>
            {stato.testo}
            {scelto && ` · ${label('equipment', scelto.eq)} · ${muscleLabel(scelto.tg)}`}
          </span>
        </button>
        <button class="icon-btn small" type="button" onClick={onRemove} aria-label="Togli questa riga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {open && (
        <div class="stack" style={{ marginTop: '10px' }}>
          <span class="eyebrow">Dalla tua scheda: «{row.raw}»</span>
          {row.candidates.length === 0 && (
            <span class="sub">Nessun esercizio del catalogo somiglia a questo nome.</span>
          )}
          {row.candidates.map((candidate) => (
            <button
              key={candidate.id}
              class="list-row"
              type="button"
              onClick={() => onChange({ ...row, chosen: candidate.id, keepCustom: false })}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span class="title">{candidate.name}</span>
                <span class="meta">
                  {label('equipment', candidate.eq)} · {muscleLabel(candidate.tg)}
                </span>
              </span>
              <span class={row.chosen === candidate.id ? 'pick-mark added' : 'pick-mark'}>
                {row.chosen === candidate.id ? '✓' : '+'}
              </span>
            </button>
          ))}
          <button
            class="btn btn-ghost"
            type="button"
            onClick={() => onChange({ ...row, chosen: null, keepCustom: true })}
          >
            Tienilo come esercizio mio
          </button>
        </div>
      )}
    </div>
  );
}
