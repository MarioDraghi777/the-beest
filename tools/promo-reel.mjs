/**
 * Reel verticale che mostra l'app vera mentre la si usa.
 *
 *   npm run reel                  -> design/promo/the-beest-reel.mp4
 *   npm run reel -- --ritmo=0.8   -> stessa struttura, tutto più svelto
 *   npm run reel -- --senza-media -> niente animazioni degli esercizi
 *   npm run reel -- --keep        -> tiene i file intermedi in design/promo/reel-work
 *
 * Differenza da tools/promo-video.mjs: là i fotogrammi sono disegnati a mano
 * in SVG, qui sono le schermate vere. Un browser vero apre la build vera,
 * la naviga come farebbe un dito, e la registrazione viene poi montata in
 * dissolvenza incrociata.
 *
 * Tre vincoli decidono il montaggio:
 * - un reel si guarda senza audio: il messaggio sta nel testo a schermo;
 * - Instagram copre la fascia bassa e la colonna destra con la sua
 *   interfaccia, quindi la schermata dell'app sta in un riquadro che finisce
 *   a y=1552 e non supera x=870;
 * - il passaggio fra una schermata e l'altra e una dissolvenza e non uno
 *   stacco: su una demo lo stacco secco sembra un errore di caricamento, e
 *   ogni scena dura quanto serve a leggerla, non quanto dura una battuta.
 *
 * Le animazioni degli esercizi sono © Gym visual: nel reel compaiono, con la
 * loro attribuzione come dentro l'app, perché far vedere l'esecuzione è una
 * delle cose che l'app fa. Resta però un uso promozionale, diverso dal
 * mostrarle a chi usa l'app: se la licenza non lo copre, --senza-media
 * rigenera tutto con i segnaposto.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist-reel');
const OUT_DIR = path.join(ROOT, 'design', 'promo');
const WORK = path.join(OUT_DIR, 'reel-work');
const USCITA = path.join(OUT_DIR, 'the-beest-reel.mp4');

const PORTA = 4317;
const BASE = `http://127.0.0.1:${PORTA}`;

/* ------------------------------------------------------------------ formato */

const W = 1080;
const H = 1920;
const FPS = 30;

/** Il riquadro con dentro l'app. Finisce prima della fascia di Instagram. */
const CARD = { x: 210, y: 380, w: 660, h: 1172, r: 34 };
/**
 * Viewport del browser: stesso rapporto della card, e schermo a 3x come un
 * telefono vero. La cattura avviene alla risoluzione fisica (1170×2079) e poi
 * si riduce: al contrario si vedrebbero i bordi sfocati.
 */
const VIEWPORT = { width: 390, height: 693 };
const SCALA = 3;

// Palette dell'app, gli stessi token di src/styles/global.css
const INK = '#0B0A07';
const HONEY = '#FFC000';
const WAX = '#F7F1E1';
const DRONE = '#8A8170';

const arg = (nome, def) => {
  const found = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return found ? found.split('=')[1] : def;
};

/**
 * Il montaggio non è più agganciato al ritmo della traccia. Andare a tempo fa
 * un bel video e un pessimo demo: chi guarda deve avere il tempo di leggere la
 * riga e di capire cosa sta succedendo nella schermata, e sono due cose che
 * si fanno una dopo l'altra, non insieme. Ogni scena dura quanto serve a lei.
 * --ritmo=0.8 accorcia tutto del 20%, --ritmo=1.2 lo allunga.
 */
const RITMO = Number(arg('ritmo', 1));

/** Durata della dissolvenza fra una scena e l'altra. */
const DISSOLVENZA = 0.6;
/** Quanto ci mette una riga di testo a comparire, e quanto tarda la seconda. */
const DISSOLVENZA_TESTO = 0.5;
const RITARDO_RIGA = 0.45;

const KEEP = process.argv.includes('--keep');

/**
 * Le animazioni degli esercizi sono © Gym visual. Nel reel ci sono perché
 * mostrare come si esegue un esercizio è una delle cose che l'app fa, ma è un
 * uso diverso dal mostrarle dentro l'app: va coperto dalla licenza. Con
 * --senza-media si rigenera tutto con i segnaposto al loro posto.
 */
const SENZA_MEDIA = process.argv.includes('--senza-media');

/**
 * In locale non esiste un .env di produzione (è ignorato da git), quindi una
 * build normale uscirebbe senza media e il reel mostrerebbe i segnaposto di
 * un'app che invece le animazioni ce le ha. Qui si usa lo stesso indirizzo del
 * deploy, quello in .github/workflows/deploy.yml.
 */
const MEDIA = arg('media', 'https://mariodraghi777.github.io/the-beest-media');

