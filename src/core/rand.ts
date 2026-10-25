import type { ScopedStore } from './storage';

/** Small seedable PRNG returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** rnd() → [0,1), rnd(a) → [0,a), rnd(a,b) → [a,b) */
export const rnd = (a?: number, b?: number): number =>
  a === undefined ? Math.random() : b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/** Integer in [a, b], inclusive. */
export const rint = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

export function pick<T>(a: readonly T[], r: () => number = Math.random): T {
  return a[Math.floor(r() * a.length)];
}

/** In-place Fisher–Yates shuffle; returns the same array. */
export function shuffle<T>(a: T[], r: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generator for the level in progress; its seed is stored so leaving and coming back replays the same level. Set 'seed' to 0 to roll a new one. */
export function levelRng(store: ScopedStore): () => number {
  let seed = store.get('seed', 0);
  if (!seed) {
    seed = 1 + Math.floor(Math.random() * 0x7fffffff);
    store.set('seed', seed);
  }
  return mulberry32(seed);
}
