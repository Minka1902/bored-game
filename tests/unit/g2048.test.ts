import { describe, it, expect } from 'vitest';
import { slide, canMove, spawn, emptyBoard } from '../../src/games/g2048/logic';

const Z = [0, 0, 0, 0];

describe('2048 logic', () => {
  it('merges once per move and reports gained score', () => {
    const r = slide([[2, 2, 2, 2], Z, Z, Z], 'left');
    expect(r.board[0]).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(8);
    expect(r.moved).toBe(true);
  });

  it('does not double-merge', () => {
    expect(slide([[4, 4, 8, 0], Z, Z, Z], 'left').board[0]).toEqual([8, 8, 0, 0]);
  });

  it('reports no move when nothing can slide', () => {
    expect(slide([[2, 4, 8, 16], Z, Z, Z], 'left').moved).toBe(false);
  });

  it('slides right, up and down symmetrically', () => {
    expect(slide([[2, 0, 2, 0], Z, Z, Z], 'right').board[0]).toEqual([0, 0, 0, 4]);
    expect(slide([[2, 0, 0, 0], [2, 0, 0, 0], Z, Z], 'down').board.map((r) => r[0])).toEqual([0, 0, 0, 4]);
    expect(slide([Z, Z, [0, 2, 0, 0], [0, 2, 0, 0]], 'up').board.map((r) => r[1])).toEqual([4, 0, 0, 0]);
  });

  it('does not mutate its input', () => {
    const b = [[2, 2, 0, 0], Z.slice(), Z.slice(), Z.slice()];
    slide(b, 'left');
    expect(b[0]).toEqual([2, 2, 0, 0]);
  });

  it('records where merges happened', () => {
    expect(slide([[2, 2, 0, 0], Z, Z, Z], 'right').merges).toEqual([[0, 3]]);
  });

  it('canMove detects a stuck board', () => {
    expect(canMove([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])).toBe(false);
    expect(canMove([[2, 2, 4, 8], [4, 8, 16, 32], [2, 4, 8, 16], [4, 8, 16, 32]])).toBe(true);
    expect(canMove(emptyBoard())).toBe(true);
  });

  it('spawn fills exactly one empty cell with 2 or 4', () => {
    const b = spawn([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]], () => 0.5);
    expect([2, 4]).toContain(b[3][3]);
    const e = spawn(emptyBoard(), Math.random);
    expect(e.flat().filter((v) => v > 0).length).toBe(1);
  });
});
