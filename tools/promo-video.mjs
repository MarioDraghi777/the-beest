/**
 * Video promozionale verticale per le storie.
 *
 *   node tools/promo-video.mjs            -> design/promo/the-beest-story.mp4
 *   node tools/promo-video.mjs --frames   -> salva anche i fotogrammi
 *
 * Genera ogni fotogramma come SVG, lo rasterizza con sharp e li monta con
 * ffmpeg. Niente after effects, niente servizi: un file che si rigenera con
 * un comando ogni volta che cambia il messaggio.
 *
 * Due vincoli che decidono il montaggio:
 * - una storia dura al massimo 15 secondi, oltre viene spezzata in due;
 * - Instagram copre la fascia in alto e quella in bassa con la sua
 *   interfaccia, quindi il contenuto sta fra y=320 e y=1650.
 *
 * Nel video NON compaiono le animazioni degli esercizi: sono © Gym visual e
 * usarle in un contenuto promozionale sarebbe un uso diverso da mostrarle
 * dentro l'app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'design', 'promo');
const FRAME_DIR = path.join(OUT_DIR, 'frames');

const W = 1080;
const H = 1920;
const FPS = 30;
const KEEP_FRAMES = process.argv.includes('--frames');

// Palette dell'app, gli stessi token di global.css
const INK = '#0B0A07';
const HIVE = '#16140E';
const HIVE2 = '#221E15';
const HONEY = '#FFC000';
const NECTAR = '#F08A00';
const WAX = '#F7F1E1';
const DRONE = '#93897A';
const CHILL = '#4FC3F7';
const GO = '#45C26B';

// Archivo non è installato nel sistema: per la rasterizzazione si usa la
// famiglia più vicina disponibile, che a distanza di braccio è indistinguibile.
const DISPLAY = 'Arial Black, Arial, sans-serif';
const UI = 'Segoe UI, Helvetica, Arial, sans-serif';
const MONO = 'Consolas, monospace';

const LOGO = fs.readFileSync(path.join(ROOT, 'design', 'brand', 'logo-256.png')).toString('base64');

/* ------------------------------------------------------------- animazione */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** Partenza decisa, arrivo morbido: il movimento che non sembra un cursore. */
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Progresso 0..1 di una scena, dato il tempo assoluto in secondi. */
const at = (time, from, to) => clamp((time - from) / (to - from));

/** Testo che entra salendo, con un filo di ritardo per riga. */
function rise(time, start, delay = 0, distance = 40) {
  const t = easeOut(at(time, start + delay, start + delay + 0.45));
  return { opacity: t.toFixed(3), dy: ((1 - t) * distance).toFixed(1) };
}

