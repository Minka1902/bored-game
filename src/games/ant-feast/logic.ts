import type { Art } from './art';

export interface Tile {
  color: number;
  n: number;
}

export interface Level {
  w: number;
  h: number;
  /** color index per pixel, row by row */
  px: Int8Array;
  /** cols[c][0] is the tappable top tile */
  cols: Tile[][];
  /** column tapped at each step of the guaranteed serial solution */
  plan: number[];
}

export interface State {
  w: number;
  h: number;
  /** color index per pixel, EMPTY once eaten */
  px: Int8Array;
  cols: Tile[][];
  slots: (Tile | null)[];
}

export interface Bite {
  slot: number;
  pixel: number;
  color: number;
  done: boolean;
}

export interface Picture {
  w: number;
  h: number;
  /** color index per pixel, row by row; EMPTY where the picture is see-through */
  px: Int8Array;
}

export interface GenOpts {
  cols: number;
  /** tile size range; a tile only takes less when its color has no more reachable pixels */
  chunk: [number, number];
  /** longest run of consecutive plan tiles dealt into one column; longer runs bury the next useful tile */
  run: number;
}

export const EMPTY = -1;

const open = (px: Int8Array, w: number, h: number, i: number): boolean => {
  const x = i % w;
  const y = (i - x) / w;
  return x === 0 || y === 0 || x === w - 1 || y === h - 1 || px[i - 1] < 0 || px[i + 1] < 0 || px[i - w] < 0 || px[i + w] < 0;
};

/** Pixel art to a picture whose colors index the art's palette in key order. */
export function fromArt(art: Art): Picture {
  const keys = Object.keys(art.palette);
  const w = art.rows[0].length;
  const px = Int8Array.from(art.rows.join(''), (ch) => keys.indexOf(ch));
  return { w, h: art.rows.length, px };
}

/** The exposed pixel of a color the ants take next: nearest to the nest under the picture. -1 when none is exposed. */
export function target(st: Pick<State, 'w' | 'h' | 'px'>, color: number): number {
  const { w, h, px } = st;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < px.length; i++) {
    if (px[i] !== color || !open(px, w, h, i)) continue;
    const x = i % w;
    const dx = 2 * x + 1 - w;
    const dy = 2 * (h - (i - x) / w) - 1;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** How many pixels of a color its ants could eat in a row, with nothing else eaten meanwhile. */
export function reach(st: Pick<State, 'w' | 'h' | 'px'>, color: number): number {
  const { w, h, px } = st;
  const seen = new Uint8Array(px.length);
  const stack: number[] = [];
  for (let i = 0; i < px.length; i++) {
    if (px[i] === color && open(px, w, h, i)) {
      seen[i] = 1;
      stack.push(i);
    }
  }
  let n = 0;
  while (stack.length) {
    const i = stack.pop()!;
    n++;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= px.length || seen[j] || px[j] !== color) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return n;
}

/**
 * Builds the tiles by eating the picture serially, so tapping the columns in `plan` order and
 * letting each tile finish before the next always wins.
 */
export function generate(pic: Picture, o: GenOpts, r: () => number): Level {
  const { w, h, px } = pic;
  const [lo, hi] = o.chunk;
  const cols = o.cols;
  const sim = { w, h, px: px.slice() };
  const tiles: Tile[] = [];
  let left = px.reduce((n, v) => (v >= 0 ? n + 1 : n), 0);
  while (left) {
    const exposed = new Set<number>();
    for (let i = 0; i < px.length; i++) if (sim.px[i] >= 0 && open(sim.px, w, h, i)) exposed.add(sim.px[i]);
    const list = [...exposed];
    const color = list[Math.floor(r() * list.length)];
    const max = reach(sim, color);
    let n = Math.min(max, lo + Math.floor(r() * (hi - lo + 1)));
    if (max - n < lo) n = max;
    for (let k = 0; k < n; k++) sim.px[target(sim, color)] = EMPTY;
    left -= n;
    tiles.push({ color, n });
  }
  const columns: Tile[][] = Array.from({ length: cols }, () => []);
  const plan: number[] = [];
  let col = 0;
  let run = 0;
  tiles.forEach((t) => {
    if (!run) {
      const min = Math.min(...columns.map((c) => c.length));
      const short = columns.flatMap((c, i) => (c.length <= min + 1 && i !== col ? [i] : []));
      col = short.length ? short[Math.floor(r() * short.length)] : col;
      run = 1 + Math.floor(r() * o.run);
    }
    run--;
    columns[col].push(t);
    plan.push(col);
  });
  return { w, h, px, cols: columns, plan };
}

export const start = (lv: Level, slots: number): State => ({
  w: lv.w,
  h: lv.h,
  px: lv.px.slice(),
  cols: lv.cols.map((c) => c.map((t) => ({ ...t }))),
  slots: Array.from({ length: slots }, () => null),
});

/** Sends a column's top tile to the first free slot. Returns the slot, or -1 when the column is empty or no slot is free. */
export function take(st: State, col: number): number {
  const s = st.slots.indexOf(null);
  if (s < 0 || !st.cols[col]?.length) return -1;
  st.slots[s] = st.cols[col].shift()!;
  return s;
}

/** Every active slot eats one pixel of its color, if it can reach one. */
export function bite(st: State): Bite[] {
  const out: Bite[] = [];
  st.slots.forEach((t, slot) => {
    if (!t) return;
    const pixel = target(st, t.color);
    if (pixel < 0) return;
    st.px[pixel] = EMPTY;
    t.n--;
    if (!t.n) st.slots[slot] = null;
    out.push({ slot, pixel, color: t.color, done: !t.n });
  });
  return out;
}

export const stuck = (st: State): boolean => st.slots.every((t) => t && target(st, t.color) < 0);

export const won = (st: State): boolean => st.px.every((v) => v < 0);

/** Replays the generator's plan one tile at a time; true when it clears the picture. */
export function playPlan(lv: Level, slots: number): boolean {
  const st = start(lv, slots);
  for (const col of lv.plan) {
    const s = take(st, col);
    if (s < 0) return false;
    while (st.slots[s]) if (!bite(st).length) return false;
  }
  return won(st);
}
