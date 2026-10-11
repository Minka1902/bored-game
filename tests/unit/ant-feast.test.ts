import { describe, it, expect } from 'vitest';
import { bite, EMPTY, generate, playPlan, reach, start, stuck, take, target, won, type Level } from '../../src/games/ant-feast/logic';
import { mulberry32 } from '../../src/core/rand';

const SLOTS = 5;

const lvl = (rows: number[][], cols: Level['cols']): Level => ({
  w: rows[0].length,
  h: rows.length,
  px: Int8Array.from(rows.flat()),
  cols,
  plan: [],
});

describe('ant-feast logic', () => {
  it('every generated level is won by its plan with a single slot, at every size', () => {
    for (let s = 1; s <= 80; s++) {
      const size = 10 + (s % 11);
      const colors = 3 + (s % 5);
      const run = 1 + (s % 5);
      const lv = generate({ w: size, h: size, colors, cols: 4, chunk: [8, 30], frame: 1 + (s % 3), run }, mulberry32(s));
      expect(playPlan(lv, 1)).toBe(true);
      expect(playPlan(lv, SLOTS)).toBe(true);
      const lens = lv.cols.map((c) => c.length);
      expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(run + 1);
    }
  });

  it('the frame starts out as background only', () => {
    const lv = generate({ w: 16, h: 16, colors: 5, cols: 4, chunk: [8, 30], frame: 2, run: 3 }, mulberry32(4));
    for (let i = 0; i < lv.px.length; i++) {
      const x = i % 16;
      const y = Math.floor(i / 16);
      if (x < 2 || y < 2 || x > 13 || y > 13) expect(lv.px[i]).toBe(0);
    }
  });

  it('tile counts match the picture exactly, color by color', () => {
    const lv = generate({ w: 16, h: 16, colors: 6, cols: 4, chunk: [8, 30], frame: 1, run: 3 }, mulberry32(7));
    const tiles = lv.cols.flat();
    for (let c = 0; c < 6; c++) {
      const pixels = lv.px.filter((v) => v === c).length;
      expect(tiles.filter((t) => t.color === c).reduce((n, t) => n + t.n, 0)).toBe(pixels);
    }
    expect(tiles.every((t) => t.n > 0)).toBe(true);
  });

  it('only exposed pixels are targeted, nearest to the nest first', () => {
    const st = start(lvl([[0, 0, 0], [0, 1, 0], [0, 0, 0]], []), SLOTS);
    expect(target(st, 1)).toBe(-1);
    expect(target(st, 0)).toBe(7);
    st.px[7] = EMPTY;
    expect(target(st, 1)).toBe(4);
  });

  it('reach follows same-color pixels inward from the edge', () => {
    const st = start(lvl([[1, 0, 0], [1, 1, 0], [0, 1, 0]], []), SLOTS);
    expect(reach(st, 1)).toBe(4);
    expect(reach(st, 2)).toBe(0);
  });

  it('take fills the first free slot from a column top', () => {
    const st = start(lvl([[0]], [[{ color: 0, n: 1 }], []]), 2);
    expect(take(st, 1)).toBe(-1);
    expect(take(st, 0)).toBe(0);
    expect(st.cols[0]).toEqual([]);
    expect(take(st, 0)).toBe(-1);
  });

  it('a finished tile frees its slot and the picture is won when empty', () => {
    const st = start(lvl([[0, 1]], [[{ color: 0, n: 1 }, { color: 1, n: 1 }]]), 1);
    take(st, 0);
    expect(take(st, 0)).toBe(-1);
    expect(bite(st)).toEqual([{ slot: 0, pixel: 0, color: 0, done: true }]);
    expect(st.slots[0]).toBeNull();
    take(st, 0);
    bite(st);
    expect(won(st)).toBe(true);
  });

  it('full slots that cannot reach their color are stuck', () => {
    const st = start(lvl([[0, 0, 0], [0, 1, 0], [0, 0, 0]], [[{ color: 1, n: 1 }], [{ color: 0, n: 8 }]]), 1);
    take(st, 0);
    expect(stuck(st)).toBe(true);
    const free = start(lvl([[0, 0, 0], [0, 1, 0], [0, 0, 0]], [[{ color: 1, n: 1 }], [{ color: 0, n: 8 }]]), 2);
    take(free, 0);
    expect(stuck(free)).toBe(false);
  });
});
