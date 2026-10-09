import { shuffle } from '../../core/rand';

/** Each tube lists its balls bottom to top; the last element is the top ball. */
export type Tubes = number[][];

const top = (t: number[]) => t[t.length - 1];

export function canPour(t: Tubes, from: number, to: number, cap = 4): boolean {
  if (from === to) return false;
  const a = t[from];
  const b = t[to];
  if (!a?.length || !b || b.length >= cap) return false;
  return !b.length || top(b) === top(a);
}

/** Moves as much of the source's top run of one color as fits. Returns new tubes. */
export function pour(t: Tubes, from: number, to: number, cap = 4): Tubes {
  const out = t.map((x) => x.slice());
  if (!canPour(t, from, to, cap)) return out;
  const a = out[from];
  const b = out[to];
  const color = top(a);
  while (a.length && top(a) === color && b.length < cap) b.push(a.pop()!);
  return out;
}

export function isSolved(t: Tubes, cap = 4): boolean {
  return t.every((x) => x.length === 0 || (x.length === cap && x.every((v) => v === x[0])));
}

const key = (t: Tubes) => t.map((x) => x.join(',')).sort().join('|');

/** Depth-first search for any solution, giving up (false) after maxNodes states. */
export function solvable(t: Tubes, cap = 4, maxNodes = 20000): boolean {
  const seen = new Set<string>();
  const stack: Tubes[] = [t];
  while (stack.length) {
    const cur = stack.pop()!;
    if (isSolved(cur, cap)) return true;
    const k = key(cur);
    if (seen.has(k)) continue;
    seen.add(k);
    if (seen.size > maxNodes) return false;
    const moves: Tubes[] = [];
    for (let f = 0; f < cur.length; f++) {
      const a = cur[f];
      if (!a.length) continue;
      const uniform = a.every((v) => v === a[0]);
      if (uniform && a.length === cap) continue;
      for (let to = 0; to < cur.length; to++) {
        if (!canPour(cur, f, to, cap)) continue;
        if (uniform && !cur[to].length) continue;
        // pushed last = explored first: prefer stacking onto matching colors over using empty tubes
        if (cur[to].length) moves.push(pour(cur, f, to, cap));
        else moves.unshift(pour(cur, f, to, cap));
      }
    }
    stack.push(...moves);
  }
  return false;
}

/** A shuffled, solvable, not-yet-solved level with two empty tubes. */
export function generate(colors: number, cap: number, r: () => number): Tubes {
  let last: Tubes = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    const balls = shuffle(Array.from({ length: colors * cap }, (_, i) => i % colors), r);
    const tubes: Tubes = Array.from({ length: colors }, (_, i) => balls.slice(i * cap, (i + 1) * cap));
    tubes.push([], []);
    last = tubes;
    if (!isSolved(tubes, cap) && solvable(tubes, cap)) return tubes;
  }
  return last;
}
