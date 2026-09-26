import { describe, expect, it } from 'vitest';
import { toLines } from './pdf';

/** Un frammento come lo restituisce pdf.js: testo, larghezza e posizione. */
const piece = (str: string, x: number, y: number, w = str.length * 5) => ({
  str,
  width: w,
  transform: [1, 0, 0, 1, x, y],
});

describe('toLines', () => {
  it('mette insieme i frammenti della stessa riga', () => {
    expect(toLines([piece('Panca', 50, 700), piece('piana', 90, 700)])).toEqual(['Panca piana']);
  });

  it('separa le righe per quota verticale, dall alto in basso', () => {
    const items = [piece('Lento avanti', 50, 680), piece('Panca piana', 50, 700)];
    expect(toLines(items)).toEqual(['Panca piana', 'Lento avanti']);
  });

  it('tollera lo scarto di un punto dentro la stessa riga', () => {
    expect(toLines([piece('4x8', 50, 700), piece('60kg', 90, 699.4)])).toEqual(['4x8 60kg']);
  });

  it('non incolla le colonne di una tabella', () => {
    const items = [piece('Panca piana', 50, 700), piece('4x8', 300, 700), piece('60', 400, 700)];
    expect(toLines(items)).toEqual(['Panca piana 4x8 60']);
  });

  it('non raddoppia gli spazi già presenti nel frammento', () => {
    expect(toLines([piece('Panca ', 50, 700), piece('piana', 90, 700)])).toEqual(['Panca piana']);
  });

  it('ordina i frammenti fuori sequenza e scarta le righe vuote', () => {
    const items = [piece('piana', 90, 700), piece('   ', 50, 690), piece('Panca', 50, 700)];
    expect(toLines(items)).toEqual(['Panca piana']);
  });

  it('ignora quello che non è testo', () => {
    expect(toLines([{ type: 'beginMarkedContent' }, piece('Squat', 50, 700)])).toEqual(['Squat']);
  });
});
