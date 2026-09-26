/**
 * Genera un piano annuale di ipertrofia (52 settimane) nel formato di backup
 * dell'app, pronto per essere importato da Dati > Ripristina o da Importa.
 *
 * Enfasi su bicipiti, petto, spalle e addome, con il resto del corpo allenato
 * a volume di crescita. Gli esercizi sono presi dal catalogo statico e ogni id
 * viene verificato: se un id non esiste, lo script si ferma invece di produrre
 * un file che l'app importerebbe con righe fantasma.
 *
 * Uso: node tools/genera-piano-annuale.mjs [YYYY-MM-DD] [file di destinazione]
 * Senza argomenti parte dal primo lunedì successivo a oggi.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/catalog.json'), 'utf8'));
const PER_ID = new Map(CATALOGO.map((e) => [e.id, e]));

/* ------------------------------------------------------------------ profili */

/**
 * Ogni profilo descrive come si allena in quel blocco, non quali esercizi si
 * fanno: serie, ripetizioni, recupero e prossimità al cedimento per ruolo.
 * `bonus` aggiunge una serie ai muscoli in specializzazione.
 */
const PROFILI = {
  P0: {
    nome: 'Riadattamento',
    ruoli: {
      main: { sets: 3, reps: '10-12', rest: 150, rir: 3, tempo: '3-1-1-0' },
      sec: { sets: 2, reps: '10-12', rest: 120, rir: 3 },
      iso: { sets: 2, reps: '12-15', rest: 75, rir: 2 },
      core: { sets: 2, reps: '12-15', rest: 60, rir: 2 },
      bw: { sets: 2, reps: 'max-4', rest: 90, rir: 4 },
    },
    bonus: [],
  },
  P1: {
    nome: 'Accumulo I',
    ruoli: {
      main: { sets: 3, reps: '8-10', rest: 180, rir: 2 },
      sec: { sets: 3, reps: '10-12', rest: 120, rir: 2 },
      iso: { sets: 3, reps: '12-15', rest: 75, rir: 1 },
      core: { sets: 3, reps: '12-20', rest: 60, rir: 1 },
      bw: { sets: 2, reps: 'max-2', rest: 90, rir: 2 },
    },
    bonus: [],
  },
  P2: {
    nome: 'Intensificazione I',
    ruoli: {
      main: { sets: 4, reps: '6-8', rest: 210, rir: 1 },
      sec: { sets: 3, reps: '8-10', rest: 150, rir: 1 },
      iso: { sets: 2, reps: '10-12', rest: 90, rir: 0 },
      core: { sets: 3, reps: '10-15', rest: 60, rir: 0 },
      bw: { sets: 3, reps: 'max-1', rest: 120, rir: 1 },
    },
    bonus: [],
  },
  P3: {
    nome: 'Accumulo metabolico',
    ruoli: {
      main: { sets: 3, reps: '12-15', rest: 120, rir: 1 },
      sec: { sets: 3, reps: '12-15', rest: 90, rir: 1, tempo: '2-0-1-1' },
      iso: { sets: 3, reps: '15-20', rest: 60, rir: 0, tempo: '2-1-1-0' },
      core: { sets: 3, reps: '20-30', rest: 45, rir: 0 },
      bw: { sets: 3, reps: 'max', rest: 90, rir: 0 },
    },
    bonus: [],
  },
  P4: {
    nome: 'Forza-ipertrofia',
    ruoli: {
      main: { sets: 4, reps: '5-6', rest: 210, rir: 2 },
      sec: { sets: 3, reps: '8-10', rest: 150, rir: 1 },
      iso: { sets: 2, reps: '10-12', rest: 90, rir: 1 },
      core: { sets: 3, reps: '8-12', rest: 90, rir: 1 },
      bw: { sets: 3, reps: 'max-2', rest: 150, rir: 2 },
    },
    bonus: [],
  },
  P5: {
    nome: 'Accumulo III',
    ruoli: {
      main: { sets: 4, reps: '8-12', rest: 180, rir: 1 },
      sec: { sets: 3, reps: '10-12', rest: 120, rir: 1 },
      iso: { sets: 3, reps: '12-15', rest: 75, rir: 1 },
      core: { sets: 3, reps: '12-20', rest: 60, rir: 0 },
      bw: { sets: 3, reps: 'max-1', rest: 90, rir: 1 },
    },
    bonus: [],
  },
  P6: {
    nome: 'Specializzazione braccia e spalle',
    ruoli: {
      main: { sets: 3, reps: '8-12', rest: 180, rir: 1 },
      sec: { sets: 3, reps: '10-12', rest: 120, rir: 1 },
      iso: { sets: 3, reps: '10-15', rest: 75, rir: 0 },
      core: { sets: 3, reps: '12-20', rest: 60, rir: 0 },
      bw: { sets: 3, reps: 'max-1', rest: 90, rir: 1 },
    },
    bonus: ['delts', 'biceps', 'triceps'],
    malus: ['chest'],
  },
  P7: {
    nome: 'Specializzazione petto e addome',
    ruoli: {
      main: { sets: 4, reps: '8-12', rest: 180, rir: 1 },
      sec: { sets: 3, reps: '10-12', rest: 120, rir: 1 },
      iso: { sets: 3, reps: '12-15', rest: 75, rir: 0 },
      core: { sets: 3, reps: '10-20', rest: 60, rir: 0 },
      bw: { sets: 3, reps: 'max', rest: 90, rir: 0 },
    },
    bonus: ['chest', 'abs'],
    malus: ['delts', 'biceps'],
  },
  P8: {
    nome: 'Picco e consolidamento',
    ruoli: {
      main: { sets: 4, reps: '6-10', rest: 210, rir: 1 },
      sec: { sets: 3, reps: '8-12', rest: 150, rir: 0 },
      iso: { sets: 3, reps: '10-12', rest: 90, rir: 0 },
      core: { sets: 3, reps: '12-20', rest: 60, rir: 0 },
      bw: { sets: 3, reps: 'max', rest: 120, rir: 0 },
    },
    bonus: [],
  },
  PD: {
    nome: 'Scarico',
    ruoli: {
      main: { sets: 2, reps: '8', rest: 150, rir: 4 },
      sec: { sets: 2, reps: '10', rest: 120, rir: 4 },
      iso: { sets: 2, reps: '12', rest: 60, rir: 4 },
      core: { sets: 2, reps: '12', rest: 60, rir: 3 },
      bw: { sets: 2, reps: 'max-5', rest: 90, rir: 5 },
    },
    bonus: [],
  },
};

