import { clamp, TAU } from '../../core/math';

export interface Spool {
  color: number;
  n: number;
}

export interface Level {
  w: number;
  h: number;
  /** color index per pixel, row by row from the top */
  px: Int8Array;
  gw: number;
  gh: number;
  /** spool per grid cell, row 0 on top; null cells start empty */
  grid: (Spool | null)[];
  /** grid cells in an order that is always pickable and, one spool at a time, unravels everything */
  plan: number[];
  slots: number;
}

export interface State {
  w: number;
  h: number;
  px: Int8Array;
  /** pixels pulled off the bottom of each picture column; the rest of the column drops down */
  cut: Int16Array;
  left: number;
  gw: number;
  grid: (Spool | null)[];
  /** packed left: a finished spool leaves and the ones after it slide over */
  tray: Spool[];
  slots: number;
}

export interface Pull {
  slot: number;
  x: number;
  /** row of the pulled pixel in the original picture */
  y: number;
  color: number;
  done: boolean;
}

export interface GenOpts {
  w: number;
  h: number;
  colors: number;
  gw: number;
  /** spool size range; a spool only holds less when its color has no more pullable pixels */
  chunk: [number, number];
  slots: number;
  /** chance the next plan spool is dug straight down instead of anywhere already reachable */
  dig: number;
}

export const EMPTY = -1;

const SPECKLE = 0.04;

const around = (i: number, gw: number, n: number): number[] =>
  [i % gw ? i - 1 : -1, (i + 1) % gw ? i + 1 : -1, i - gw, i + gw].filter((j) => j >= 0 && j < n);

/** Procedural knitted landscape: color 0 on top, wavy bands down to the last color, a sun and a few stray stitches. */
export function paint(w: number, h: number, colors: number, r: () => number): Int8Array {
  const px = new Int8Array(w * h);
  const weights = Array.from({ length: colors }, () => 0.6 + r());
  const total = weights.reduce((a, b) => a + b, 0);
  const edges: number[][] = [];
  let base = 0;
  for (let k = 0; k < colors - 1; k++) {
    base += (weights[k] / total) * h;
    const amp = (0.2 + r() * 0.6) * (h / colors);
    const f = 0.5 + r() * 2.5;
    const p = r() * TAU;
    edges.push(Array.from({ length: w }, (_, x) => base + amp * Math.sin((x / w) * f * TAU + p) + (r() - 0.5) * 1.6));
  }
  const sun = Math.floor(colors / 2);
  const sx = w * (0.2 + 0.6 * r());
  const sy = h * (0.12 + 0.2 * r());
  const sr = Math.min(w, h) * (0.08 + 0.08 * r());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (const e of edges) if (y + 0.5 > e[x]) c++;
      if (c < sun && Math.hypot(x + 0.5 - sx, y + 0.5 - sy) < sr) c = sun;
      else if (r() < SPECKLE) c = clamp(c + (r() < 0.5 ? -1 : 1), 0, colors - 1);
      px[y * w + x] = c;
    }
  }
  return px;
}

/** Color at the bottom of a picture column, EMPTY once it is fully unraveled. */
export const bottom = (st: Pick<State, 'w' | 'h' | 'px' | 'cut'>, x: number): number =>
  st.cut[x] < st.h ? st.px[(st.h - 1 - st.cut[x]) * st.w + x] : EMPTY;

/** Picture column under a tray slot, so spools pull the yarn nearest to them. */
export const aim = (w: number, slots: number, slot: number): number => ((slot + 0.5) / slots) * w - 0.5;

/** The column ending in a color closest to `from`, or -1 when no column ends in it. */
export function target(st: Pick<State, 'w' | 'h' | 'px' | 'cut'>, color: number, from: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let x = 0; x < st.w; x++) {
    if (bottom(st, x) !== color) continue;
    const d = Math.abs(x - from);
    if (d < bestD) {
      bestD = d;
      best = x;
    }
  }
  return best;
}

/** How many pixels of a color one spool could pull in a row, with nothing else pulled meanwhile. */
export function reach(st: Pick<State, 'w' | 'h' | 'px' | 'cut'>, color: number): number {
  let n = 0;
  for (let x = 0; x < st.w; x++) for (let y = st.h - 1 - st.cut[x]; y >= 0 && st.px[y * st.w + x] === color; y--) n++;
  return n;
}

