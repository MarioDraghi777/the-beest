import { describe, expect, it } from 'vitest';
import { detectDelimiter, looksLikeHeader, mapColumns, parseCsv, toCsv } from './csv';

describe('lettura CSV', () => {
  it('riconosce il punto e virgola, che è quello che usa Excel in Italia', () => {
    expect(detectDelimiter('esercizio;serie;carico\nPanca;4;60')).toBe(';');
  });

  it('riconosce la virgola', () => {
    expect(detectDelimiter('exercise,sets,load')).toBe(',');
  });

  it('legge righe e colonne', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('tiene insieme i campi fra virgolette', () => {
    expect(parseCsv('nome;note\n"Panca; piana";"presa larga"')).toEqual([
      ['nome', 'note'],
      ['Panca; piana', 'presa larga'],
    ]);
  });

  it('capisce le virgolette raddoppiate', () => {
    expect(parseCsv('nota\n"presa ""larga"""')[1][0]).toBe('presa "larga"');
  });

  it('regge i ritorni a capo di Windows', () => {
    expect(parseCsv('a;b\r\n1;2\r\n')).toHaveLength(2);
  });

  it('toglie il BOM che Excel mette in testa', () => {
    expect(parseCsv('﻿esercizio;serie')[0][0]).toBe('esercizio');
  });

  it('salta le righe vuote', () => {
    expect(parseCsv('a;b\n\n1;2\n\n')).toHaveLength(2);
  });
});

describe('scrittura CSV', () => {
  it('protegge i campi che contengono il separatore', () => {
    expect(toCsv(['a'], [['x;y']])).toBe('a\r\n"x;y"');
  });

  it('raddoppia le virgolette', () => {
    expect(toCsv(['a'], [['dice "ciao"']])).toBe('a\r\n"dice ""ciao"""');
  });

  it('scrive vuoto al posto dei valori mancanti', () => {
    expect(toCsv(['a', 'b'], [[1, undefined]])).toBe('a;b\r\n1;');
  });
});

describe('riconoscimento colonne', () => {
  it('trova le colonne italiane in qualunque ordine', () => {
    const map = mapColumns(['Note', 'Esercizio', 'Serie', 'Ripetizioni', 'Carico', 'Recupero']);
    expect(map).toEqual({ notes: 0, name: 1, sets: 2, reps: 3, load: 4, rest: 5 });
  });

  it('trova anche le colonne inglesi', () => {
    const map = mapColumns(['Exercise', 'Sets', 'Reps', 'Weight']);
    expect(map).toMatchObject({ name: 0, sets: 1, reps: 2, load: 3 });
  });

  it('capisce quando la prima riga è un\'intestazione', () => {
    expect(looksLikeHeader(['Esercizio', 'Serie', 'Carico'])).toBe(true);
  });

  it('capisce quando la prima riga è già un esercizio', () => {
    expect(looksLikeHeader(['Panca piana', '4', '60'])).toBe(false);
  });
});