/**
 * Taratura di partenza, ricavata dalle schede eseguite con il personal
 * trainer. Vale SOLO per il primo blocco: dal secondo in poi l'app riporta
 * avanti da sola il carico dell'ultima serie completata su quell'esercizio,
 * e un carico scritto nella scheda vincerebbe sul riporto congelando la
 * progressione per un anno. Sui manubri il numero è per manubrio.
 */
const CARICHI = {
  // petto
  '0025': 25, '0047': 25, '0289': 18, '0314': 16, '0308': 12, '0319': 10,
  '0576': 30, '1270': 10, '1269': 10, '0169': 10, '0171': 10, '0302': 12,
  '0748': 25, '1300': 30, '0755': 40,
  // dorso
  '0198': 45, '0177': 40, '0245': 40, '0818': 45, '0861': 30, '0180': 30,
  '0027': 30, '0293': 16, '0606': 25, '1350': 35, '0571': 35, '3017': 25,
  '0574': 35, '0189': 20, '1349': 25, '0203': 15, '0202': 15,
  // spalle
  '0091': 25, '0603': 25, '0765': 25, '0426': 12, '2137': 12, '0405': 12,
  '0334': 6, '0396': 6, '0355': 6, '0311': 5, '0323': 5, '0178': 5, '0192': 5,
  '0584': 15, '0383': 5, '0380': 5, '0602': 20, '0601': 20, '0246': 15,
  // bicipiti
  '0031': 15, '0447': 15, '0446': 15, '1627': 15, '0070': 15,
  '0318': 6, '0315': 6, '0322': 6, '0313': 8, '0298': 8, '0297': 6,
  '0868': 20, '0195': 15, '0165': 15, '1631': 10, '0454': 10, '0190': 10,
  // tricipiti
  '0200': 15, '0201': 15, '0241': 15, '0194': 12, '0092': 12, '0060': 15,
  // gambe
  '0043': 25, '0042': 20, '0743': 40, '0739': 100, '2287': 80, '0585': 35,
  '0599': 35, '0586': 35, '0582': 30, '0085': 30, '0116': 25, '1459': 14,
  '0410': 10, '2368': 0, '1409': 30, '0605': 40, '0594': 30, '2335': 40,
  '1372': 20,
  // core
  '0175': 20, '0874': 20, '0212': 20, '0223': 15, '0873': 15, '2135': 10,
  '0846': 5,
};

/* --------------------------------------------------------------- selezioni */

const x = (id, role, m, opt = {}) => ({ id, role, m, ...opt });

