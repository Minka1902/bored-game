import { shuffle } from '../../core/rand';

export interface Bus {
  /** head cell; the body trails behind it, against dir */
  x: number;
  y: number;
  dir: number;
  len: number;
  color: number;
  cap: number;
}

export interface Level {
  gw: number;
  gh: number;
  /** listed in a removal order that always has a clear exit */
  buses: Bus[];
  /** passenger colors, front first */
  queue: number[];
  /** how many passengers from the front ride the loop and can board */
  window: number;
  slots: number;
}

export interface Parked {
  bus: number;
  seats: number;
  /** arrival order: passengers fill the earliest parked bus of their color first */
  at: number;
}

export interface State {
  lot: boolean[];
  slots: (Parked | null)[];
  queue: number[];
  seq: number;
}

export interface Boarding {
  person: number;
  slot: number;
  color: number;
  full: boolean;
}

export interface GenOpts {
  gw: number;
  gh: number;
  colors: number;
  /** seats per bus cell */
  seats: number;
  /** how many buses' passengers are mixed together in the queue */
  active: number;
  window: number;
  slots: number;
}

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

const TRIES = 60;

export const cells = (b: Bus, gw: number): number[] =>
  Array.from({ length: b.len }, (_, k) => (b.y - DIRS[b.dir][1] * k) * gw + b.x - DIRS[b.dir][0] * k);

export function occupancy(lv: Pick<Level, 'gw' | 'gh' | 'buses'>, lot: boolean[]): Int16Array {
  const occ = new Int16Array(lv.gw * lv.gh).fill(-1);
  lv.buses.forEach((b, i) => {
    if (lot[i]) for (const c of cells(b, lv.gw)) occ[c] = i;
  });
  return occ;
}

const pathClear = (occ: ArrayLike<number>, gw: number, gh: number, b: Bus): boolean => {
  const [dx, dy] = DIRS[b.dir];
  for (let x = b.x + dx, y = b.y + dy; x >= 0 && y >= 0 && x < gw && y < gh; x += dx, y += dy) if (occ[y * gw + x] >= 0) return false;
  return true;
};

export const canExit = (lv: Level, lot: boolean[], i: number): boolean => pathClear(occupancy(lv, lot), lv.gw, lv.gh, lv.buses[i]);

/**
 * Packs the lot in reverse: every new bus needs a clear exit past the buses already placed,
 * so removing them newest first always works.
 */
function packLot(o: GenOpts, r: () => number): Bus[] {
  const { gw, gh } = o;
  const occ = new Int16Array(gw * gh).fill(-1);
  const placed: Bus[] = [];
  for (let a = 0; a < gw * gh * 30; a++) {
    const len = r() < 0.65 ? 2 : 3;
    const b: Bus = { x: Math.floor(r() * gw), y: Math.floor(r() * gh), dir: Math.floor(r() * 4), len, color: 0, cap: len * o.seats };
    const [dx, dy] = DIRS[b.dir];
    const tx = b.x - dx * (len - 1);
    const ty = b.y - dy * (len - 1);
    if (tx < 0 || ty < 0 || tx >= gw || ty >= gh) continue;
    const body = cells(b, gw);
    if (body.some((c) => occ[c] >= 0) || !pathClear(occ, gw, gh, b)) continue;
    for (const c of body) occ[c] = placed.length;
    placed.push(b);
  }
  placed.reverse();
  shuffle(placed.map((_, i) => i), r).forEach((i, k) => (placed[i].color = k < o.colors ? k : Math.floor(r() * o.colors)));
  return placed;
}

/** Mixes the passengers of the next `active` unfilled buses, filling them in removal order. */
function fillQueue(buses: Bus[], active: number, r: () => number): number[] {
  const seats = buses.map((b) => b.cap);
  const live: number[] = [];
  const queue: number[] = [];
  let next = 0;
  while (live.length < active && next < buses.length) live.push(next++);
  while (live.length) {
    let roll = r() * live.reduce((n, i) => n + seats[i], 0);
    let pick = live[0];
    for (const i of live) {
      roll -= seats[i];
      if (roll < 0) {
        pick = i;
        break;
      }
    }
    const color = buses[pick].color;
    const k = live.findIndex((i) => buses[i].color === color);
    const bus = live[k];
    queue.push(color);
    if (--seats[bus]) continue;
    live.splice(k, 1);
    while (live.length < active && next < buses.length) live.push(next++);
  }
  return queue;
}

export const start = (lv: Level): State => ({
  lot: lv.buses.map(() => true),
  slots: Array.from({ length: lv.slots }, () => null),
  queue: lv.queue.slice(),
  seq: 0,
});

/** Drives a bus out to the first free slot. Returns the slot, or -1 when it is blocked, gone or the slots are full. */
export function park(lv: Level, st: State, i: number): number {
  const s = st.slots.indexOf(null);
  if (s < 0 || !st.lot[i] || !canExit(lv, st.lot, i)) return -1;
  st.lot[i] = false;
  st.slots[s] = { bus: i, seats: lv.buses[i].cap, at: st.seq++ };
  return s;
}

/** The first rider on the loop with a parked bus of their color, and that bus's slot. */
export function nextBoarding(lv: Level, st: State): [number, number] | null {
  const byColor = new Map<number, number>();
  st.slots.forEach((p, j) => {
    if (!p) return;
    const c = lv.buses[p.bus].color;
    const cur = byColor.get(c);
    if (cur === undefined || p.at < st.slots[cur]!.at) byColor.set(c, j);
  });
  if (!byColor.size) return null;
  const n = Math.min(lv.window, st.queue.length);
  for (let p = 0; p < n; p++) {
    const j = byColor.get(st.queue[p]);
    if (j !== undefined) return [p, j];
  }
  return null;
}

export function board(lv: Level, st: State): Boarding | null {
  const nb = nextBoarding(lv, st);
  if (!nb) return null;
  const [person, slot] = nb;
  const p = st.slots[slot]!;
  const color = st.queue.splice(person, 1)[0];
  const full = !--p.seats;
  if (full) st.slots[slot] = null;
  return { person, slot, color, full };
}

export const stuck = (lv: Level, st: State): boolean => st.slots.every(Boolean) && !nextBoarding(lv, st);

export const won = (st: State): boolean => !st.queue.length;

/** Boards whenever possible and otherwise parks the next bus in removal order; true when that clears the queue. */
export function solvable(lv: Level): boolean {
  const st = start(lv);
  let next = 0;
  while (st.queue.length) {
    if (board(lv, st)) continue;
    if (next >= lv.buses.length || park(lv, st, next++) < 0) return false;
  }
  return true;
}

/**
 * A level whose queue is proven clearable by `solvable`. If no mix passes, the loop narrows
 * to one rider, which replays the queue exactly as it was built and so always clears.
 */
export function generate(o: GenOpts, r: () => number): Level {
  let lv: Level = { gw: o.gw, gh: o.gh, buses: [], queue: [], window: 1, slots: o.slots };
  for (let t = 0; t < TRIES; t++) {
    const buses = packLot(o, r);
    lv = { gw: o.gw, gh: o.gh, buses, queue: fillQueue(buses, Math.min(o.active, o.slots), r), window: o.window, slots: o.slots };
    if (solvable(lv)) return lv;
  }
  return { ...lv, window: 1 };
}