function fadeOut(time, start, duration = 0.35) {
  return (1 - easeInOut(at(time, start, start + duration))).toFixed(3);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(x, y, content, { size = 60, fill = WAX, font = DISPLAY, anchor = 'start', weight = 'normal', opacity = 1, spacing = 0 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${spacing}">${esc(content)}</text>`;
}

function rect(x, y, w, h, { fill = HIVE, rx = 0, opacity = 1, stroke = null, strokeWidth = 2 } = {}) {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}"${s}/>`;
}

/** Esagono con il centro in (cx,cy), largo w: il modulo dell'identità. */
function hex(cx, cy, w, { fill = HONEY, opacity = 1 } = {}) {
  const h = w * 1.1;
  const p = [
    [cx, cy - h / 2],
    [cx + w / 2, cy - h / 4],
    [cx + w / 2, cy + h / 4],
    [cx, cy + h / 2],
    [cx - w / 2, cy + h / 4],
    [cx - w / 2, cy - h / 4],
  ];
  return `<polygon points="${p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="${fill}" opacity="${opacity}"/>`;
}

/** Freccia verso l'alto, disegnata: i font emoji non ci sono in rasterizzazione. */
function arrowUp(x, y, size, opacity = 1) {
  const h = size;
  return `<g opacity="${opacity}" transform="translate(${x} ${y})">
    <path d="M${size / 2} 0 L${size} ${h * 0.45} L${size * 0.68} ${h * 0.45} L${size * 0.68} ${h} L${size * 0.32} ${h} L${size * 0.32} ${h * 0.45} L0 ${h * 0.45} Z" fill="${HONEY}"/>
  </g>`;
}

function logo(x, y, size, opacity = 1) {
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" opacity="${opacity}" xlink:href="data:image/png;base64,${LOGO}"/>`;
}

/** Fascia zebrata nero-ambra: nell'app significa "allenamento in corso". */
function hazard(x, y, w, h) {
  return `<defs><pattern id="hz" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="14" height="28" fill="${HONEY}"/><rect x="14" width="14" height="28" fill="${INK}"/>
  </pattern></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#hz)"/>`;
}

/* ------------------------------------------------------------- telefono */

const PHONE = { x: 150, y: 470, w: 780, h: 1120, r: 54 };

function phoneFrame(opacity = 1) {
  return `<g opacity="${opacity}">
    ${rect(PHONE.x, PHONE.y, PHONE.w, PHONE.h, { fill: INK, rx: PHONE.r, stroke: 'rgba(247,241,225,0.22)', strokeWidth: 3 })}
  </g>`;
}

/* --------------------------------------------------------------- scene */

/** 1 e 2 — il gancio: la domanda a cui nessuno sa rispondere. */
function sceneHook(time) {
  const out = fadeOut(time, 3.5, 0.4);
  const a = rise(time, 0.15, 0);
  const b = rise(time, 0.15, 0.28);
  const c = rise(time, 1.9, 0);
  const d = rise(time, 1.9, 0.22);

  return `<g opacity="${out}">
    ${text(90, 760 + Number(a.dy), 'A quanto eri', { size: 108, opacity: a.opacity })}
    ${text(90, 890 + Number(b.dy), 'la volta scorsa?', { size: 108, opacity: b.opacity })}
    ${text(90, 1080 + Number(c.dy), 'Esatto.', { size: 82, fill: DRONE, opacity: c.opacity })}
    ${text(90, 1190 + Number(d.dy), 'Non te lo ricordi.', { size: 82, fill: HONEY, opacity: d.opacity })}
  </g>`;
}

/** 3 — l'allenamento: chiudi la serie, il recupero parte da solo. */
function sceneWorkout(time) {
  const start = 3.7;
  const inOut = Math.min(Number(easeOut(at(time, start, start + 0.4))), Number(fadeOut(time, 7.15, 0.35)));
  if (inOut <= 0) return '';

  const t = time - start;
  const px = PHONE.x + 46;
  const rowY = PHONE.y + 320;
  const rowH = 96;

  // la terza serie si chiude a 1.5s, il recupero parte subito dopo
  const thirdDone = t > 1.5;
  const pressed = t > 1.35 && t < 1.6;
  const restLeft = thirdDone ? Math.max(0, 90 - Math.floor((t - 1.5) * 14)) : null;

  const rows = [0, 1, 2, 3].map((i) => {
    const done = i < 2 || (i === 2 && thirdDone);
    const current = i === 2 && !thirdDone;
    const y = rowY + i * rowH;
    const fill = done ? 'rgba(69,194,107,0.16)' : current ? 'rgba(255,192,0,0.16)' : 'rgba(247,241,225,0.05)';
    const mark = done ? '✓' : current ? '▸' : '–';
    const markColor = done ? GO : current ? HONEY : DRONE;
    return `${rect(px, y, PHONE.w - 92, rowH - 14, { fill, rx: 16, stroke: current ? HONEY : null, strokeWidth: 2 })}
      ${text(px + 26, y + 56, String(i + 1), { size: 30, font: MONO, fill: DRONE })}
      ${text(px + 250, y + 58, '8 rip', { size: 40, font: MONO, fill: WAX, anchor: 'middle' })}
      ${text(px + 470, y + 58, '82.5 kg', { size: 40, font: MONO, fill: WAX, anchor: 'middle' })}
      ${text(px + PHONE.w - 130, y + 58, mark, { size: 40, fill: markColor })}`;
  });

  const rest = restLeft !== null
    ? `${rect(px, rowY + 4 * rowH + 20, PHONE.w - 92, 150, { fill: HIVE, rx: 20, stroke: CHILL, strokeWidth: 3 })}
       ${text(px + 30, rowY + 4 * rowH + 75, 'RECUPERO', { size: 26, font: MONO, fill: DRONE, spacing: 4 })}
       ${text(px + 30, rowY + 4 * rowH + 145, `01:${String(restLeft % 60).padStart(2, '0')}`, { size: 74, font: MONO, fill: CHILL })}`
    : '';

  const buttonY = PHONE.y + PHONE.h - 190;
  return `<g opacity="${inOut}">
    ${phoneFrame()}
    ${hazard(px, PHONE.y + 70, PHONE.w - 92, 14)}
    ${text(px, PHONE.y + 190, 'barbell bench press', { size: 44, fill: WAX })}
    ${text(px, PHONE.y + 245, 'BILANCIERE · PETTORALI', { size: 26, font: MONO, fill: DRONE, spacing: 3 })}
    ${rows.join('')}
    ${rest}
    ${rect(px, buttonY, PHONE.w - 92, 120, { fill: pressed ? NECTAR : HONEY, rx: 24 })}
    ${text(PHONE.x + PHONE.w / 2, buttonY + 78, thirdDone ? 'SERIE 4 FATTA' : 'SERIE 3 FATTA', { size: 48, fill: INK, anchor: 'middle' })}
    ${text(540, 1730, 'Chiudi la serie.', { size: 56, anchor: 'middle', fill: WAX })}
    ${text(540, 1800, 'Il recupero parte da solo.', { size: 56, anchor: 'middle', fill: HONEY })}
  </g>`;
}

/** 4 — il calendario: ti ricorda quando andare e cosa fare. */
function sceneCalendar(time) {
  const start = 7.3;
  const inOut = Math.min(Number(easeOut(at(time, start, start + 0.4))), Number(fadeOut(time, 10.5, 0.35)));
  if (inOut <= 0) return '';
  const t = time - start;

  // notifica che scende dall'alto
  const notif = easeOut(at(t, 0.25, 0.85));
  const notifY = lerp(-260, 430, notif);

  // il favo si riempie: una cella ogni 0.05s
  const cells = [];
  const cols = 9;
  const rowsN = 4;
  const acceso = Math.floor(clamp((t - 1.1) / 1.3) * cols * rowsN);
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cx = 190 + c * 84 + (r % 2 ? 42 : 0);
      const cy = 1120 + r * 74;
      const on = i < acceso;
      const pop = on ? easeOut(clamp((acceso - i) / 3)) : 0;
      cells.push(hex(cx, cy, 74 * (0.85 + 0.15 * pop), { fill: on ? HONEY : 'rgba(247,241,225,0.08)', opacity: on ? 1 : 1 }));
    }
  }

  return `<g opacity="${inOut}">
    ${rect(90, notifY, 900, 210, { fill: HIVE2, rx: 40, stroke: HONEY, strokeWidth: 3 })}
    ${logo(130, notifY + 42, 126)}
    ${text(290, notifY + 90, 'THE BEEST', { size: 34, font: MONO, fill: DRONE, spacing: 4 })}
    ${text(290, notifY + 152, 'Oggi 18:30 · Upper A', { size: 52, fill: WAX })}
    ${text(540, 780, 'Ti ricorda', { size: 92, anchor: 'middle' })}
    ${text(540, 890, 'quando andare.', { size: 92, anchor: 'middle' })}
    ${text(540, 1000, 'E cosa fare.', { size: 92, anchor: 'middle', fill: HONEY })}
    ${cells.join('')}
    ${text(540, 1500, 'Ogni allenamento chiuso', { size: 46, anchor: 'middle', fill: DRONE, font: UI })}
    ${text(540, 1560, 'accende una cella.', { size: 46, anchor: 'middle', fill: DRONE, font: UI })}
  </g>`;
}

