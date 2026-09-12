/**
 * Vocabolario italiano del progetto.
 *
 * Il dataset è interamente in inglese tranne le istruzioni. I nomi degli
 * esercizi restano in inglese per scelta (sono quelli che si usano in
 * palestra), ma tutto il resto — filtri, tassonomie, ricerca — deve
 * funzionare in italiano. Qui stanno le tre tabelle che lo permettono:
 *
 *  1. MUSCLE_CANON   normalizza i doppioni del dataset (traps/trapezius…)
 *  2. *_IT           etichette italiane di body part, attrezzi, muscoli
 *  3. NAME_ALIASES   frasi inglesi dei nomi -> termini italiani da indicizzare
 *
 * Scritto a mano, nessuna traduzione automatica.
 */

/** Doppioni del dataset ricondotti a una chiave sola. */
export const MUSCLE_CANON = {
  abdominals: 'abs',
  'lower abs': 'abs',
  'latissimus dorsi': 'lats',
  trapezius: 'traps',
  quadriceps: 'quads',
  deltoids: 'delts',
  shoulders: 'delts',
  pectorals: 'chest',
  'upper chest': 'chest',
  'inner thighs': 'adductors',
  groin: 'adductors',
  'grip muscles': 'hands',
  'ankle stabilizers': 'ankles',
};

/** Etichette italiane dei muscoli (chiavi già normalizzate da MUSCLE_CANON). */
export const MUSCLE_IT = {
  abs: 'Addominali',
  abductors: 'Abduttori',
  adductors: 'Adduttori',
  ankles: 'Caviglie',
  back: 'Schiena',
  biceps: 'Bicipiti',
  brachialis: 'Brachiale',
  calves: 'Polpacci',
  'cardiovascular system': 'Sistema cardiovascolare',
  chest: 'Petto',
  core: 'Core',
  delts: 'Deltoidi',
  feet: 'Piedi',
  forearms: 'Avambracci',
  glutes: 'Glutei',
  hamstrings: 'Femorali',
  hands: 'Mani e presa',
  'hip flexors': "Flessori dell'anca",
  lats: 'Dorsali',
  'levator scapulae': 'Elevatore della scapola',
  'lower back': 'Lombari',
  obliques: 'Obliqui',
  quads: 'Quadricipiti',
  'rear deltoids': 'Deltoidi posteriori',
  rhomboids: 'Romboidi',
  'rotator cuff': 'Cuffia dei rotatori',
  'serratus anterior': 'Dentato anteriore',
  shins: 'Tibiali',
  soleus: 'Soleo',
  spine: 'Colonna vertebrale',
  sternocleidomastoid: 'Sternocleidomastoideo',
  traps: 'Trapezi',
  triceps: 'Tricipiti',
  'upper back': 'Parte alta della schiena',
  'wrist extensors': 'Estensori del polso',
  'wrist flexors': 'Flessori del polso',
  wrists: 'Polsi',
};

/** Le 10 parti del corpo del dataset. Sono i filtri di primo livello. */
export const BODY_PART_IT = {
  back: 'Schiena',
  cardio: 'Cardio',
  chest: 'Petto',
  'lower arms': 'Avambracci',
  'lower legs': 'Polpacci',
  neck: 'Collo',
  shoulders: 'Spalle',
  'upper arms': 'Braccia',
  'upper legs': 'Gambe',
  waist: 'Addome',
};

/** I 28 attrezzi del dataset, con il nome che si usa davvero in palestra. */
export const EQUIPMENT_IT = {
  assisted: 'Assistito',
  band: 'Elastico',
  barbell: 'Bilanciere',
  'body weight': 'Corpo libero',
  'bosu ball': 'Bosu',
  cable: 'Cavi',
  dumbbell: 'Manubri',
  'elliptical machine': 'Ellittica',
  'ez barbell': 'Bilanciere EZ',
  hammer: 'Martello',
  kettlebell: 'Kettlebell',
  'leverage machine': 'Macchina a leva',
  'medicine ball': 'Palla medica',
  'olympic barbell': 'Bilanciere olimpico',
  'resistance band': 'Banda elastica',
  roller: 'Roller',
  rope: 'Corda',
  'skierg machine': 'SkiErg',
  'sled machine': 'Slitta',
  'smith machine': 'Multipower',
  'stability ball': 'Fitball',
  'stationary bike': 'Cyclette',
  'stepmill machine': 'Stepper',
  tire: 'Pneumatico',
  'trap bar': 'Trap bar',
  'upper body ergometer': 'Ergometro braccia',
  weighted: 'Con sovraccarico',
  'wheel roller': 'Ruota addominali',
};

/**
 * Alias italiani: frase inglese presente nel nome -> termini italiani.
 * Applicati al nome in fase di ingestion per costruire il blob di ricerca,
 * così cercare "panca piana" trova "barbell bench press".
 * Ordine irrilevante: il match è per sottostringa sul nome normalizzato.
 */
