import { describe, it, expect } from 'vitest';
import { generate, canPour, pour, isSolved, solvable } from '../../src/games/ball-sort/logic';
import { mulberry32 } from '../../src/core/rand';

describe('ball-sort logic', () => {
  it('generated levels are solvable, unsolved, complete and have two spare tubes', () => {
    for (let s = 1; s <= 20; s++) {
      const t = generate(4, 4, mulberry32(s));
      expect(solvable(t)).toBe(true);
      expect(isSolved(t)).toBe(false);
      expect(t.flat().length).toBe(16);
      expect(t.length).toBe(6);
      for (let c = 0; c < 4; c++) expect(t.flat().filter((x) => x === c).length).toBe(4);
    }
  });

  it('bigger levels generate too', () => {
    const t = generate(7, 4, mulberry32(3));
    expect(t.length).toBe(9);
    expect(solvable(t)).toBe(true);
  });

  it('pour rules: matching top or empty target, not full, not empty source', () => {
    const t = [[0, 1], [1], [], [0, 0, 0, 1]];
    expect(canPour(t, 0, 1, 4)).toBe(true);
    expect(canPour(t, 0, 2, 4)).toBe(true);
    expect(canPour(t, 0, 3, 4)).toBe(false);
    expect(canPour(t, 2, 0, 4)).toBe(false);
    expect(canPour(t, 0, 0, 4)).toBe(false);
    expect(pour(t, 0, 1, 4)).toEqual([[0], [1, 1], [], [0, 0, 0, 1]]);
  });

  it('moves the whole top run if it fits, and only what fits', () => {
    expect(pour([[0, 1, 1], []], 0, 1, 4)).toEqual([[0], [1, 1]]);
    expect(pour([[0, 1, 1], [2, 2, 1]], 0, 1, 4)).toEqual([[0, 1], [2, 2, 1, 1]]);
  });

  it('pour does not mutate its input', () => {
    const t = [[0, 1], []];
    pour(t, 0, 1, 4);
    expect(t).toEqual([[0, 1], []]);
  });

  it('isSolved needs full single-color tubes', () => {
    expect(isSolved([[1, 1, 1, 1], [0, 0, 0, 0], []], 4)).toBe(true);
    expect(isSolved([[1, 1, 1], [0, 0, 0, 0], [1]], 4)).toBe(false);
  });

  it('solvable rejects a stuck position', () => {
    expect(solvable([[0, 1, 0, 1], [1, 0, 1, 0]], 4)).toBe(false);
  });
});
