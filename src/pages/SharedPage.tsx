import { useEffect, useState } from 'preact/hooks';
import { navigate } from '../router';
import { MEDIA_ATTRIBUTION, catalogState, getExercise, thumbUrl } from '../services/catalog';
import { importPayload } from '../services/importShare';
import { WEEKDAYS } from '../services/planMath';
import {
  countWireSets,
  decodePayload,
  describeItem,
  type WirePayload,
  type WireSharedPlan,
  type WireSharedWorkout,
} from '../services/shareCodec';

/**
 * Quello che vede chi riceve il link: la scheda in sola lettura, con le
 * animazioni, e un bottone per portarsela nella propria app. Nessuna
 * registrazione, nessuna installazione — è la promessa della condivisione.
 */
export function SharedPage({ code }: { code: string }) {
  const [payload, setPayload] = useState<WirePayload | null | 'loading' | 'error'>('loading');
  const [imported, setImported] = useState(false);
  const ready = catalogState.value === 'ready';

  useEffect(() => {
    void decodePayload(code).then((p) => setPayload(p ?? 'error'));
  }, [code]);

  if (payload === 'loading' || !ready) {
    return (
      <main class="page">
        <p class="empty">Apro il link…</p>
      </main>
    );
  }

  if (payload === 'error' || payload === null) {
    return (
      <main class="page">
        <div class="page-head">
          <h1>Link non valido</h1>
          <span class="sub">Forse è stato troncato durante l'invio.</span>
        </div>
        <p class="sub">
          Chiedi a chi te l'ha mandato di rimandarlo per intero, oppure di esportare la scheda come
          file.
        </p>
        <button class="btn" type="button" onClick={() => navigate('oggi')}>
          Apri The Beest
        </button>
      </main>
    );
  }

  const title = payload.n;

  const doImport = async () => {
    await importPayload(payload);
    setImported(true);
  };

  return (
    <main class="page">
      <div class="row" style={{ gap: '9px' }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="28" height="28" alt="" style={{ borderRadius: '6px' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontVariationSettings: "'wdth' 122, 'wght' 800", fontSize: '17px' }}>
          The Beest
        </span>
      </div>

      <div class="card shared-head">
        <span class="sub">Ti hanno condiviso {payload.t === 'w' ? 'una scheda' : 'un piano'}</span>
        <h1 style={{ fontSize: '22px', marginTop: '4px' }}>{title}</h1>
        {payload.t === 'w' ? (
          <div class="sub num" style={{ marginTop: '2px' }}>
            {payload.i.length} esercizi · {countWireSets(payload.i)} serie
          </div>
        ) : (
          <div class="sub num" style={{ marginTop: '2px' }}>
            {payload.b.reduce((s, b) => s + b.w, 0)} settimane · {payload.b.length} blocchi ·{' '}
            {payload.ws.length} schede
          </div>
        )}
      </div>

      {payload.t === 'w' ? <SharedWorkout wire={payload} /> : <SharedPlan wire={payload} />}

      {imported ? (
        <>
          <div class="card" style={{ borderColor: 'var(--go)' }}>
            <b>Importato.</b>
            <div class="sub">
              {payload.t === 'w' ? 'La scheda è fra le tue.' : 'Il piano parte dal lunedì di questa settimana.'}
            </div>
          </div>
          <button class="btn" type="button" onClick={() => navigate(payload.t === 'w' ? 'schede' : 'piano')}>
            {payload.t === 'w' ? 'Vai alle schede' : 'Vai al piano'}
          </button>
        </>
      ) : (
        <>
          <button class="btn" type="button" onClick={() => void doImport()}>
            Importa nella mia app
          </button>
          <button class="btn btn-ghost" type="button" onClick={() => navigate('oggi')}>
            Solo guardare, grazie
          </button>
        </>
      )}

      <p class="attribution">{MEDIA_ATTRIBUTION}</p>
    </main>
  );
}

function SharedWorkout({ wire }: { wire: WireSharedWorkout }) {
  return (
    <div class="stack">
      {wire.d && <p class="sub">{wire.d}</p>}
      {wire.i.map((item, i) => {
        const exercise = item.e ? getExercise(item.e) : undefined;
        const thumb = item.e ? thumbUrl(item.e) : null;
        return (
          <div key={i} class="card row" style={{ padding: '10px' }}>
            {thumb ? (
              <img class="media" style={{ width: '54px' }} src={thumb} alt="" width="54" height="54" loading="lazy" />
            ) : (
              <div class="media media-placeholder" style={{ width: '54px' }} aria-hidden="true">
                {item.e ? 'GIF' : 'MIO'}
              </div>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span class="title">{exercise?.name ?? item.x ?? `esercizio ${item.e}`}</span>
              <span class="meta">{describeItem(item)}</span>
              {item.n && <span class="sub item-note">{item.n}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SharedPlan({ wire }: { wire: WireSharedPlan }) {
  return (
    <div class="stack">
      {wire.b.map((block, i) => (
        <div key={i} class="card">
          <b>
            {i + 1} · {block.n}
          </b>
          <div class="sub num">{block.w} settimane</div>
          <div class="week-strip" style={{ marginTop: '10px' }}>
            {WEEKDAYS.map((label, day) => {
              const index = block.p[day];
              const workout = index != null ? wire.ws[index] : undefined;
              return (
                <div key={label} class={`week-day${workout ? ' done' : ''}`} style={{ cursor: 'default' }}>
                  <span class="week-day-name">{label}</span>
                  <span class="week-day-dot" style={{ fontSize: '9px' }}>
                    {workout ? '●' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <span class="eyebrow">Le schede</span>
      {wire.ws.map((w, i) => (
        <div key={i} class="card">
          <b>{w.n}</b>
          <div class="sub num">
            {w.i.length} esercizi · {countWireSets(w.i)} serie
          </div>
          <div class="sub" style={{ marginTop: '4px' }}>
            {w.i
              .slice(0, 4)
              .map((item) => (item.e ? (getExercise(item.e)?.name ?? item.e) : item.x))
              .join(' · ')}
            {w.i.length > 4 && ` · +${w.i.length - 4}`}
          </div>
        </div>
      ))}
    </div>
  );
}
