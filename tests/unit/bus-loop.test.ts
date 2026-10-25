import { describe, it, expect } from 'vitest';
import { blocker, board, canExit, cells, generate, occupancy, park, solvable, start, stuck, won, type GenOpts, type Level } from '../../src/games/bus-loop/logic';
import { mulberry32 } from '../../src/core/rand';

const OPTS: GenOpts = { gw: 6, gh: 7, colors: 5, seats: 3, active: 2, window: 16, slots: 5 };

const lvl = (buses: Level['buses'], queue: number[], slots = 2, window = 8): Level => ({ gw: 3, gh: 3, buses, queue, window, slots });

describe('bus-loop logic', () => {
  it('every generated level is solvable, at every size and color count', () => {
    for (let s = 1; s <= 120; s++) {
      const gw = 5 + (s % 3);
      const lv = generate({ ...OPTS, gw, gh: gw + 1, colors: 3 + (s % 4), window: 10 + (s % 10) }, mulberry32(s));
      expect(solvable(lv)).toBe(true);
    }
  });

  it('passengers match the seats exactly, color by color', () => {
    const lv = generate(OPTS, mulberry32(3));
    for (let c = 0; c < OPTS.colors; c++) {
      const seats = lv.buses.filter((b) => b.color === c).reduce((n, b) => n + b.cap, 0);
      expect(seats).toBeGreaterThan(0);
      expect(lv.queue.filter((q) => q === c).length).toBe(seats);
    }
  });

  it('buses fit the lot without overlapping and leave in their listed order', () => {
    for (let s = 1; s <= 30; s++) {
      const lv = generate(OPTS, mulberry32(s));
      const all = lv.buses.flatMap((b) => cells(b, lv.gw));
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((c) => c >= 0 && c < lv.gw * lv.gh)).toBe(true);
      const lot = lv.buses.map(() => true);
      lv.buses.forEach((_, i) => {
        expect(canExit(lv, lot, i)).toBe(true);
        lot[i] = false;
      });
    }
  });

  it('a bus is blocked by anything on its path to the edge', () => {
    const lv = lvl([{ x: 0, y: 1, dir: 0, len: 2, color: 0, cap: 2 }, { x: 0, y: 0, dir: 1, len: 1, color: 1, cap: 1 }], [0, 0, 1]);
    const st = start(lv);
    expect(occupancy(lv, st.lot)[3]).toBe(0);
    expect(park(lv, st, 0)).toBe(-1);
    expect(park(lv, st, 1)).toBe(0);
    expect(park(lv, st, 0)).toBe(1);
  });

  it('riders board the earliest parked bus of their color and full buses leave', () => {
    const lv = lvl([{ x: 0, y: 0, dir: 0, len: 1, color: 0, cap: 1 }, { x: 1, y: 0, dir: 0, len: 1, color: 0, cap: 1 }], [1, 0, 0], 2, 3);
    const st = start(lv);
    park(lv, st, 1);
    park(lv, st, 0);
    expect(board(lv, st)).toEqual({ person: 1, slot: 0, color: 0, full: true });
    expect(st.slots[0]).toBeNull();
    expect(st.queue).toEqual([1, 0]);
  });

  it('only riders on the loop can board', () => {
    const lv = lvl([{ x: 0, y: 0, dir: 0, len: 1, color: 0, cap: 1 }], [1, 1, 0], 1, 2);
    const st = start(lv);
    park(lv, st, 0);
    expect(board(lv, st)).toBeNull();
    expect(stuck(lv, st)).toBe(true);
  });

  it('won once every rider has boarded', () => {
    const lv = lvl([{ x: 0, y: 0, dir: 0, len: 1, color: 0, cap: 2 }], [0, 0]);
    const st = start(lv);
    park(lv, st, 0);
    board(lv, st);
    expect(won(st)).toBe(false);
    board(lv, st);
    expect(won(st)).toBe(true);
  });

  it('the one-rider fallback replays the build order and always clears', () => {
    for (let s = 1; s <= 40; s++) {
      const lv = generate({ ...OPTS, colors: 6, window: 1 }, mulberry32(s));
      expect(lv.window).toBe(1);
      expect(solvable(lv)).toBe(true);
    }
  });

  it('blocker names the first bus on the way out and the free cells before it', () => {
    const lv = lvl(
      [
        { x: 0, y: 2, dir: 0, len: 1, color: 0, cap: 3 },
        { x: 0, y: 0, dir: 1, len: 1, color: 1, cap: 3 },
        { x: 2, y: 2, dir: 3, len: 1, color: 1, cap: 3 },
      ],
      [],
    );
    const lot = [true, true, true];
    expect(blocker(lv, lot, 0)).toEqual({ bus: 1, gap: 1 });
    expect(blocker(lv, lot, 2)).toEqual({ bus: 0, gap: 1 });
    expect(blocker(lv, lot, 1)).toBeNull();
    lot[1] = false;
    expect(blocker(lv, lot, 0)).toBeNull();
  });
});