export const NAME_ALIASES = {
  // --- spinta orizzontale
  'bench press': 'panca piana distensioni su panca',
  'incline bench press': 'panca inclinata',
  'decline bench press': 'panca declinata',
  'chest press': 'chest press spinte petto',
  'push-up': 'piegamenti flessioni push up',
  'push up': 'piegamenti flessioni push up',
  pushup: 'piegamenti flessioni',
  dip: 'dip parallele',
  fly: 'croci apertura',
  flye: 'croci apertura',
  pullover: 'pullover',
  // --- trazione
  'pull-up': 'trazioni alla sbarra',
  'pull up': 'trazioni alla sbarra',
  'chin-up': 'trazioni presa supina',
  pulldown: 'lat machine tirata al petto',
  'lat pulldown': 'lat machine',
  row: 'rematore pulley tirata',
  'bent over row': 'rematore bilanciere busto flesso',
  'upright row': 'tirate al mento',
  shrug: 'scrollate trapezi',
  'face pull': 'face pull tirata al viso',
  // --- spalle
  'shoulder press': 'lento avanti distensioni spalle',
  'overhead press': 'lento avanti distensioni sopra la testa',
  'military press': 'military press lento avanti',
  'lateral raise': 'alzate laterali',
  'front raise': 'alzate frontali',
  'rear lateral raise': 'alzate posteriori',
  'reverse fly': 'alzate posteriori croci inverse',
  'arnold press': 'arnold press',
  // --- braccia
  curl: 'curl',
  'biceps curl': 'curl bicipiti',
  'hammer curl': 'curl a martello',
  'preacher curl': 'curl panca scott',
  'concentration curl': 'curl concentrato',
  'spider curl': 'curl spider',
  'wrist curl': 'curl polsi',
  'triceps extension': 'estensioni tricipiti',
  'skull crusher': 'french press',
  'lying triceps extension': 'french press sdraiato',
  pushdown: 'push down tricipiti cavi',
  kickback: 'kickback tricipiti',
  'close grip bench press': 'panca presa stretta',
  // --- gambe
  squat: 'squat accosciata',
  'front squat': 'squat frontale',
  'hack squat': 'hack squat',
  'split squat': 'squat bulgaro affondo statico',
  deadlift: 'stacco da terra stacchi',
  'romanian deadlift': 'stacco rumeno',
  'stiff leg deadlift': 'stacco a gambe tese',
  'sumo deadlift': 'stacco sumo',
  'leg press': 'pressa',
  'leg extension': 'leg extension estensioni gambe',
  'leg curl': 'leg curl femorali',
  lunge: 'affondi',
  'step-up': 'step up salita',
  'calf raise': 'calf alzate polpacci',
  'calf press': 'calf alla pressa',
  'hip thrust': 'hip thrust spinta pelvica',
  'glute bridge': 'ponte glutei',
  'good morning': 'good morning',
  'hip abduction': 'abduzione anca',
  'hip adduction': 'adduzione anca',
  // --- addome e schiena
  crunch: 'crunch addominali',
  'sit-up': 'sit up addominali',
  situp: 'sit up addominali',
  plank: 'plank',
  'russian twist': 'torsioni russe',
  'leg raise': 'sollevamento gambe',
  'knee raise': 'sollevamento ginocchia',
  'side bend': 'flessioni laterali busto',
  hyperextension: 'iperestensioni lombari',
  'back extension': 'estensioni lombari',
  'wood chop': 'wood chop torsione',
  // --- olimpici, functional, cardio
  clean: 'girata',
  snatch: 'strappo',
  jerk: 'slancio',
  thruster: 'thruster',
  swing: 'swing',
  burpee: 'burpee',
  'mountain climber': 'mountain climber',
  'jump rope': 'saltelli corda',
  'jumping jack': 'jumping jack',
  'farmers walk': 'camminata del contadino',
  run: 'corsa',
  treadmill: 'tapis roulant corsa',
  bike: 'bici cyclette',
  cycle: 'cyclette',
  rowing: 'vogatore',
  stretch: 'allungamento stretching',
  // --- attrezzi nel nome
  barbell: 'bilanciere',
  dumbbell: 'manubri manubrio',
  cable: 'cavi cavo',
  kettlebell: 'kettlebell',
  band: 'elastico',
  smith: 'multipower',
  lever: 'macchina leva',
  machine: 'macchina',
  sled: 'slitta',
  'medicine ball': 'palla medica',
  'stability ball': 'fitball',
  'exercise ball': 'fitball palla',
  'bosu ball': 'bosu',
  'trap bar': 'trap bar',
  'ez barbell': 'bilanciere ez',
  weighted: 'zavorrato con peso',
  assisted: 'assistito',
  // --- modificatori di posizione e presa
  seated: 'seduto seduta',
  standing: 'in piedi',
  lying: 'sdraiato disteso',
  kneeling: 'in ginocchio',
  incline: 'inclinata inclinato',
  decline: 'declinata declinato',
  'one arm': 'un braccio monobraccio',
  'single leg': 'una gamba monopodalico',
  alternate: 'alternato',
  'close grip': 'presa stretta',
  'wide grip': 'presa larga',
  'reverse grip': 'presa inversa prona',
  'neutral grip': 'presa neutra',
  behind: 'dietro',
  overhead: 'sopra la testa',
  // --- parti del corpo nel nome
  chest: 'petto pettorali',
  back: 'schiena dorso',
  shoulder: 'spalle spalla',
  leg: 'gamba gambe',
  arm: 'braccio braccia',
  glute: 'glutei',
  hamstring: 'femorali',
  quad: 'quadricipiti',
  calf: 'polpaccio',
  abs: 'addominali',
  oblique: 'obliqui',
  triceps: 'tricipiti',
  biceps: 'bicipiti',
  forearm: 'avambraccio',
  neck: 'collo',
  hip: 'anca fianchi',
};

/** Correzioni puntuali sui nomi: mojibake del dataset. */
export const NAME_FIXES = [[/в°/g, '°']];

/**
 * I 6 nomi duplicati del dataset: stesso nome, stessa attrezzatura, stesso
 * target. Il secondo id in ordine crescente prende il suffisso di variante,
 * usando la stessa convenzione già presente nel dataset ("v. 2").
 */
export const DUPLICATE_SUFFIX = ' v. 2';