/** S1 — fondamentali con bilanciere e manubri. */
const S1 = [
  {
    key: 'D1',
    nome: 'Spinta A — Petto',
    focus: 'Petto in spinta orizzontale e inclinata, deltoide laterale, tricipiti',
    items: [
      x('0025', 'main', 'chest', { note: 'Scapole retratte e depresse, gomiti a ~45°. Tocco controllato, nessun rimbalzo.' }),
      x('0314', 'main', 'chest', { note: 'Panca a 30°. Scendi fino a sentire il petto in allungamento pieno.' }),
      x('0251', 'sec', 'chest', { note: 'Busto inclinato in avanti per spostare il carico sul petto. Zavorra quando superi il tetto di ripetizioni.' }),
      x('0308', 'iso', 'chest', { note: 'Gomiti morbidi e fissi. Il valore è nella parte bassa: non chiudere sopra.', ss: 'A' }),
      x('0334', 'iso', 'delts', { note: 'Busto leggermente avanti, sali fino alla linea delle spalle senza scrollare.', ss: 'A' }),
      x('0200', 'iso', 'triceps', { note: 'Gomiti bloccati al fianco, apri la corda in chiusura.' }),
      x('0259', 'bw', 'triceps', { also: ['chest'], note: 'Finisher a corpo libero, presa stretta, a cedimento tecnico. Corpo in linea, gomiti aderenti.' }),
    ],
  },
  {
    key: 'D2',
    nome: 'Trazione — Dorso e Bicipiti',
    focus: 'Dorsali in verticale e orizzontale, bicipiti su tre angoli di spalla',
    items: [
      x('0652', 'main', 'lats', { reps: '4-6', note: 'Serie corte e pulite, mai a cedimento. Se non arrivi a 4, fai la negativa in 5 secondi e risali con un piede sulla panca. Quando fai 6 ripetizioni su tutte le serie, aggiungi 2,5 kg di zavorra.' }),
      x('0027', 'main', 'back', { note: "Busto a ~45°, tira verso l'ombelico. Niente slancio di schiena." }),
      x('0198', 'sec', 'lats', { note: 'Allunga in alto senza staccare il bacino, tira con i gomiti verso i fianchi.' }),
      x('0861', 'sec', 'back', { note: 'Petto alto, spalle basse. Pausa di un secondo in contrazione.' }),
      x('0031', 'iso', 'biceps', { note: 'Gomiti fermi al fianco. Scendi completamente a braccio esteso.' }),
      x('0318', 'iso', 'biceps', { note: "Panca a 45°, braccia dietro il corpo: è l'angolo che allunga il capo lungo.", ss: 'B' }),
      x('0313', 'iso', 'biceps', { note: 'Presa neutra per brachiale e brachioradiale.', ss: 'B' }),
      x('0383', 'iso', 'delts', { note: 'Deltoide posteriore: carico leggero, niente trapezio.' }),
    ],
  },
  {
    key: 'D3',
    nome: 'Gambe A — Quadricipiti e Core',
    focus: 'Quadricipiti, femorali, polpacci e core anti-estensione',
    items: [
      x('0043', 'main', 'quads', { note: 'Profondità piena compatibile con la schiena neutra. Risali senza cedere di bacino.' }),
      x('0739', 'sec', 'quads', { note: 'Piedi a metà pedana, ginocchia in linea con i piedi. Non bloccare in alto.' }),
      x('0585', 'iso', 'quads', { note: 'Pausa breve in massima contrazione.', ss: 'C' }),
      x('0599', 'iso', 'hamstrings', { note: 'Discesa in 3 secondi.', ss: 'C' }),
      x('0605', 'iso', 'calves', { note: 'Pausa di 2 secondi in allungamento, salita esplosiva.' }),
      x('0472', 'core', 'abs', { note: "Bacino in retroversione: sono gli addominali a sollevare, non i flessori dell'anca." }),
      x('0175', 'core', 'abs', { note: "Flessione della colonna, non dell'anca. Avvicina lo sterno al bacino." }),
    ],
  },
  {
    key: 'D4',
    nome: 'Spalle e Petto B — Addome',
    focus: 'Deltoidi su tutti e tre i capi, petto alto, addome diretto',
    items: [
      x('0091', 'main', 'delts', { note: 'Schienale quasi verticale, addome contratto, niente iperestensione lombare.' }),
      x('0047', 'main', 'chest', { note: 'Inclinazione 30-45°, gomiti sotto i polsi.' }),
      x('0396', 'iso', 'delts', { note: 'Da seduto per togliere lo slancio.', ss: 'D' }),
      x('0178', 'iso', 'delts', { note: 'Il cavo tiene tensione anche in basso: qui il manubrio non arriva.', ss: 'D' }),
      x('0602', 'iso', 'delts', { note: 'Deltoide posteriore, gomiti alti e larghi.' }),
      x('0319', 'iso', 'chest', { note: 'Panca a 30°, ampiezza completa in basso.' }),
      x('1761', 'core', 'abs', { note: 'Obliqui: porta le ginocchia in diagonale, senza oscillare.' }),
      x('2135', 'core', 'abs', { reps: '30-45s', note: 'Isometria: 30-45 secondi con il disco sulla schiena, bacino in retroversione.' }),
    ],
  },
  {
    key: 'D5',
    nome: 'Catena posteriore e Braccia',
    focus: 'Femorali e glutei, secondo stimolo su bicipiti e tricipiti, core in anti-estensione',
    items: [
      x('0085', 'main', 'hamstrings', { note: "Anca indietro, schiena neutra, bilanciere aderente alla coscia. Fermati dove finisce l'allungamento." }),
      x('0410', 'sec', 'quads', { note: 'Piede posteriore rialzato, busto leggermente avanti. Monolaterale: parti dal lato debole.' }),
      x('0586', 'iso', 'hamstrings', { note: 'Bacino aderente alla panca, niente stacco del sedere.' }),
      x('0293', 'sec', 'back', { note: 'Secondo stimolo sul dorso a fine settimana, carico moderato.' }),
      x('0447', 'iso', 'biceps', { note: 'Bilanciere EZ per risparmiare i polsi.', ss: 'E' }),
      x('0297', 'iso', 'biceps', { note: 'Gomito appoggiato, contrazione di picco di un secondo.', ss: 'E' }),
      x('0060', 'iso', 'triceps', { note: 'Gomiti fermi, scendi dietro la fronte per caricare il capo lungo.' }),
      x('0594', 'iso', 'calves', { note: 'Da seduto: soleo, la parte che il polpaccio in piedi non copre.' }),
      x('0857', 'core', 'abs', { note: 'Ruota addominale: estendi solo fin dove il bacino resta in retroversione.' }),
    ],
  },
];

