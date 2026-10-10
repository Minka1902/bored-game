import { describe, it, expect } from 'vitest';
import { mulberry32, pick, shuffle, rint } from '../../src/core/rand';

describe('rand', () => {
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = [a(), a(), a()];
    expect(xs).toEqual([b(), b(), b()]);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('rint is inclusive on both ends', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rint(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick and shuffle use the given rng', () => {
    expect(pick(['a', 'b', 'c'], () => 0.99)).toBe('c');
    expect(shuffle([1, 2, 3, 4], mulberry32(1)).sort()).toEqual([1, 2, 3, 4]);
  });
});