/** 5 — il catalogo: il numero che fa capire la scala. */
function sceneCatalog(time) {
  const start = 10.6;
  const inOut = Math.min(Number(easeOut(at(time, start, start + 0.35))), Number(fadeOut(time, 12.3, 0.3)));
  if (inOut <= 0) return '';
  const t = time - start;

  const raw = Math.round(easeOut(clamp(t / 1.1)) * 1324);
  const count = raw >= 1000 ? `${Math.floor(raw / 1000)}.${String(raw % 1000).padStart(3, '0')}` : String(raw);
  return `<g opacity="${inOut}">
    ${text(540, 880, count, { size: 260, anchor: 'middle', fill: HONEY, font: DISPLAY })}
    ${text(540, 1000, 'ESERCIZI', { size: 74, anchor: 'middle', fill: WAX, spacing: 14 })}
    ${text(540, 1150, 'con animazione e istruzioni', { size: 50, anchor: 'middle', fill: DRONE, font: UI })}
    ${text(540, 1215, 'passo per passo, in italiano', { size: 50, anchor: 'middle', fill: DRONE, font: UI })}
  </g>`;
}

/** 6 — la chiusura: chi sei e dove si tocca. */
function sceneCta(time) {
  const start = 12.4;
  const p = easeOut(at(time, start, start + 0.5));
  if (p <= 0) return '';
  const t = time - start;
  const size = lerp(200, 300, p);
  const pulse = 1 + 0.04 * Math.sin(t * 5);

  return `<g opacity="${p}">
    ${logo(540 - (size * pulse) / 2, 620 - (size * pulse) / 2 + 60, size * pulse)}
    ${text(540, 980, 'THE BEEST', { size: 120, anchor: 'middle', fill: WAX, spacing: 2 })}
    ${text(540, 1075, "Lavora come un'ape. Alzati come una bestia.", { size: 38, anchor: 'middle', fill: DRONE, font: UI })}
    ${text(540, 1260, 'Gratis.', { size: 72, anchor: 'middle', fill: HONEY })}
    ${text(540, 1350, 'Senza registrarsi.', { size: 72, anchor: 'middle', fill: HONEY })}
    ${text(540, 1470, 'Funziona anche offline.', { size: 46, anchor: 'middle', fill: DRONE, font: UI })}
    ${arrowUp(517, 1520, 46, (0.55 + 0.45 * Math.abs(Math.sin(t * 2.2))).toFixed(2))}
    ${text(540, 1650, 'Link qui sopra', { size: 54, anchor: 'middle', fill: WAX, opacity: (0.55 + 0.45 * Math.abs(Math.sin(t * 2.2))).toFixed(2) })}
  </g>`;
}