/** S2 — cavi, macchine e corpo libero zavorrato: tensione costante e curve diverse. */
const S2 = [
  {
    key: 'D1',
    nome: 'Spinta A — Petto',
    focus: 'Petto con tensione continua ai cavi, dip zavorrate, tricipiti in allungamento',
    items: [
      x('0576', 'main', 'chest', { note: 'Macchina: cerca la massima ampiezza che la spalla tollera.' }),
      x('0047', 'main', 'chest', { note: 'Il fondamentale resta anche nel blocco a macchine: serve a non perdere forza.' }),
      x('0251', 'sec', 'chest', { note: 'Zavorrate. Busto in avanti, discesa fino a 90° di gomito o poco oltre.' }),
      x('1270', 'iso', 'chest', { note: 'Cavi dal basso verso l’alto: fibre clavicolari.', ss: 'A' }),
      x('0192', 'iso', 'delts', { note: 'Un braccio alla volta, tensione piena anche in basso.', ss: 'A' }),
      x('0194', 'iso', 'triceps', { note: 'Sopra la testa: è la posizione che allunga il capo lungo.' }),
      x('0259', 'bw', 'triceps', { note: 'Presa stretta con le mani su due rialzi, per scendere piu' + String.fromCharCode(39) + ' in basso. A cedimento tecnico.' }),
    ],
  },
  {
    key: 'D2',
    nome: 'Trazione — Dorso e Bicipiti',
    focus: 'Trazioni in supinazione, remate su macchina, bicipiti ai cavi',
    items: [
      x('1326', 'main', 'lats', { reps: '5-8', note: 'Presa supina: piu facile della prona, e carica anche i bicipiti. Zavorra quando fai 8 su tutte le serie.' }),
      x('0606', 'main', 'back', { note: 'T-bar: petto appoggiato se disponibile, tira con i gomiti.' }),
      x('0245', 'sec', 'lats', { note: 'Presa supina, gomiti verso i fianchi.' }),
      x('1350', 'sec', 'back', { note: 'Pausa di un secondo in contrazione, ritorno in 3 secondi.' }),
      x('0868', 'iso', 'biceps', { note: 'Tensione costante su tutto l’arco.' }),
      x('0195', 'iso', 'biceps', { note: 'Panca scott: massima tensione nella parte bassa.', ss: 'B' }),
      x('0165', 'iso', 'biceps', { note: 'Corda, presa neutra.', ss: 'B' }),
      x('0203', 'iso', 'delts', { note: 'Rematore alto alla corda: deltoide posteriore e trapezio medio.' }),
    ],
  },
  {
    key: 'D3',
    nome: 'Gambe A — Quadricipiti e Core',
    focus: 'Quadricipiti su slitta e bilanciere frontale, core ai cavi',
    items: [
      x('0743', 'main', 'quads', { note: 'Hack squat: schiena aderente, discesa profonda.' }),
      x('0042', 'main', 'quads', { note: 'Front squat: gomiti alti, busto verticale.' }),
      x('0585', 'iso', 'quads', { ss: 'C', note: 'Serie lunga, ultime ripetizioni parziali se serve.' }),
      x('0586', 'iso', 'hamstrings', { ss: 'C', note: 'Eccentrica lenta.' }),
      x('2335', 'iso', 'calves', { note: 'Da seduto: soleo. Pausa in allungamento.' }),
      x('0873', 'core', 'abs', { note: 'Crunch inverso al cavo: arrotola il bacino.' }),
      x('0212', 'core', 'abs', { note: 'Flessione del tronco, non trazione di braccia.' }),
    ],
  },
  {
    key: 'D4',
    nome: 'Spalle e Petto B — Addome',
    focus: 'Deltoidi a tensione costante, petto ai cavi, addome in rotazione e isometria',
    items: [
      x('0603', 'main', 'delts', { note: 'Macchina: traiettoria guidata, puoi spingere più vicino al cedimento in sicurezza.' }),
      x('0169', 'main', 'chest', { note: 'Cavi su panca inclinata: tensione continua sul petto alto.' }),
      x('0178', 'iso', 'delts', { ss: 'D', note: 'Deltoide laterale, carico leggero e serie lunghe.' }),
      x('0584', 'iso', 'delts', { ss: 'D', note: 'Macchina: elimina lo slancio, perfetta per le serie finali.' }),
      x('0601', 'iso', 'delts', { note: 'Presa parallela per il deltoide posteriore.' }),
      x('1269', 'iso', 'chest', { note: 'Croci in piedi: chiudi le mani oltre la linea mediana.' }),
      x('0223', 'core', 'abs', { note: 'Flessione laterale al cavo: obliqui. Nessuna rotazione, solo inclinazione.' }),
      x('3419', 'core', 'abs', { reps: '15-30s', note: 'L-sit a terra: gambe tese quanto possibile.' }),
    ],
  },
  {
    key: 'D5',
    nome: 'Catena posteriore e Braccia',
    focus: 'Femorali con corpo libero, braccia ai cavi, core in anti-estensione',
    items: [
      x('1459', 'main', 'hamstrings', { note: 'Manubri: permettono più ampiezza del bilanciere.' }),
      x('0410', 'sec', 'quads', { note: 'Split squat bulgaro, carico moderato e controllo.' }),
      x('3193', 'bw', 'hamstrings', { note: 'Glute-ham raise: se non riesci in concentrica, lavora solo la negativa in 5 secondi e risali con le mani.' }),
      x('0189', 'sec', 'back', { note: 'Rematore monolaterale al cavo: ampiezza piena in allungamento.' }),
      x('1631', 'iso', 'biceps', { ss: 'E', note: 'Concentration curl al cavo: tensione anche in allungamento.' }),
      x('0454', 'iso', 'biceps', { ss: 'E', note: 'Spider curl: braccio davanti al corpo, picco di contrazione.' }),
      x('0241', 'iso', 'triceps', { note: 'Presa a V, gomiti fermi.' }),
      x('0594', 'iso', 'calves', { note: 'Soleo, pausa in allungamento.' }),
      x('0796', 'core', 'abs', { note: 'Ruota in piedi solo se la controlli: altrimenti resta in ginocchio.' }),
    ],
  },
];