/*
 * Area che Instagram si riprende con la propria interfaccia: la fascia in
 * basso con didascalia e pulsanti, e la colonna a destra con le icone. Il
 * riquadro deve starne fuori, e se qualcuno cambia la geometria senza
 * accorgersene è meglio che il reel non si generi affatto.
 */
const ZONA_SICURA = { fondo: 1560, destra: 880 };
if (CARD.y + CARD.h > ZONA_SICURA.fondo || CARD.x + CARD.w > ZONA_SICURA.destra) {
  throw new Error(
    `il riquadro finisce a y=${CARD.y + CARD.h} x=${CARD.x + CARD.w}: ` +
      `sconfina nell'interfaccia di Instagram (y max ${ZONA_SICURA.fondo}, x max ${ZONA_SICURA.destra})`
  );
}

/* ------------------------------------------------------------------- scene */

/**
 * Ogni scena dichiara quanto dura e cosa fa dentro l'app. Il testo
 * è quello che si legge a schermo: è il vero copione, il resto è contorno.
 */
const SCENE = [
  {
    id: 'piano',
    secondi: 5.5,
    testo: ['Un anno di allenamenti.', 'Già programmato.'],
    preludio: async (p) => {
      await tab(p, 'Piano');
      await p.waitForTimeout(700);
    },
    azione: async (p) => {
      await scorri(p, 520, 3400);
      await p.waitForTimeout(2600);
    },
  },
  {
    id: 'schede',
    secondi: 5,
    testo: ['69 schede.', 'Nessun foglio di carta.'],
    preludio: async (p) => {
      await tab(p, 'Schede');
      await p.waitForTimeout(500);
    },
    azione: async (p) => {
      await scorri(p, 1400, 4000);
      await p.waitForTimeout(2000);
    },
  },
  {
    id: 'scheda',
    secondi: 6,
    testo: ['Serie, carichi, recuperi.', 'Anche i superset.'],
    preludio: async (p) => {
      await p.getByText('B1 · Spinta A', { exact: false }).first().click();
      await p.waitForTimeout(700);
    },
    azione: async (p) => {
      await scorri(p, 1300, 4600);
      await p.waitForTimeout(2400);
    },
  },
  {
    // Due scene separate sullo stesso schermo davano una dissolvenza fra due
    // immagini quasi identiche: si notava solo perché il testo cambiava.
    // Meglio una scena sola, più lunga, con il timer che gira davvero.
    id: 'allenamento',
    secondi: 7,
    testo: ['Timer e carichi già pronti.', 'Tu spingi e basta.'],
    preludio: async (p) => {
      await p.locator('.btn-live, .btn').filter({ hasText: /Inizia|Riprendi/i }).first().click();
      await p.waitForTimeout(1400);
    },
    azione: async (p) => {
      await p.locator('.btn-live').first().click(); // chiude la prima serie: parte il timer
      await p.waitForTimeout(3600);
      await p.locator('.btn-live').first().click();
      await p.waitForTimeout(3800);
    },
  },
  {
    id: 'catalogo',
    secondi: 6.5,
    testo: ['1.324 esercizi.', 'Componi la tua scheda.'],
    // Si esce dall'allenamento cambiando rotta: la sessione resta aperta e in
    // cima compare la fascia "allenamento in corso", che è vera e va bene.
    preludio: async (p) => {
      await vai(p, 'catalogo');
    },
    azione: async (p) => {
      const ricerca = p.locator('input[type="search"]').first();
      await ricerca.click();
      await ricerca.pressSequentially('panca', { delay: 130 });
      // I risultati devono restare a schermo abbastanza da leggerli: prima
      // fermi, poi una scorsa breve, poi di nuovo fermi. Senza l'ultima pausa
      // la dissolvenza parte mentre la lista e' ancora in movimento.
      await p.waitForTimeout(2400);
      await scorri(p, 300, 2200);
      await p.waitForTimeout(1800);
    },
  },
  {
    id: 'esecuzione',
    secondi: 6.5,
    testo: ['E ti fa vedere', 'come si esegue.'],
    // Meglio un bilanciere di un elastico: è l'esercizio che chi guarda
    // riconosce, e la lista ordina per rilevanza, non per iconicità.
    // L'animazione arriva dalla rete: senza attesa si filma il segnaposto.
    preludio: async (p) => {
      const bilanciere = p.locator('.list-row').filter({ hasText: /barbell bench press/i }).first();
      await ((await bilanciere.count()) ? bilanciere : p.locator('.list-row').first()).click();
      await p.waitForTimeout(2400);
    },
    azione: async (p) => {
      await p.waitForTimeout(1800);
      // Scorsa cortissima: l'animazione sta in cima alla pagina, e scendendo
      // di più esce dall'inquadratura. Resterebbe la riga "ti fa vedere come
      // si esegue" sopra una schermata in cui non si vede più niente eseguire.
      await scorri(p, 190, 2200);
      await p.waitForTimeout(3600);
    },
  },
  {
    id: 'progressi',
    secondi: 6.5,
    testo: ['Miglioramenti e record,', 'misurati davvero.'],
    preludio: async (p) => {
      await vai(p, 'progressi');
      const riga = p.locator('.list-row, .card button, button').filter({ hasText: /bench|press|squat|curl/i }).first();
      if (await riga.count()) await riga.click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(1200);
    },
    azione: async (p) => {
      await p.waitForTimeout(1600);
      // La scheda "Progressione" va portata in cima e lasciata lì: dentro ci
      // stanno il grafico e la riga Adesso / Migliore / Dall'inizio, cioè i
      // numeri che dimostrano la promessa. Sotto c'è solo lo storico.
      await inquadra(p, 'Progressione', 24, 2200);
      await p.waitForTimeout(3400);
    },
  },
  {
    id: 'importa',
    secondi: 5.5,
    testo: ['Incolli il testo del PT.', 'Diventa una scheda.'],
    preludio: async (p) => {
      await vai(p, 'importa');
    },
    azione: async (p) => {
      const area = p.locator('textarea').first();
      await area.click();
      await area.pressSequentially('Panca piana 4x8 60kg rec 90\nTrazioni 4xmax\nCurl bilanciere 3x12 20kg', {
        delay: 20,
      });
      await p.waitForTimeout(250);
      await p.locator('button.btn').filter({ hasText: /Leggi|Analizza|Continua|Importa/i }).first().click();
      await p.waitForTimeout(1600);
      await scorri(p, 240, 2000);
      await p.waitForTimeout(2400);
    },
  },
];

