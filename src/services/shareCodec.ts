import type { CustomExercise, LoadUnit, Plan, Workout, WorkoutItem } from '../types';

/**
 * Serializzazione delle schede e dei piani dentro un link.
 *
 * Non c'è nessun server, quindi il contenuto viaggia nell'URL: compattato con
 * chiavi di una lettera, compresso con gzip (CompressionStream, nativo) e
 * codificato in base64url. Misurato sul formato vero: una scheda da 8
 * esercizi sta in ~220 caratteri, un piano annuale con 6 schede in ~400.
 *
 * Il payload sta dopo il "#", quindi non arriva nemmeno al server che ospita
 * l'app: chi riceve il link è l'unico a vederne il contenuto.
 */

export const SHARE_VERSION = 1;

/** Riga di scheda in formato compatto. */
interface WireItem {
  /** Id del catalogo, se l'esercizio è del dataset. */
  e?: string;
  /** Nome, se è un esercizio custom: viaggia il nome, non un id che non esiste altrove. */
  x?: string;
  s: number;
  r: string;
  w?: number;
  u?: LoadUnit;
  p?: number;
  t?: string;
  n?: string;
  g?: string;
}

interface WireWorkout {
  n: string;
  d?: string;
  i: WireItem[];
}

export interface WireSharedWorkout extends WireWorkout {
  v: number;
  t: 'w';
}

export interface WireSharedPlan {
  v: number;
  t: 'p';
  n: string;
  st: string;
  /** Blocchi: nome, settimane, schema settimanale con indici dentro `ws`. */
  b: { n: string; w: number; p: (number | null)[] }[];
  ws: WireWorkout[];
}

export type WirePayload = WireSharedWorkout | WireSharedPlan;

/* ---------------------------------------------------------------- encoding */

function itemToWire(item: WorkoutItem, nameOf: (id: string) => string): WireItem {
  const wire: WireItem = { s: item.sets, r: item.reps };
  if (item.ref.type === 'catalog') wire.e = item.ref.id;
  else wire.x = nameOf(item.ref.id);
  if (item.load != null) wire.w = item.load;
  if (item.loadUnit && item.loadUnit !== 'kg') wire.u = item.loadUnit;
  if (item.restSec != null && item.restSec !== 90) wire.p = item.restSec;
  if (item.tempo) wire.t = item.tempo;
  if (item.notes) wire.n = item.notes;
  if (item.supersetGroup) wire.g = item.supersetGroup;
  return wire;
}

function workoutToWire(workout: Workout, nameOf: (id: string) => string): WireWorkout {
  const wire: WireWorkout = { n: workout.name, i: workout.items.map((i) => itemToWire(i, nameOf)) };
  if (workout.notes) wire.d = workout.notes;
  return wire;
}

export function workoutPayload(workout: Workout, customs: CustomExercise[]): WireSharedWorkout {
  const nameOf = (id: string) => customs.find((c) => c.id === id)?.name ?? 'esercizio';
  return { v: SHARE_VERSION, t: 'w', ...workoutToWire(workout, nameOf) };
}

export function planPayload(plan: Plan, workouts: Workout[], customs: CustomExercise[]): WireSharedPlan {
  const nameOf = (id: string) => customs.find((c) => c.id === id)?.name ?? 'esercizio';

  // Solo le schede davvero usate dal piano, ciascuna una volta sola.
  const used: string[] = [];
  for (const block of plan.blocks) {
    for (const id of block.weekPattern) if (id && !used.includes(id)) used.push(id);
  }
  const ws = used
    .map((id) => workouts.find((w) => w.id === id))
    .filter((w): w is Workout => Boolean(w))
    .map((w) => workoutToWire(w, nameOf));

  return {
    v: SHARE_VERSION,
    t: 'p',
    n: plan.name,
    st: plan.startDate,
    b: plan.blocks.map((block) => ({
      n: block.name,
      w: block.weeks,
      p: block.weekPattern.map((id) => {
        const index = id ? used.indexOf(id) : -1;
        return index >= 0 ? index : null;
      }),
    })),
    ws,
  };
}

/* -------------------------------------------------------- gzip + base64url */

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  // Il buffer va passato esplicitamente: Uint8Array non è un BlobPart valido
  // per TypeScript quando è tipizzato su ArrayBufferLike.
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Il payload compresso, pronto da mettere dopo il "#". */
export async function encodePayload(payload: WirePayload): Promise<string> {
  const json = JSON.stringify(payload);
  if (typeof CompressionStream === 'undefined') return `u${toBase64Url(new TextEncoder().encode(json))}`;
  return `z${toBase64Url(await gzip(json))}`;
}

export async function decodePayload(code: string): Promise<WirePayload | null> {
  try {
    const kind = code[0];
    const bytes = fromBase64Url(code.slice(1));
    const json = kind === 'z' ? await gunzip(bytes) : new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as WirePayload;
    if (parsed.v !== SHARE_VERSION || (parsed.t !== 'w' && parsed.t !== 'p')) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- decoding */

export interface DecodedItem extends WireItem {
  /** Nome risolto per la visualizzazione. */
  display: string;
}

/** Rimette una riga di scheda in forma leggibile, risolvendo i nomi del catalogo. */
export function readItem(wire: WireItem, catalogName: (id: string) => string | undefined): DecodedItem {
  return { ...wire, display: wire.e ? (catalogName(wire.e) ?? `esercizio ${wire.e}`) : (wire.x ?? 'esercizio') };
}

export function describeItem(wire: WireItem): string {
  const parts = [`${wire.s}×${wire.r}`];
  if (wire.u === 'corpo') parts.push('corpo libero');
  else if (wire.w != null) parts.push(`${wire.w} ${wire.u ?? 'kg'}`);
  const rest = wire.p ?? 90;
  if (rest) parts.push(`rec ${rest}″`);
  return parts.join(' · ');
}

export function countWireSets(items: WireItem[]): number {
  return items.reduce((sum, i) => sum + i.s, 0);
}