/** S3 — angoli nuovi, enfasi su spalle e braccia. */
const S3 = [
  {
    key: 'D1',
    nome: 'Spinta A — Petto',
    focus: 'Petto con manubri e macchina, deltoide laterale, tricipiti in ripetizioni alte',
    items: [
      x('0748', 'main', 'chest', { note: 'Multipower: traiettoria guidata per spingere vicino al cedimento senza spotter.' }),
      x('0289', 'main', 'chest', { note: 'Manubri piani: ampiezza maggiore, controlla la discesa.' }),
      x('1300', 'sec', 'chest', { note: 'Declinata a macchina: fibre basse del pettorale.' }),
      x('0171', 'iso', 'chest', { ss: 'A', note: 'Croci ai cavi su inclinata.' }),
      x('0311', 'iso', 'delts', { ss: 'A', note: "Full can: pollici verso l'alto, meno conflitto sub-acromiale." }),
      x('0201', 'iso', 'triceps', { note: 'Serie lunghe, chiusura completa.' }),
      x('0259', 'bw', 'triceps', { note: 'Push-up presa stretta a cedimento tecnico.' }),
    ],
  },
  {
    key: 'D2',
    nome: 'Trazione — Dorso e Bicipiti',
    focus: 'Trazioni larghe, pendlay row, bicipiti in allungamento e contrazione',
    items: [
      x('0970', 'main', 'lats', { reps: '8-10', note: 'Trazioni con elastico: qui il volume, non la forza massima. Ogni blocco passa a un elastico piu leggero.' }),
      x('3017', 'main', 'back', { note: 'Pendlay: ogni ripetizione riparte da terra, busto parallelo.' }),
      x('0177', 'sec', 'lats', { note: 'Corda: ampiezza in chiusura maggiore della barra.' }),
      x('0571', 'sec', 'back', { note: 'Alternato: un lato alla volta, pausa in contrazione.' }),
      x('0070', 'iso', 'biceps', { note: 'Panca scott: nessun aiuto di spalla.' }),
      x('0322', 'iso', 'biceps', { ss: 'B', note: 'Inclinata presa interna: capo lungo in allungamento.' }),
      x('0298', 'iso', 'biceps', { ss: 'B', note: 'Hammer incrociato: brachiale.' }),
      x('0202', 'iso', 'delts', { note: 'Deltoide posteriore alle maniglie.' }),
    ],
  },
  {
    key: 'D3',
    nome: 'Gambe A — Quadricipiti e Core',
    focus: 'Squat pesante, pressa monolaterale, core zavorrato',
    items: [
      x('0043', 'main', 'quads', { note: 'Squat: è il blocco in cui cresce il carico, tieni il buffer dichiarato.' }),
      x('2287', 'sec', 'quads', { note: 'Pressa a gambe alternate: corregge gli squilibri.' }),
      x('0585', 'iso', 'quads', { ss: 'C' }),
      x('0599', 'iso', 'hamstrings', { ss: 'C' }),
      x('1372', 'iso', 'calves', { note: 'In piedi al bilanciere: gastrocnemio a ginocchio esteso.' }),
      x('0475', 'core', 'abs', { note: 'Gambe tese: se non arrivi a 90°, resta alle ginocchia flesse.' }),
      x('0084', 'core', 'abs', { note: 'Rollout con bilanciere: anti-estensione, arresta prima che la lombare ceda.' }),
    ],
  },
  {
    key: 'D4',
    nome: 'Spalle e Petto B — Addome',
    focus: 'Blocco spalle ad alto volume: spinta, tre alzate, tirata alta',
    items: [
      x('0765', 'main', 'delts', { note: 'Multipower da seduto: spingi in sicurezza vicino al cedimento.' }),
      x('0314', 'main', 'chest', { note: 'Petto alto, secondo stimolo settimanale.' }),
      x('0355', 'iso', 'delts', { ss: 'D', note: 'Monolaterale: più ampiezza e controllo.' }),
      x('0178', 'iso', 'delts', { ss: 'D', note: 'Al cavo, serie lunga finale.' }),
      x('0380', 'iso', 'delts', { note: 'Deltoide posteriore con manubri.' }),
      x('0246', 'sec', 'delts', { note: "Tirata al cavo: fermati all'altezza dello sterno, niente presa stretta." }),
      x('1761', 'core', 'abs', { note: 'Obliqui alla sbarra.' }),
      x('0874', 'core', 'abs', { note: 'Crunch in piedi alla corda: retto addominale sotto carico.' }),
    ],
  },
  {
    key: 'D5',
    nome: 'Catena posteriore e Braccia',
    focus: 'Stacco a gambe tese, glutei, terzo stimolo su bicipiti e tricipiti',
    items: [
      x('0116', 'main', 'hamstrings', { note: 'Gambe tese: ampiezza fin dove la schiena resta neutra.' }),
      x('1409', 'sec', 'glutes', { note: 'Glute bridge con bilanciere: pausa di 2 secondi in alto.' }),
      x('0582', 'iso', 'hamstrings', { note: 'In ginocchio: ampiezza diversa dal leg curl sdraiato.' }),
      x('1349', 'sec', 'back', { note: 'T-bar presa inversa: dorsali bassi.' }),
      x('0446', 'iso', 'biceps', { ss: 'E', note: 'EZ presa stretta: capo esterno.' }),
      x('0190', 'iso', 'biceps', { ss: 'E', note: 'Monolaterale al cavo, contrazione di picco.' }),
      x('0092', 'iso', 'triceps', { note: 'Sopra la testa da seduto: capo lungo in allungamento.' }),
      x('0594', 'iso', 'calves', { note: 'Soleo: completa il lavoro in piedi del mercoledi.' }),
      x('0687', 'core', 'abs', { note: 'Russian twist: rotazione dal tronco, non dalle braccia.' }),
    ],
  },
];

