import { useEffect, useState } from 'preact/hooks';
import { goBack, navigate } from '../router';
import { backupStats, exportBackup, exportHistoryCsv, isBackup, restoreBackup } from '../services/backup';
import { formatDateLong } from '../services/sessionMath';
import { meta } from '../services/catalog';

/**
 * I tuoi dati: backup, ripristino, esportazione.
 *
 * Senza account non c'è nessun recupero lato server. Questa pagina è la rete
 * di sicurezza dell'app, e lo dice apertamente invece di nasconderlo.
 */
export function DataPage() {
  const [stats, setStats] = useState<{ sessions: number; workouts: number; lastSession?: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void backupStats().then(setStats);
  }, []);

  const ripristina = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isBackup(parsed)) {
        setMessage('Questo file non è un backup di The Beest.');
        return;
      }
      const report = await restoreBackup(parsed);
      setStats(await backupStats());
      setMessage(
        `Ripristinati ${report.workouts} schede, ${report.sessions} allenamenti, ${report.plans} piani. ` +
          'Niente è stato cancellato: quello che c\'era è stato unito.'
      );
    } catch (err) {
      setMessage(`Non riesco a leggere il file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="page">
      <div class="row">
        <button class="icon-btn" type="button" onClick={() => goBack('progressi')} aria-label="Torna indietro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <h1 style={{ flex: 1, fontSize: '22px' }}>I tuoi dati</h1>
      </div>

      <div class="card card-hero">
        <span class="eyebrow" style={{ color: 'var(--honey)' }}>
          Sul questo dispositivo
        </span>
        <div class="row" style={{ marginTop: '10px' }}>
          <div style={{ flex: 1 }}>
            <div class="sub">Allenamenti</div>
            <div class="num" style={{ fontSize: '22px' }}>
              {stats?.sessions ?? '—'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div class="sub">Schede</div>
            <div class="num" style={{ fontSize: '22px' }}>
              {stats?.workouts ?? '—'}
            </div>
          </div>
        </div>
        {stats?.lastSession && (
          <div class="sub" style={{ marginTop: '8px' }}>
            Ultimo allenamento: {formatDateLong(stats.lastSession)}
          </div>
        )}
      </div>

      <div class="card">
        <span class="eyebrow">Perché conta</span>
        <p style={{ margin: '10px 0 0', fontSize: '14.5px' }}>
          The Beest non ha account e non manda niente a nessun server: i tuoi dati stanno in questo
          browser e basta. È il motivo per cui non devi registrarti, ed è anche il motivo per cui{' '}
          <b>se cancelli i dati del sito o cambi telefono non si recuperano</b>.
        </p>
        <p class="sub" style={{ margin: '8px 0 0' }}>
          Scarica il backup ogni tanto — a fine blocco, o quando hai registrato qualcosa a cui tieni.
          Su iPhone tieni l'app aggiunta alla schermata Home: i siti normali vengono ripuliti da
          Safari dopo 7 giorni che non li apri, le app installate no.
        </p>
      </div>

      {message && (
        <div class="card" style={{ borderColor: 'var(--go)' }}>
          <span class="sub">{message}</span>
        </div>
      )}

      <button class="btn" type="button" onClick={() => void exportBackup()}>
        Scarica il backup
      </button>

      <label class="btn btn-ghost" style={{ cursor: 'pointer' }}>
        {busy ? 'Ripristino…' : 'Ripristina da un backup'}
        <input
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void ripristina(file);
          }}
        />
      </label>

      <button class="btn btn-ghost" type="button" onClick={() => void exportHistoryCsv()}>
        Esporta lo storico in CSV
      </button>

      <button class="btn btn-ghost" type="button" onClick={() => navigate('importa')}>
        Importa una scheda
      </button>

      <div class="card">
        <span class="eyebrow">Da dove vengono gli esercizi</span>
        <p class="sub" style={{ margin: '8px 0 0' }}>
          {meta.value?.count ?? 1324} esercizi da exercises-dataset, dati sotto licenza MIT, con le
          istruzioni in italiano. Animazioni e miniature sono © Gym visual — gymvisual.com.
        </p>
      </div>
    </main>
  );
}