/** La chiusura non è una schermata: è il marchio. */
const OUTRO_SECONDI = 4.5;

const DURATA_SCENA = SCENE.map((s) => s.secondi * RITMO);
const DURATA_OUTRO = OUTRO_SECONDI * RITMO;
// Ogni dissolvenza si mangia il suo tempo: due scene da 4 s con mezzo secondo
// di dissolvenza in mezzo durano 7,5 s, non 8.
const DURATA_TOTALE =
  DURATA_SCENA.reduce((a, b) => a + b, 0) + DURATA_OUTRO - SCENE.length * DISSOLVENZA;

/* ------------------------------------------------------- gesti riutilizzabili */

async function tab(page, nome) {
  await page.locator('.tabbar .tab').filter({ hasText: nome }).first().click();
  await page.waitForTimeout(450);
}

/**
 * Salto di rotta senza passare dalla tab bar: serve dalle schermate piene
 * (allenamento, scheda, importa) dove la barra non c'è per scelta.
 */
async function vai(page, rotta) {
  await page.evaluate((r) => {
    location.hash = `/${r}`;
  }, rotta);
  await page.waitForTimeout(900);
}

/**
 * Porta un elemento a una distanza fissa dal bordo alto del riquadro, con lo
 * stesso movimento continuo dello scroll normale.
 *
 * Serve dove la cosa da mostrare deve stare in una posizione precisa: uno
 * scorrimento "di tot pixel" dipende da dov'era la pagina quando parte, e
 * quella dipende da quanto ha caricato — due generazioni di fila inquadravano
 * il grafico dei progressi in due punti diversi.
 */
async function inquadra(page, testo, margine, ms) {
  const px = await page.evaluate(
    ([testo, margine]) => {
      const el = [...document.querySelectorAll('*')].find(
        (n) => n.children.length === 0 && n.textContent?.trim() === testo
      );
      if (!el) return 0;
      return Math.round(el.getBoundingClientRect().top - margine);
    },
    [testo, margine]
  );
  if (px) await scorri(page, px, ms);
  return px;
}

/** Scroll lento e continuo: quello a scatti in video sembra un errore. */
async function scorri(page, px, ms) {
  const passi = Math.max(1, Math.round(ms / 16));
  await page.evaluate(
    ([px, passi]) =>
      new Promise((ok) => {
        let i = 0;
        const step = () => {
          window.scrollBy(0, px / passi);
          if (++i < passi) requestAnimationFrame(step);
          else ok();
        };
        requestAnimationFrame(step);
      }),
    [px, passi]
  );
}

/* ----------------------------------------------------------------- utilità */

const ff = (args) => execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);

function passo(testo) {
  console.log(`  ${testo}`);
}

/* --------------------------------------------------------- 1. build del reel */