/** S4 — enfasi petto e addome, esercizi che caricano l'allungamento. */
const S4 = [
  {
    key: 'D1',
    nome: 'Spinta A — Petto',
    focus: 'Blocco petto ad alto volume: inclinata, piana, dip e due isolamenti',
    items: [
      x('0047', 'main', 'chest', { note: 'Inclinata per prima: la parte alta riceve il carico da fresco.' }),
      x('0289', 'main', 'chest', { note: 'Manubri piani, discesa profonda e controllata.' }),
      x('0251', 'sec', 'chest', { note: 'Zavorrate, busto avanti.' }),
      x('1270', 'iso', 'chest', { ss: 'A', note: 'Cavi dal basso: petto alto.' }),
      x('0334', 'iso', 'delts', { note: 'Alzate laterali per non perdere il deltoide in questo blocco.' }),
      x('0200', 'iso', 'triceps', { note: 'Corda, apertura in chiusura.' }),
      x('0279', 'bw', 'chest', { note: 'Push-up con piedi rialzati a cedimento: finisher metabolico.' }),
    ],
  },
  {
    key: 'D2',
    nome: 'Trazione — Dorso e Bicipiti',
    focus: 'Dorso completo e bicipiti su tre angoli',
    items: [
      x('0652', 'main', 'lats', { reps: '6-10', note: 'A questo punto dell anno le trazioni devono essere il tuo esercizio, non il tuo ostacolo. Zavorra quando superi il tetto.' }),
      x('0574', 'main', 'back', { note: 'Rematore su macchina: carico alto senza tassare la lombare.' }),
      x('0818', 'sec', 'lats', { note: 'Presa parallela: ampiezza piena.' }),
      x('0180', 'sec', 'back', { note: 'Pulley basso, pausa in contrazione.' }),
      x('0447', 'iso', 'biceps', { note: 'EZ in piedi, carico principale del giorno.' }),
      x('0315', 'iso', 'biceps', { ss: 'B', note: 'Inclinata: allungamento massimo.' }),
      x('0313', 'iso', 'biceps', { ss: 'B', note: 'Hammer: brachiale e avambraccio.' }),
      x('0383', 'iso', 'delts', { note: 'Deltoide posteriore.' }),
    ],
  },
  {
    key: 'D3',
    nome: 'Gambe A — Quadricipiti e Core',
    focus: 'Quadricipiti su macchine, core ad alto volume',
    items: [
      x('0755', 'main', 'quads', { note: 'Hack al multipower: discesa profonda, schiena aderente.' }),
      x('0739', 'sec', 'quads', { note: 'Pressa: serie lunghe.' }),
      x('0585', 'iso', 'quads', { ss: 'C' }),
      x('0586', 'iso', 'hamstrings', { ss: 'C' }),
      x('0605', 'iso', 'calves', { note: 'Pausa di 2 secondi in basso.' }),
      x('0857', 'core', 'abs', { note: 'Ruota addominale.' }),
      x('0472', 'core', 'abs', { note: 'Sollevamento gambe alla sbarra, bacino in retroversione.' }),
    ],
  },
  {
    key: 'D4',
    nome: 'Spalle e Petto B — Addome',
    focus: 'Deltoidi, secondo stimolo petto, addome diretto e obliqui',
    items: [
      x('0426', 'main', 'delts', { note: 'In piedi: più core, meno carico. Nessun compenso lombare.' }),
      x('0576', 'main', 'chest', { note: 'Macchina: spingi vicino al cedimento in sicurezza.' }),
      x('0178', 'iso', 'delts', { ss: 'D' }),
      x('0323', 'iso', 'delts', { ss: 'D', note: 'Su panca inclinata laterale: tensione anche in basso.' }),
      x('0602', 'iso', 'delts', { note: 'Deltoide posteriore a macchina.' }),
      x('3419', 'core', 'abs', { reps: '15-30s', note: 'L-sit a terra: addome sotto tensione massima.' }),
      x('0175', 'core', 'abs', { note: 'Crunch in ginocchio al cavo, carico progressivo.' }),
    ],
  },
  {
    key: 'D5',
    nome: 'Catena posteriore e Braccia',
    focus: 'Femorali e glutei, chiusura su braccia e core',
    items: [
      x('0085', 'main', 'hamstrings', { note: 'Stacco rumeno: il carico sale solo se la schiena resta neutra.' }),
      x('2368', 'sec', 'quads', { note: 'Split squat a corpo libero o con manubri: controllo e ampiezza.' }),
      x('3193', 'bw', 'hamstrings', { note: 'Glute-ham raise, negativa in 5 secondi.' }),
      x('0293', 'sec', 'back', { note: 'Rematore con manubri, secondo stimolo dorso.' }),
      x('1627', 'iso', 'biceps', { ss: 'E', note: 'Scott EZ presa stretta.' }),
      x('0165', 'iso', 'biceps', { ss: 'E', note: 'Hammer alla corda.' }),
      x('0060', 'iso', 'triceps', { note: 'Skull crusher, gomiti fermi.' }),
      x('0594', 'iso', 'calves', { note: 'Soleo, pausa in allungamento.' }),
      x('0826', 'core', 'abs', { note: 'Sollevamento gambe alle parallele: se le tieni tese, meglio.' }),
    ],
  },
];

const SELEZIONI = { S1, S2, S3, S4 };

/* ------------------------------------------------------------------ blocchi */

const BLOCCHI = [
  { sigla: 'B1', nome: 'Riadattamento e tecnica', settimane: 4, sel: 'S1', prof: 'P0', taratura: true,
    focus: 'Ricostruire tecnica e tolleranza al volume. RIR 3, nessun cedimento.' },
  { sigla: 'B2', nome: 'Accumulo I', settimane: 5, sel: 'S1', prof: 'P1',
    focus: 'Volume in crescita su petto, spalle, bicipiti e addome. RIR 2 che scende a 1.' },
  { sigla: 'D1', nome: 'Scarico 1', settimane: 1, sel: 'S1', prof: 'PD', scarico: true,
    focus: 'Metà volume, carichi al 60%. Si torna in palestra riposati: fermarsi del tutto non recupera, riduce.' },
  { sigla: 'B3', nome: 'Intensificazione I', settimane: 5, sel: 'S1', prof: 'P2',
    focus: 'Ripetizioni più basse e carichi più alti sugli stessi esercizi. Ultima serie a RIR 0 sugli isolamenti.' },
  { sigla: 'D2', nome: 'Scarico 2', settimane: 1, sel: 'S1', prof: 'PD', scarico: true,
    focus: 'Scarico prima del cambio di selezione esercizi.' },
  { sigla: 'B4', nome: 'Accumulo metabolico', settimane: 5, sel: 'S2', prof: 'P3',
    focus: 'Ripetizioni alte, recuperi corti, tensione continua ai cavi. Stimolo diverso sugli stessi muscoli.' },
  { sigla: 'D3', nome: 'Scarico 3', settimane: 1, sel: 'S2', prof: 'PD', scarico: true,
    focus: 'Scarico dopo il blocco più affaticante sul piano metabolico.' },
  { sigla: 'B5', nome: 'Forza-ipertrofia', settimane: 5, sel: 'S2', prof: 'P4',
    focus: 'Fondamentali a 5-6 ripetizioni: si alza il tetto di forza che servirà nei blocchi di volume successivi.' },
  { sigla: 'D4', nome: 'Scarico 4', settimane: 1, sel: 'S2', prof: 'PD', scarico: true,
    focus: 'Scarico articolare dopo il blocco di forza.' },
  { sigla: 'B6', nome: 'Accumulo III', settimane: 5, sel: 'S3', prof: 'P5',
    focus: "Volume più alto dell'anno sui prioritari, con la forza guadagnata nel blocco precedente." },
  { sigla: 'D5', nome: 'Scarico 5', settimane: 1, sel: 'S3', prof: 'PD', scarico: true, focus: 'Scarico.' },
  { sigla: 'B7', nome: 'Specializzazione braccia e spalle', settimane: 5, sel: 'S3', prof: 'P6',
    focus: 'Serie extra su deltoidi, bicipiti e tricipiti. Gambe e dorso a volume di mantenimento.' },
  { sigla: 'D6', nome: 'Scarico 6', settimane: 1, sel: 'S3', prof: 'PD', scarico: true, focus: 'Scarico.' },
  { sigla: 'B8', nome: 'Specializzazione petto e addome', settimane: 5, sel: 'S4', prof: 'P7',
    focus: 'Serie extra su petto e addome. Spalle e bicipiti restano allenati ma non in specializzazione.' },
  { sigla: 'D7', nome: 'Scarico 7', settimane: 1, sel: 'S4', prof: 'PD', scarico: true, focus: 'Scarico.' },
  { sigla: 'B9', nome: 'Picco e consolidamento', settimane: 5, sel: 'S4', prof: 'P8',
    focus: 'Ultimo blocco: intensità alta su tutto, tecniche di intensità sulle ultime serie di isolamento.' },
  { sigla: 'D8', nome: 'Scarico finale', settimane: 1, sel: 'S4', prof: 'PD', scarico: true,
    focus: "Chiusura dell'anno. Da qui si riparte con nuovi massimali e la stessa struttura." },
];