/**
 * Sizes the spools by unraveling the picture serially from tray slot 0, then digs them into the grid
 * from the top in that order, so picking the `plan` cells one spool at a time always wins.
 */
export function generate(o: GenOpts, r: () => number): Level {
  const { w, h, gw, slots } = o;
  const [lo, hi] = o.chunk;
  const px = paint(w, h, o.colors, r);
  const sim = { w, h, px, cut: new Int16Array(w) };
  const from = aim(w, slots, 0);
  const spools: Spool[] = [];
  for (let left = w * h; left; ) {
    const exposed = [...new Set(Array.from({ length: w }, (_, x) => bottom(sim, x)).filter((c) => c >= 0))];
    const color = exposed[Math.floor(r() * exposed.length)];
    const max = reach(sim, color);
    let n = Math.min(max, lo + Math.floor(r() * (hi - lo + 1)));
    if (max - n < lo) n = max;
    for (let k = 0; k < n; k++) sim.cut[target(sim, color, from)]++;
    left -= n;
    spools.push({ color, n });
  }
  const gh = Math.ceil(spools.length / gw);
  const size = gw * gh;
  const grid: (Spool | null)[] = new Array(size).fill(null);
  const seen = new Uint8Array(size);
  const front = Array.from({ length: gw }, (_, x) => x);
  seen.fill(1, 0, gw);
  const plan = spools.map((sp) => {
    const i = front.splice(r() < o.dig ? front.length - 1 : Math.floor(r() * front.length), 1)[0];
    grid[i] = sp;
    for (const j of around(i, gw, size)) {
      if (seen[j]) continue;
      seen[j] = 1;
      front.push(j);
    }
    return i;
  });
  return { w, h, px, gw, gh, grid, plan, slots };
}

export const start = (lv: Level): State => ({
  w: lv.w,
  h: lv.h,
  px: lv.px,
  cut: new Int16Array(lv.w),
  left: lv.w * lv.h,
  gw: lv.gw,
  grid: lv.grid.map((sp) => sp && { ...sp }),
  tray: [],
  slots: lv.slots,
});

/** 1 for every spool on the top row or next to an empty cell that an empty path connects to the top. */
export function free(st: Pick<State, 'gw' | 'grid'>): Uint8Array {
  const { gw, grid } = st;
  const n = grid.length;
  const air = new Uint8Array(n);
  const stack: number[] = [];
  for (let x = 0; x < gw && x < n; x++) {
    if (grid[x]) continue;
    air[x] = 1;
    stack.push(x);
  }
  while (stack.length) {
    for (const j of around(stack.pop()!, gw, n)) {
      if (air[j] || grid[j]) continue;
      air[j] = 1;
      stack.push(j);
    }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (grid[i] && (i < gw || around(i, gw, n).some((j) => air[j]))) out[i] = 1;
  return out;
}

/** Moves a free spool onto the tray. Returns its slot, or -1 when the cell is empty, buried or the tray is full. */
export function take(st: State, i: number): number {
  const sp = st.grid[i];
  if (!sp || st.tray.length >= st.slots || !free(st)[i]) return -1;
  st.grid[i] = null;
  return st.tray.push(sp) - 1;
}

/** Every spool on the tray pulls one pixel of its color, if a column ends in it. */
export function pull(st: State): Pull[] {
  const out: Pull[] = [];
  st.tray.forEach((sp, slot) => {
    const x = target(st, sp.color, aim(st.w, st.slots, slot));
    if (x < 0) return;
    const y = st.h - 1 - st.cut[x]++;
    st.left--;
    out.push({ slot, x, y, color: sp.color, done: !--sp.n });
  });
  if (out.some((p) => p.done)) st.tray = st.tray.filter((sp) => sp.n);
  return out;
}

export const stuck = (st: State): boolean => st.tray.length >= st.slots && st.tray.every((sp) => target(st, sp.color, 0) < 0);

export const won = (st: State): boolean => !st.left;

/** Replays the generator's plan one spool at a time; true when it unravels the whole picture. */
export function playPlan(lv: Level): boolean {
  const st = start(lv);
  for (const i of lv.plan) {
    if (take(st, i) < 0) return false;
    while (st.tray.length) if (!pull(st).length) return false;
  }
  return won(st);
}
