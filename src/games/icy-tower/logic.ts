/** World units: the tower is W wide, floors are GAP apart, y grows upward and floor n's top sits at n * GAP. */
export const W = 320;
export const GAP = 70;
/** half the player's width; a landing counts while any of it is over the floor */
export const HALF = 11;
export const GRAVITY = 2300;
export const ACCEL = 1500;
export const MAX_VX = 540;
export const JUMP = 780;
export const SPEED_JUMP = 0.95;
export const COMBO_TIME = 3;
/** every MILESTONE-th floor spans the whole tower */
export const MILESTONE = 50;

export interface Floor {
  n: number;
  x: number;
  w: number;
}

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  grounded: boolean;
}

export interface Combo {
  floors: number;
  jumps: number;
  t: number;
}

export const floorWidth = (n: number): number => (n % MILESTONE === 0 ? W : W * Math.max(0.26, 0.6 - n * 0.0022));

export function makeFloor(n: number, r: () => number): Floor {
  const w = floorWidth(n);
  return { n, x: r() * (W - w), w };
}

/** Jumps launch higher the faster you run. */
export const jumpVelocity = (vx: number): number => JUMP + Math.abs(vx) * SPEED_JUMP;

const over = (b: Body, f: Floor): boolean => b.x + HALF > f.x && b.x - HALF < f.x + f.w;

/** Advances the body one step; returns the floor it landed on, or -1. */
export function step(b: Body, dir: number, jump: boolean, dt: number, floorAt: (n: number) => Floor): number {
  b.vx += dir * ACCEL * (b.grounded ? 1 : 0.7) * dt;
  if (!dir && b.grounded) b.vx *= Math.exp(-9 * dt);
  b.vx = Math.max(-MAX_VX, Math.min(MAX_VX, b.vx));
  b.x += b.vx * dt;
  if (b.x < HALF || b.x > W - HALF) {
    b.x = b.x < HALF ? HALF : W - HALF;
    b.vx = -b.vx;
  }
  if (b.grounded && !over(b, floorAt(b.floor))) b.grounded = false;
  if (b.grounded && jump) {
    b.grounded = false;
    b.vy = jumpVelocity(b.vx);
  }
  if (b.grounded) return -1;
  const y0 = b.y;
  b.vy -= GRAVITY * dt;
  b.y += b.vy * dt;
  if (b.vy > 0) return -1;
  for (let n = Math.floor(y0 / GAP); n >= 0 && n * GAP >= b.y; n--) {
    if (!over(b, floorAt(n))) continue;
    b.y = n * GAP;
    b.vy = 0;
    b.grounded = true;
    b.floor = n;
    return n;
  }
  return -1;
}

/** A landing from floor `from` to `to`: jumps of two or more floors build the combo, anything else ends it. */
export function land(c: Combo, from: number, to: number): { combo: Combo; bonus: number } {
  const climb = to - from;
  if (climb >= 2) return { combo: { floors: c.floors + climb, jumps: c.jumps + 1, t: COMBO_TIME }, bonus: 0 };
  if (climb === 0 && c.jumps) return { combo: c, bonus: 0 };
  return { combo: { floors: 0, jumps: 0, t: 0 }, bonus: payout(c) };
}

/** Runs the combo clock; a combo that times out pays out. */
export function tickCombo(c: Combo, dt: number): { combo: Combo; bonus: number } {
  if (!c.jumps) return { combo: c, bonus: 0 };
  const t = c.t - dt;
  if (t > 0) return { combo: { ...c, t }, bonus: 0 };
  return { combo: { floors: 0, jumps: 0, t: 0 }, bonus: payout(c) };
}

/** Only combos of two or more jumps pay, floors squared. */
export const payout = (c: Combo): number => (c.jumps >= 2 ? c.floors * c.floors : 0);

/** How fast the tower scrolls, in units per second, t seconds after it started. */
export const scrollSpeed = (t: number): number => 45 + Math.floor(t / 30) * 22;