/* -------------------------------------------------------------- costruzione */

const PROBLEMI = [];

function unita(ex) {
  // la ruota addominale non ha carico: il peso e' il tuo
  if (['body weight', 'wheel roller', 'roller'].includes(ex.eq)) return 'corpo';
  if (ex.eq === 'band' || ex.eq === 'resistance band') return 'elastico';
  return 'kg';
}

/**
 * La serie in più dei blocchi di specializzazione va sugli isolamenti e sul
 * core, mai sui fondamentali: lì costerebbe cinque minuti di seduta e molta
 * più fatica sistemica per lo stesso stimolo locale. Al massimo una serie.
 */
function serieBonus(item, profilo) {
  if (!['iso', 'core', 'bw'].includes(item.role)) return 0;
  if (profilo.bonus.includes(item.m)) return 1;
  if (profilo.malus?.includes(item.m)) return -1;
  return 0;
}

function costruisciItem(item, profilo, taratura) {
  const ex = PER_ID.get(item.id);
  if (!ex) {
    PROBLEMI.push(`id ${item.id} non presente nel catalogo`);
    return null;
  }
  const r = profilo.ruoli[item.role];
  const note = [`RIR ${r.rir}`, item.note].filter(Boolean).join(' · ');
  return {
    ref: { type: 'catalog', id: item.id },
    sets: r.sets + serieBonus(item, profilo),
    reps: item.reps ?? r.reps,
    ...(taratura && CARICHI[item.id] ? { load: CARICHI[item.id] } : {}),
    loadUnit: unita(ex),
    restSec: r.rest,
    ...(r.tempo ? { tempo: r.tempo } : {}),
    notes: note,
    ...(item.ss ? { supersetGroup: item.ss } : {}),
  };
}

/** Nei giorni di scarico si tengono i primi quattro esercizi, senza finisher. */
function giorniScarico(sel) {
  return [sel[0], sel[1], sel[2]].map((g) => ({
    ...g,
    nome: `Scarico — ${g.nome.split(' — ')[0]}`,
    focus: 'Metà volume, carichi al 60%, nessuna serie vicina al cedimento.',
    items: g.items.filter((i) => i.role !== 'bw').slice(0, 4),
  }));
}