/* ------------------------------------------------------------- montaggio */

const SCENES = [sceneHook, sceneWorkout, sceneCalendar, sceneCatalog, sceneCta];
const DURATION = 14.6; // sotto i 15 secondi: una storia sola, non spezzata

function frameSvg(time) {
  // Bagliore ambra in alto a destra, come la testata dell'app
  const glow = `<defs><radialGradient id="g" cx="0.8" cy="0.08" r="0.85">
      <stop offset="0" stop-color="${HONEY}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${HONEY}" stop-opacity="0"/>
    </radialGradient></defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    ${glow}<rect width="${W}" height="${H}" fill="url(#g)"/>
    ${SCENES.map((s) => s(time)).join('')}
  </svg>`;
}

async function run() {
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  for (const f of fs.readdirSync(FRAME_DIR)) fs.unlinkSync(path.join(FRAME_DIR, f));

  const total = Math.round(DURATION * FPS);
  console.log(`Genero ${total} fotogrammi a ${W}×${H}…`);
  const started = Date.now();

  for (let i = 0; i < total; i++) {
    const svg = frameSvg(i / FPS);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 3 }).toFile(path.join(FRAME_DIR, `f${String(i).padStart(4, '0')}.png`));
    if ((i + 1) % 60 === 0) console.log(`  ${i + 1}/${total}`);
  }
  console.log(`Fotogrammi pronti in ${((Date.now() - started) / 1000).toFixed(0)}s`);

  const { default: ffmpegPath } = await import('ffmpeg-static');
  const out = path.join(OUT_DIR, 'the-beest-story.mp4');
  execFileSync(
    ffmpegPath,
    [
      '-y', '-framerate', String(FPS),
      '-i', path.join(FRAME_DIR, 'f%04d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
      '-pix_fmt', 'yuv420p',          // richiesto dai lettori dei social
      '-movflags', '+faststart',
      out,
    ],
    { stdio: 'inherit' }
  );

  if (!KEEP_FRAMES) {
    for (const f of fs.readdirSync(FRAME_DIR)) fs.unlinkSync(path.join(FRAME_DIR, f));
    fs.rmdirSync(FRAME_DIR);
  }

  const size = fs.statSync(out).size;
  console.log(`\nPronto: ${out}`);
  console.log(`${DURATION}s · ${W}×${H} · ${(size / 1e6).toFixed(1)} MB`);
}

run();
