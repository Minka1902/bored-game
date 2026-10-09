import { describe, it, expect } from 'vitest';
import { emptyGrid, canPlace, place, anyFits, PIECES, N } from '../../src/games/block-fit/logic';

const I4 = [[1, 1, 1, 1]];

describe('block-fit logic', () => {
  it('has an 8×8 board and 19 piece shapes', () => {
    expect(N).toBe(8);
    expect(PIECES.length).toBe(19);
  });

  it('rejects out of bounds and overlap', () => {
    const g = emptyGrid();
    expect(canPlace(g, I4, 0, 5)).toBe(false);
    expect(canPlace(g, I4, -1, 0)).toBe(false);
    const g2 = place(g, I4, 0, 0).grid;
    expect(canPlace(g2, [[1]], 0, 2)).toBe(false);
    expect(canPlace(g2, [[1]], 1, 2)).toBe(true);
  });

  it('ignores empty cells of a shape when checking overlap', () => {
    const L = [[1, 0], [1, 1]];
    const g = place(emptyGrid(), [[1]], 0, 1).grid;
    expect(canPlace(g, L, 0, 0)).toBe(true);
  });

  it('does not mutate the grid it was given', () => {
    const g = emptyGrid();
    place(g, I4, 0, 0);
    expect(g.flat().every((v) => v === 0)).toBe(true);
  });

  it('clears a full row and column together', () => {
    const g = emptyGrid();
    for (let c = 0; c < 8; c++) if (c !== 3) g[0][c] = 1;
    for (let r = 1; r < 8; r++) g[r][3] = 1;
    const res = place(g, [[1]], 0, 3);
    expect(res.cleared).toEqual({ rows: [0], cols: [3] });
    expect(res.grid.flat().every((v) => v === 0)).toBe(true);
    expect(res.points).toBeGreaterThan(15);
  });

  it('scores placed cells when nothing clears', () => {
    expect(place(emptyGrid(), I4, 0, 0).points).toBe(4);
  });

  it('anyFits is false on a full board and true on an empty one', () => {
    const full = emptyGrid().map((r) => r.map(() => 1));
    expect(anyFits(full, [PIECES[0]])).toBe(false);
    expect(anyFits(emptyGrid(), [PIECES[0]])).toBe(true);
  });
});