function lunediSuccessivo(d) {
  const out = new Date(d);
  const delta = (8 - out.getDay()) % 7 || 7;
  out.setDate(out.getDate() + delta);
  return out;
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const argData = process.argv[2];
if (argData && !/^\d{4}-\d{2}-\d{2}$/.test(argData)) {
  console.error('Data di inizio non valida: usa il formato YYYY-MM-DD.');
  process.exit(1);
}
const inizio = argData ? new Date(`${argData}T00:00:00`) : lunediSuccessivo(new Date());
if (Number.isNaN(inizio.getTime())) {
  console.error('Data di inizio non valida.');
  process.exit(1);
}

const ora = Date.now();
const workouts = [];
const blocks = [];
const planEntries = [];
const PIANO_ID = 'beest-piano-annuale-ipertrofia';

let settimanaCorrente = 0;
let progressivo = 0;

for (const b of BLOCCHI) {
  const profilo = PROFILI[b.prof];
  const giorni = b.scarico ? giorniScarico(SELEZIONI[b.sel]) : SELEZIONI[b.sel];
  const idWorkout = [];

  for (const g of giorni) {
    const id = `wk-${b.sigla.toLowerCase()}-${g.key.toLowerCase()}`;
    const items = g.items.map((i) => costruisciItem(i, profilo, b.taratura)).filter(Boolean);
    workouts.push({
      id,
      name: `${b.sigla} · ${g.nome}`,
      notes: `${b.nome} — ${g.focus}`,
      tags: ['piano annuale', 'ipertrofia', b.nome],
      items,
      createdAt: ora,
      updatedAt: ora,
    });
    idWorkout.push(id);
  }

  const weekPattern = b.scarico
    ? [idWorkout[0], null, idWorkout[1], null, idWorkout[2], null, null]
    : [idWorkout[0], idWorkout[1], idWorkout[2], null, idWorkout[3], idWorkout[4], null];

  const blockId = `bl-${b.sigla.toLowerCase()}`;
  blocks.push({ id: blockId, name: `${b.sigla} · ${b.nome}`, weeks: b.settimane, focus: b.focus, weekPattern });

  for (let w = 0; w < b.settimane; w++) {
    for (let d = 0; d < 7; d++) {
      const wid = weekPattern[d];
      if (!wid) continue;
      const data = new Date(inizio);
      data.setDate(data.getDate() + (settimanaCorrente + w) * 7 + d);
      planEntries.push({
        id: `pe-${String(++progressivo).padStart(4, '0')}`,
        planId: PIANO_ID,
        blockId,
        date: iso(data),
        workoutId: wid,
        status: 'previsto',
      });
    }
  }
  settimanaCorrente += b.settimane;
}

if (PROBLEMI.length) {
  console.error('Il piano non è stato generato:');
  for (const p of PROBLEMI) console.error(` - ${p}`);
  process.exit(1);
}

if (settimanaCorrente !== 52) {
  console.error(`I blocchi coprono ${settimanaCorrente} settimane invece di 52.`);
  process.exit(1);
}

const backup = {
  app: 'the-beest',
  version: 1,
  exportedAt: new Date().toISOString(),
  workouts,
  customExercises: [],
  plans: [
    {
      id: PIANO_ID,
      name: 'Anno di ipertrofia — focus bicipiti, petto, spalle, addome',
      startDate: iso(inizio),
      blocks,
      createdAt: ora,
      updatedAt: ora,
    },
  ],
  planEntries,
  sessions: [],
};

const destinazione = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(ROOT, 'piano-annuale-ipertrofia.json');
fs.mkdirSync(path.dirname(destinazione), { recursive: true });
fs.writeFileSync(destinazione, JSON.stringify(backup, null, 2));

/* ------------------------------------------------------- riepilogo a schermo */

/**
 * Range settimanali di riferimento: sotto il minimo il muscolo non cresce,
 * sopra il massimo si accumula fatica che non si traduce in ipertrofia. I
 * prioritari stanno in alto, gli altri in mezzo. Il conteggio è in serie
 * dirette; le indirette vengono riportate a parte, contate a metà.
 */
const FASE = { B1: 1, B2: 1, B3: 1, B4: 2, B5: 2, B6: 2, B7: 3, B8: 3, B9: 3 };
const SCALA_FASE = { 1: 1, 2: 1.15, 3: 1.3 };

const RANGE = {
  chest: [12, 20], delts: [12, 20], biceps: [10, 18], abs: [9, 18],
  back: [7, 13], lats: [5, 11], quads: [8, 14], hamstrings: [6, 12],
  glutes: [0, 12], calves: [4, 9], triceps: [5, 12],
};

const VOLUME = {};
const AVVISI = [];

for (const b of BLOCCHI) {
  if (b.scarico) continue;
  const profilo = PROFILI[b.prof];
  const diretto = {};
  const indiretto = {};
  for (const g of SELEZIONI[b.sel]) {
    for (const i of g.items) {
      const serie = profilo.ruoli[i.role].sets + serieBonus(i, profilo);
      diretto[i.m] = (diretto[i.m] ?? 0) + serie;
      const sinergista = PER_ID.get(i.id)?.mg;
      if (sinergista && sinergista !== i.m) {
        indiretto[sinergista] = (indiretto[sinergista] ?? 0) + serie / 2;
      }
    }
  }
  VOLUME[b.sigla] = { diretto, indiretto };

  for (const [m, [minBase, maxBase]] of Object.entries(RANGE)) {
    // Nel riadattamento il volume è volutamente basso, e nei blocchi di
    // specializzazione i muscoli non-target scendono a volume di mantenimento:
    // in entrambi i casi il minimo di crescita non è il metro giusto.
    const max = Math.round(maxBase * SCALA_FASE[FASE[b.sigla] ?? 1]);
    let min = minBase;
    if (b.prof === 'P0') min = Math.round(minBase * 0.7);
    if (profilo.malus?.includes(m)) min = Math.round(minBase * 0.6);
    const d = diretto[m] ?? 0;
    if (d < min) AVVISI.push(`${b.sigla} (${b.nome}): ${m} a ${d} serie dirette, sotto il minimo di ${min}.`);
    if (d > max) AVVISI.push(`${b.sigla} (${b.nome}): ${m} a ${d} serie dirette, oltre il tetto di ${max}.`);
  }
}

/** Stima grossolana: ~40 secondi di lavoro per serie più il recupero previsto. */
const SEDUTE_LUNGHE = [];
for (const w of workouts) {
  const serie = w.items.reduce((s, i) => s + i.sets, 0);
  const secondi = w.items.reduce((s, i) => s + i.sets * (40 + (i.supersetGroup ? i.restSec / 2 : i.restSec)), 0);
  const minuti = Math.round(secondi / 60);
  if (minuti > 90) SEDUTE_LUNGHE.push(`${w.name}: ${serie} serie, ~${minuti} minuti stimati.`);
}

console.log(`File scritto: ${destinazione}`);
console.log(`Inizio: ${iso(inizio)} — 52 settimane, ${blocks.length} blocchi, ${workouts.length} schede, ${planEntries.length} sedute a calendario.`);

const sigle = Object.keys(VOLUME);
const muscoli = Object.keys(RANGE);
console.log('\nSerie a settimana per muscolo, blocchi di carico (dirette + indirette):');
console.log(['muscolo'.padEnd(11), ...sigle.map((s) => s.padStart(8))].join(' '));
for (const m of muscoli) {
  const celle = sigle.map((s) => {
    const d = VOLUME[s].diretto[m] ?? 0;
    const i = VOLUME[s].indiretto[m] ?? 0;
    return `${d}+${i}`.padStart(8);
  });
  console.log([m.padEnd(11), ...celle].join(' '));
}

if (AVVISI.length) {
  console.log('\nVolumi fuori range:');
  for (const a of AVVISI) console.log(` - ${a}`);
} else {
  console.log('\nVolumi entro i range di riferimento in tutti i blocchi di carico.');
}

if (SEDUTE_LUNGHE.length) {
  console.log('\nSedute oltre i 90 minuti stimati:');
  for (const s of SEDUTE_LUNGHE) console.log(` - ${s}`);
} else {
  console.log('Nessuna seduta supera i 90 minuti stimati.');
}
