import { describe, expect, it } from 'vitest';
import { parseLine, parseWorkoutText } from './importParser';

const p = (line: string) => parseLine(line)!;

describe('una riga di scheda', () => {
  it('legge il formato più comune', () => {
    const row = p('Panca piana 4x8 60kg rec 90"');
    expect(row.name).toBe('Panca piana');
    expect(row.sets).toBe(4);
    expect(row.reps).toBe('8');
    expect(row.load).toBe(60);
    expect(row.restSec).toBe(90);
  });

  it('accetta spazi e il segno per', () => {
    const row = p('Squat 3 × 10 @ 80 kg');
    expect(row.name).toBe('Squat');
    expect(row.sets).toBe(3);
    expect(row.load).toBe(80);
  });

  it('non scambia le serie per un carico', () => {
    const row = p('Curl manubri 3x12');
    expect(row.sets).toBe(3);
    expect(row.reps).toBe('12');
    expect(row.load).toBeUndefined();
  });

  it('tiene gli intervalli di ripetizioni', () => {
    expect(p('Lat machine 4x10-12 45kg').reps).toBe('10-12');
  });

  it('capisce le ripetizioni a parole', () => {
    expect(p('Trazioni 4 x max').reps).toBe('max');
    expect(p('Dip 3xcedimento').reps).toBe('cedimento');
  });

  it('tiene le ripetizioni a tempo', () => {
    expect(p('Plank 3x30s').reps).toBe('30s');
  });

  it('legge i decimali con la virgola', () => {
    expect(p('Panca 5x5 82,5 kg').load).toBe(82.5);
  });

  it('capisce il recupero in minuti', () => {
    expect(p("Stacchi 5x3 140kg rec 3'").restSec).toBe(180);
    expect(p('Stacchi 5x3 140kg recupero 2 min').restSec).toBe(120);
  });

  it('capisce il recupero in secondi in tutte le grafie', () => {
    expect(p('Rematore 4x10 rest 75s').restSec).toBe(75);
    expect(p('Rematore 4x10 r. 45').restSec).toBe(45);
  });

  it('toglie numerazioni e trattini iniziali', () => {
    expect(p('1) Panca piana 4x8').name).toBe('Panca piana');
    expect(p('- Squat 5x5 100kg').name).toBe('Squat');
    expect(p('• Leg press 4x12').name).toBe('Leg press');
  });

  it('prende le note fra parentesi', () => {
    const row = p('Panca piana 4x8 60kg (presa larga)');
    expect(row.notes).toBe('presa larga');
    expect(row.name).toBe('Panca piana');
  });

  it('tiene in piedi una riga senza numeri', () => {
    const row = p('Riscaldamento tapis roulant');
    expect(row.name).toBe('Riscaldamento tapis roulant');
    expect(row.sets).toBeUndefined();
  });

  it('conserva sempre la riga originale', () => {
    expect(p('Panca piana 4x8 60kg').raw).toBe('Panca piana 4x8 60kg');
  });

  it('ignora le righe vuote', () => {
    expect(parseLine('   ')).toBeNull();
  });

  it('non confonde il recupero con il carico', () => {
    const row = p('Leg press 4x10 120 kg r 120"');
    expect(row.load).toBe(120);
    expect(row.restSec).toBe(120);
  });
});

describe('una scheda intera', () => {
  const testo = `Giorno A - Spinta
1) Panca piana 4x8 60kg rec 90"
2) Lento avanti 3x10 30kg
3) Alzate laterali 3x15 8kg rec 45

Giorno B - Trazione
Trazioni 4xmax
Rematore bilanciere 4x10 50kg (busto a 45 gradi)`;

  const schede = parseWorkoutText(testo);

  it('divide in schede sui titoli di giornata', () => {
    expect(schede).toHaveLength(2);
    expect(schede[0].name).toBe('Giorno A - Spinta');
    expect(schede[1].name).toBe('Giorno B - Trazione');
  });

  it('mette ogni esercizio nella sua scheda', () => {
    expect(schede[0].rows).toHaveLength(3);
    expect(schede[1].rows).toHaveLength(2);
  });

  it('legge i dati di ogni riga', () => {
    expect(schede[0].rows[0]).toMatchObject({ name: 'Panca piana', sets: 4, reps: '8', load: 60, restSec: 90 });
    expect(schede[1].rows[1].notes).toBe('busto a 45 gradi');
  });

  it('funziona anche senza titoli', () => {
    const senza = parseWorkoutText('Panca 4x8 60kg\nSquat 5x5 100kg');
    expect(senza).toHaveLength(1);
    expect(senza[0].name).toBe('Scheda importata');
    expect(senza[0].rows).toHaveLength(2);
  });

  it('riconosce i giorni della settimana come titoli', () => {
    const sett = parseWorkoutText('Lunedì\nPanca 4x8\nMercoledì\nSquat 5x5');
    expect(sett.map((s) => s.name)).toEqual(['Lunedì', 'Mercoledì']);
  });

  it('butta via le schede rimaste vuote', () => {
    expect(parseWorkoutText('Giorno A\n\nGiorno B\nSquat 5x5')).toHaveLength(1);
  });

  it('non si perde le righe che non capisce', () => {
    const misto = parseWorkoutText('Panca 4x8 60kg\nStretching finale\nDefaticamento 10 minuti');
    expect(misto[0].rows).toHaveLength(3);
  });
});