function build() {
  passo(SENZA_MEDIA ? 'build senza le animazioni degli esercizi…' : 'build con le animazioni degli esercizi…');
  const res = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-reel'], {
    cwd: ROOT,
    env: { ...process.env, VITE_MEDIA_BASE: SENZA_MEDIA ? '' : MEDIA },
    shell: true,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error('la build per il reel è fallita');
  }
}

/* ------------------------------------------------------- 2. dati da mostrare */

/**
 * Un'app vuota non si può filmare. Qui si genera lo stesso piano annuale del
 * repository ma con partenza dieci settimane fa, e si marcano come fatte le
 * sedute già passate: solo così il favo ha celle accese e i Progressi hanno
 * una curva da mostrare.
 */
function datiDiScena() {
  // Cartella di lavoro sempre pulita: i fotogrammi e i file di una corsa
  // precedente si mescolerebbero con quelli nuovi senza dare errore.
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const file = path.join(WORK, 'seed.json');

  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - 70);
  while (inizio.getDay() !== 1) inizio.setDate(inizio.getDate() - 1);
  const iso = (d) => d.toISOString().slice(0, 10);

  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'genera-piano-annuale.mjs'), iso(inizio), file], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  const NOMI = new Map(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/catalog.json'), 'utf8')).map((e) => [e.id, e.name])
  );
  const oggiIso = iso(oggi);
  const schede = new Map(backup.workouts.map((w) => [w.id, w]));
  let seme = 7;
  const caso = () => ((seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  for (const entry of backup.planEntries) {
    if (entry.date >= oggiIso) continue;
    if (caso() < 0.12) {
      entry.status = 'saltato';
      continue;
    }
    entry.status = 'fatto';
    const scheda = schede.get(entry.workoutId);
    if (!scheda) continue;

    // Il carico cresce di settimana in settimana: è la curva che si vede nei
    // Progressi, e deve salire perché è esattamente quello che promettiamo.
    const settimane = Math.round((Date.parse(entry.date) - Date.parse(backup.plans[0].startDate)) / 604800000);
    const sessionId = `s-${entry.id}`;
    entry.sessionId = sessionId;
    backup.sessions.push({
      id: sessionId,
      date: entry.date,
      workoutId: scheda.id,
      planEntryId: entry.id,
      name: scheda.name,
      startedAt: Date.parse(`${entry.date}T18:30:00`),
      endedAt: Date.parse(`${entry.date}T19:45:00`),
      entries: scheda.items.map((item) => ({
        ref: item.ref,
        name: NOMI.get(item.ref.id) ?? item.ref.id,
        setLogs: Array.from({ length: item.sets }, (_, i) => ({
          reps: 8 + Math.round(caso() * 3),
          weight: item.load ? Math.round((item.load * (1 + settimane * 0.022) + i * 0.5) * 2) / 2 : undefined,
          done: true,
          restSec: item.restSec,
        })),
      })),
    });
  }

  fs.writeFileSync(file, JSON.stringify(backup));
  passo(`dati di scena: ${backup.sessions.length} allenamenti già fatti, piano dal ${backup.plans[0].startDate}`);
  return file;
}

/* --------------------------------------------------- 3. server statico locale */

function servi() {
  const TIPI = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
  };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(DIST, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.setHeader('Content-Type', TIPI[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(PORTA, '127.0.0.1', () => ok(server)));
}

/* ------------------------------------------------------------- 4. il browser */

function chrome() {
  const candidati = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const trovato = candidati.find((c) => fs.existsSync(c));
  if (!trovato) throw new Error('Chrome o Edge non trovati: passa il percorso in CHROME_PATH.');
  return trovato;
}

/** Il tocco deve vedersi: senza un segno sullo schermo sembra che l'app si muova da sola. */
const TOCCO = `
  document.addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;border-radius:50%;' +
      'width:64px;height:64px;margin:-32px 0 0 -32px;border:2px solid ${HONEY};' +
      'background:rgba(255,192,0,.18);transition:transform .45s ease-out,opacity .45s ease-out';
    d.style.left = e.clientX + 'px';
    d.style.top = e.clientY + 'px';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 500);
  }, true);
  const css = document.createElement('style');
  css.textContent = '*{scrollbar-width:none !important}*::-webkit-scrollbar{display:none !important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
`;

async function registra(seed) {
  const browser = await chromium.launch({ executablePath: chrome(), args: ['--hide-scrollbars'] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALA,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    locale: 'it-IT',
  });
  await context.addInitScript(TOCCO);
  const page = await context.newPage();

  // Seeding dalla porta d'ingresso vera dell'app: se l'import si rompe, il
  // reel non parte — ed è giusto così, sarebbe il primo bug da sapere.
  passo('carico i dati di scena dall’Importa dell’app…');
  await page.goto(`${BASE}/index.html#/oggi`);
  await page.waitForSelector('#app main', { timeout: 20000 });

  // Il benvenuto copre tutto al primo avvio: se resta aperto, ogni tocco
  // successivo finisce sul velo e la registrazione mostra un'app immobile.
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('.onboarding .btn').first();
    if (!(await btn.count())) break;
    await btn.click();
    await page.waitForTimeout(400);
  }

  await vai(page, 'importa');
  await page.getByText('File CSV o JSON').click();
  await page.locator('input[type="file"]').first().setInputFiles(seed);
  await page.waitForTimeout(3500);
  await vai(page, 'oggi');
  await page.waitForSelector('.tabbar', { timeout: 15000 });

  /*
   * La cattura passa dal protocollo del browser, non dal video di Playwright:
   * quello registra la pagina alla sua dimensione in pixel CSS dentro un
   * fotogramma più grande, e il risultato è l'app in un angolo su fondo grigio.
   * Lo screencast invece dà i fotogrammi alla risoluzione fisica dello schermo
   * simulato, con il loro istante: da lì si ricostruisce il movimento vero.
   */
  const FRAMES = path.join(WORK, 'frames');
  fs.mkdirSync(FRAMES, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const fotogrammi = [];
  cdp.on('Page.screencastFrame', (f) => {
    const file = path.join(FRAMES, `f-${String(fotogrammi.length + 1).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    fotogrammi.push({ file, t: Date.now() });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: VIEWPORT.width * SCALA,
    maxHeight: VIEWPORT.height * SCALA,
    everyNthFrame: 1,
  });

  const t0 = Date.now();
  const tempi = [];
  for (const [i, scena] of SCENE.entries()) {
    /*
     * Il preludio porta l'app dove deve stare e NON viene cronometrato. Prima
     * la navigazione stava dentro l'azione, e siccome il taglio tiene la coda
     * risalendo all'indietro, nelle scene corte la finestra arrivava a coprire
     * anche il tocco sulla tab: la scena si apriva per qualche fotogramma sulla
     * schermata precedente, un lampo che sembrava un errore di caricamento.
     */
    try {
      if (scena.preludio) await scena.preludio(page);
    } catch (err) {
      console.warn(`  ! preludio "${scena.id}": ${err.message.split('\n')[0]}`);
    }

    const inizio = Date.now();
    try {
      await scena.azione(page);
    } catch (err) {
      console.warn(`  ! scena "${scena.id}": ${err.message.split('\n')[0]}`);
    }
    // Si tiene la CODA della scena, non la testa: la parte utile è sempre in
    // fondo — la schermata è arrivata, il testo è stato scritto, il timer sta
    // scorrendo. Tagliando dall'inizio si filmerebbe la schermata precedente.
    const fine = Date.now();
    const servono = DURATA_SCENA[i] * 1000;
    const durata = fine - inizio;
    if (durata < servono) {
      console.warn(`  ! scena "${scena.id}" dura ${(durata / 1000).toFixed(1)}s: l’ultimo fotogramma resta fermo per ${((servono - durata) / 1000).toFixed(1)}s`);
    } else if (durata < servono + 800) {
      // Non è un errore: la navigazione ormai sta nel preludio e fuori dal
      // cronometro. Vuol dire solo che il taglio comincia dal primo istante
      // dell'azione, senza margine da buttare se qualcosa rallenta.
      console.warn(`  ! scena "${scena.id}": solo ${((durata - servono) / 1000).toFixed(1)}s di margine sull’azione`);
    }
    await page.waitForTimeout(400);
    tempi.push({ id: scena.id, da: (Math.max(inizio, fine - servono) - t0) / 1000, a: (fine - t0) / 1000 });
    // Un fotogramma di controllo per scena: se il reel esce sbagliato si
    // capisce subito quale schermata non era quella che credevamo.
    await page.screenshot({ path: path.join(WORK, `controllo-${scena.id}.png`) }).catch(() => {});
  }

  await cdp.send('Page.stopScreencast').catch(() => {});
  passo(`${fotogrammi.length} fotogrammi catturati a ${VIEWPORT.width * SCALA}×${VIEWPORT.height * SCALA}`);

  const overlay = await disegnaSovrimpressioni(browser);
  await context.close();
  await browser.close();
  return {
    fotogrammi: fotogrammi.map((f) => ({ file: f.file, t: (f.t - t0) / 1000 })),
    tempi,
    overlay,
  };
}

/* ---------------------------------------------------- 5. testi e sfondo veri */

/**
 * Le sovrimpressioni si disegnano nello stesso browser che ha appena filmato
 * l'app: così usano i font veri del progetto, senza sperare che siano
 * installati nel sistema per il rasterizzatore SVG.
 */
async function disegnaSovrimpressioni(browser) {
  // Contesto separato a scala 1: quello che registra gira a 3x per nitidezza,
  // e uno screenshot a 3x darebbe sovrimpressioni da 3240×5760 che non si
  // sovrappongono più a niente.
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // I font arrivano dal CSS vero della build: dopo l'hashing dei nomi i
  // percorsi dei woff2 non sono indovinabili, e riscrivere gli @font-face a
  // mano significherebbe vedere il reel con i font di sistema senza accorgersene.
  const cssBuild = fs.readdirSync(path.join(DIST, 'assets')).find((f) => f.endsWith('.css'));
  const FONT = `@import url('/assets/${cssBuild}');`;
  const html = (corpo, sfondo) => `
    <style>
      ${FONT}
      html,body{margin:0;width:${W}px;height:${H}px;background:${sfondo};overflow:hidden}
      .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
      .riga{font-family:Archivo,system-ui;font-variation-settings:'wdth' 118,'wght' 800;
        color:${WAX};font-size:64px;line-height:1.12;text-align:center;letter-spacing:-.5px}
      .riga.acceso{color:${HONEY}}
      .card-ombra{position:absolute;left:${CARD.x}px;top:${CARD.y}px;width:${CARD.w}px;height:${CARD.h}px;
        border-radius:${CARD.r}px;box-shadow:0 40px 90px rgba(0,0,0,.65);background:${INK}}
      .esagoni{position:absolute;inset:0;opacity:.16}
    </style>
    <div class="wrap">${corpo}</div>
  `;

  const esagoni = `<svg class="esagoni" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="h" width="112" height="97" patternUnits="userSpaceOnUse">
      <path d="M28 0 84 0 112 48.5 84 97 28 97 0 48.5Z" fill="none" stroke="${HONEY}" stroke-width="2"/>
    </pattern></defs><rect width="${W}" height="${H}" fill="url(#h)"/></svg>`;

  const scatta = async (contenuto, sfondo, file, trasparente) => {
    await page.setContent(html(contenuto, sfondo), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: W, height: H });
    await page.screenshot({ path: file, omitBackground: Boolean(trasparente) });
    return file;
  };

  // La pagina deve stare sull'origine del server per risolvere ./fonts/*.woff2
  await page.goto(`${BASE}/index.html`);

  /*
   * Una immagine per riga, non una per scena: così in montaggio le righe
   * possono entrare una dopo l'altra, come nelle didascalie dei reel. Le righe
   * non volute non vengono tolte ma rese invisibili, altrimenti la seconda
   * salirebbe al posto della prima e le due immagini non si sovrapporrebbero.
   */
  const testi = [];
  for (const [i, scena] of SCENE.entries()) {
    const perRiga = [];
    for (let v = 0; v < scena.testo.length; v++) {
      const righe = scena.testo
        .map((r, k) => {
          const classe = `riga${k === scena.testo.length - 1 ? ' acceso' : ''}`;
          return `<div class="${classe}"${k === v ? '' : ' style="opacity:0"'}>${r}</div>`;
        })
        .join('');
      perRiga.push(
        await scatta(
          `<div style="position:absolute;top:150px;left:60px;right:60px">${righe}</div>`,
          'transparent',
          path.join(WORK, `testo-${i}-${v}.png`),
          true
        )
      );
    }
    testi.push(perRiga);
  }

  const sfondo = await scatta(`${esagoni}<div class="card-ombra"></div>`, INK, path.join(WORK, 'sfondo.png'));

  const logo = fs.readFileSync(path.join(ROOT, 'design', 'brand', 'logo-512.png')).toString('base64');
  const outro = await scatta(
    `${esagoni}
     <div style="position:absolute;top:520px;left:80px;right:80px">
       <img src="data:image/png;base64,${logo}" width="200" height="200"
         style="display:block;margin:0 auto 56px"/>
       <div class="riga" style="font-size:66px">Lavora come un’ape,</div>
       <div class="riga acceso" style="font-size:66px">cresci come una bestia.</div>
       <div style="margin-top:70px;font-family:'IBM Plex Sans',system-ui;font-weight:600;font-size:40px;
         color:${DRONE};text-align:center;line-height:1.5">
         Niente account. Niente abbonamento.
       </div>
       <div style="margin-top:54px;font-family:Archivo,system-ui;font-variation-settings:'wdth' 118,'wght' 800;
         font-size:46px;color:${HONEY};text-align:center">Link in bio!</div>
     </div>`,
    INK,
    path.join(WORK, 'outro.png')
  );

  // Maschera per gli angoli tondi del riquadro: bianco dove l'app si vede.
  const maschera = path.join(WORK, 'maschera.png');
  await page.setViewportSize({ width: CARD.w, height: CARD.h });
  await page.setContent(
    `<style>html,body{margin:0;background:#000;width:${CARD.w}px;height:${CARD.h}px}
     div{width:100%;height:100%;background:#fff;border-radius:${CARD.r}px}</style><div></div>`
  );
  await page.screenshot({ path: maschera });

  await ctx.close();
  return { testi, sfondo, outro, maschera };
}

/* ------------------------------------------------------------- 6. montaggio */

function monta({ fotogrammi, tempi, overlay }) {
  passo('ritaglio le scene…');
  const clip = [];
  for (const [i, t] of tempi.entries()) {
    const { da, a } = t;

    const dentro = fotogrammi.filter((f) => f.t >= da && f.t < a);

    /*
     * Lo screencast manda un fotogramma solo quando qualcosa cambia: se la
     * finestra si apre su una schermata ferma, il primo fotogramma utile è
     * quello di prima e va rimesso all'inizio. Ma solo in quel caso: quando i
     * fotogrammi arrivano fitti, infilare comunque quello precedente mette in
     * testa alla scena un'immagine vecchia che compare e sparisce in un
     * trentesimo di secondo — il lampo.
     */
    const prima = [...fotogrammi].reverse().find((f) => f.t < da);
    const buco = !dentro.length || dentro[0].t - da > 1 / FPS;
    const usati = buco && prima ? [{ ...prima, t: da }, ...dentro] : dentro;
    if (!usati.length) throw new Error(`nessun fotogramma per la scena "${t.id}"`);

    /*
     * La durata di ogni voce è la distanza dal fotogramma successivo, e basta.
     * Con un minimo di un trentesimo di secondo si allungava ogni intervallo:
     * il browser disegna a 60 fps, quindi ogni fotogramma durava il doppio del
     * vero e la lista finiva per durare il doppio della scena. ffmpeg tagliava
     * a metà, e quello che si perdeva era sempre la coda — cioè il momento in
     * cui la schermata si ferma ed è finalmente leggibile.
     */
    const righe = usati.map((f, k) => {
      const fine = k + 1 < usati.length ? usati[k + 1].t : da + DURATA_SCENA[i];
      const durata = Math.max(0.001, fine - f.t);
      return `file '${f.file.replace(/\\/g, '/')}'\nduration ${durata.toFixed(4)}`;
    });
    // Il demuxer concat ignora la durata dell'ultima voce: va ripetuta.
    righe.push(`file '${usati[usati.length - 1].file.replace(/\\/g, '/')}'`);

    // La lista deve durare quanto la scena. Se non torna, ffmpeg taglierebbe
    // in silenzio: è così che il difetto era passato inosservato per tre giri.
    const totale = righe.reduce((s, r) => s + Number(r.split('duration ')[1]), 0);
    if (Math.abs(totale - DURATA_SCENA[i]) > 0.05) {
      throw new Error(
        `scena "${t.id}": la lista dura ${totale.toFixed(2)}s invece di ${DURATA_SCENA[i].toFixed(2)}s`
      );
    }

    const lista = path.join(WORK, `scena-${i}.txt`);
    fs.writeFileSync(lista, righe.join('\n'));

    const file = path.join(WORK, `scena-${i}.mp4`);
    ff([
      '-f', 'concat', '-safe', '0', '-i', lista,
      '-vf', `scale=${CARD.w}:${CARD.h}:flags=lanczos,fps=${FPS}`,
      '-t', DURATA_SCENA[i].toFixed(3),
      '-an', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', file,
    ]);
    clip.push(file);
  }

  passo('compongo sfondo, riquadro e testi…');

  /*
   * Ogni scena viene chiusa subito nel suo fotogramma pieno 1080×1920, con
   * sfondo, riquadro arrotondato e testo già dentro. Costa un passaggio in
   * più, ma poi le dissolvenze incrociano scene complete: il testo sfuma
   * insieme alla schermata invece di comparire e sparire di colpo sopra una
   * dissolvenza già in corso.
   */
  const piene = [];
  for (const [i, sorgente] of clip.entries()) {
    const d = DURATA_SCENA[i];
    const righe = overlay.testi[i];
    const piena = path.join(WORK, `piena-${i}.mp4`);

    const ingresso = ['-loop', '1', '-i', overlay.sfondo, '-i', sorgente, '-i', overlay.maschera];
    for (const r of righe) ingresso.push('-loop', '1', '-i', r);

    const filtri = [
      '[1:v]format=yuva420p[n]',
      '[2:v]format=gray[m]',
      '[n][m]alphamerge[card]',
      `[0:v][card]overlay=${CARD.x}:${CARD.y}[p0]`,
    ];
    righe.forEach((_, v) => {
      // Ogni riga entra con un ritardo suo, salendo di 46 px mentre appare:
      // è il movimento delle didascalie dei reel, e dà il tempo di leggere la
      // prima riga prima che arrivi la seconda.
      const inizio = v * RITARDO_RIGA;
      const uscita = d - DISSOLVENZA_TESTO;
      filtri.push(
        `[${v + 3}:v]format=rgba,` +
          `fade=t=in:st=${inizio.toFixed(3)}:d=${DISSOLVENZA_TESTO}:alpha=1,` +
          `fade=t=out:st=${uscita.toFixed(3)}:d=${DISSOLVENZA_TESTO}:alpha=1[t${v}]`
      );
      filtri.push(
        `[p${v}][t${v}]overlay=0:'46*max(0\\,1-(t-${inizio.toFixed(3)})/${DISSOLVENZA_TESTO})'` +
          `:eof_action=pass[p${v + 1}]`
      );
    });

    ff([
      ...ingresso,
      '-filter_complex', filtri.join(';'),
      '-map', `[p${righe.length}]`, '-t', d.toFixed(3),
      '-r', String(FPS), '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', piena,
    ]);
    piene.push(piena);
  }

  const fine = path.join(WORK, 'outro.mp4');
  ff(['-loop', '1', '-i', overlay.outro, '-t', DURATA_OUTRO.toFixed(3),
    '-r', String(FPS), '-vf', `scale=${W}:${H}`, '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', fine]);
  piene.push(fine);

  passo('incrocio le scene in dissolvenza…');

  // xfade incrocia due flussi alla volta: l'offset è quando comincia la
  // dissolvenza sulla timeline già montata, e ogni incrocio accorcia il totale
  // della sua durata.
  const durate = [...DURATA_SCENA, DURATA_OUTRO];
  const ingressi = piene.flatMap((p) => ['-i', p]);
  const filtri = [];
  let uscita = '0:v';
  let offset = 0;
  for (let i = 1; i < piene.length; i++) {
    offset += durate[i - 1] - DISSOLVENZA;
    const nome = `x${i}`;
    filtri.push(
      `[${uscita}][${i}:v]xfade=transition=fade:duration=${DISSOLVENZA}:offset=${offset.toFixed(3)}[${nome}]`
    );
    uscita = nome;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  ff([...ingressi, '-filter_complex', filtri.join(';'), '-map', `[${uscita}]`,
    '-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', USCITA]);
}

/* ----------------------------------------------------------------- esecuzione */

console.log(`\nReel · ${SCENE.length + 1} scene · ${DURATA_TOTALE.toFixed(1)}s previsti\n`);

let server;
try {
  build();
  const seed = datiDiScena();
  server = await servi();
  passo(`server locale su ${BASE}`);
  const girato = await registra(seed);
  monta(girato);
} finally {
  server?.close();
}

// ffmpeg-static non porta ffprobe: la durata vera si legge da quello che
// ffmpeg stampa aprendo il file, ed è l'unico modo di accorgersi se il
// montaggio ha prodotto qualcosa di diverso da quello che avevamo previsto.
const info = spawnSync(ffmpegPath, ['-hide_banner', '-i', USCITA], { encoding: 'utf8' }).stderr ?? '';
const durata = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(info);
const secondi = durata ? +durata[1] * 3600 + +durata[2] * 60 + +durata[3] : DURATA_TOTALE;

// Il file finale deve durare quanto la somma delle scene meno le dissolvenze.
// Se non torna, da qualche parte ffmpeg ha tagliato o allungato in silenzio.
if (Math.abs(secondi - DURATA_TOTALE) > 0.2) {
  throw new Error(
    `il video dura ${secondi.toFixed(2)}s invece di ${DURATA_TOTALE.toFixed(2)}s: il montaggio non torna`
  );
}

const kb = Math.round(fs.statSync(USCITA).size / 1024);
console.log(`\nFatto: ${USCITA}`);
console.log(`${SCENE.length + 1} scene · ${secondi.toFixed(1)}s · ${kb} KB · ${W}×${H} a ${FPS} fps`);
console.log(
  SENZA_MEDIA
    ? 'Nessuna animazione degli esercizi: build con VITE_MEDIA_BASE vuoto.\n'
    : 'Animazioni degli esercizi incluse, © Gym visual con attribuzione a schermo. Con --senza-media si rigenera senza.\n'
);

if (!KEEP) fs.rmSync(WORK, { recursive: true, force: true });
