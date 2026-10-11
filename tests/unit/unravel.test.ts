import { describe, it, expect } from 'vitest';
import { bottom, free, generate, paint, playPlan, pull, reach, start, stuck, take, target, won, type GenOpts, type Level, type Spool } from '../../src/games/unravel/logic';
import { mulberry32 } from '../../src/core/rand';

const OPTS: GenOpts = { w: 24, h: 24, colors: 6, gw: 7, chunk: [10, 30], slots: 6, dig: 0.3 };

const sp = (color: number, n: number): Spool => ({ color, n });

const lvl = (rows: number[][], grid: (Spool | null)[], gw: number, slots = 2): Level => ({
  w: rows[0].length,
  h: rows.length,
  px: Int8Array.from(rows.flat()),
  gw,
  gh: Math.ceil(grid.length / gw),
  grid,
  plan: [],
  slots,
});

describe('unravel logic', () => {
  it('every generated level is won by its plan, at every size, color count, tray and dig', () => {
    for (let s = 1; s <= 80; s++) {
      const size = 16 + (s % 17);
      const lv = generate({ ...OPTS, w: size, h: size, colors: 3 + (s % 6), gw: 5 + (s % 4), slots: 3 + (s % 7), dig: (s % 5) / 4 }, mulberry32(s));
      expect(playPlan(lv)).toBe(true);
      expect(lv.grid.length).toBe(lv.gw * lv.gh);
      expect(lv.grid.filter(Boolean).length).toBeGreaterThan(lv.grid.length - lv.gw);
    }
  });

  it('spool counts match the picture exactly, color by color', () => {
    const lv = generate(OPTS, mulberry32(7));
    const spools = lv.grid.filter((v): v is Spool => !!v);
    for (let c = 0; c < OPTS.colors; c++) {
      const pixels = lv.px.filter((v) => v === c).length;
      expect(spools.filter((t) => t.color === c).reduce((n, t) => n + t.n, 0)).toBe(pixels);
    }
    expect(spools.every((t) => t.n > 0)).toBe(true);
  });

  it('paint only uses the given colors, from the first on top to the last at the bottom', () => {
    for (let s = 1; s <= 20; s++) {
      const px = paint(30, 30, 3 + (s % 6), mulberry32(s));
      const avg = (y: number) => px.slice(y * 30, y * 30 + 30).reduce((a, b) => a + b, 0) / 30;
      expect(px.every((v) => v >= 0 && v < 3 + (s % 6))).toBe(true);
      expect(avg(0)).toBeLessThan(avg(29));
    }
  });

  it('a pull takes the bottom pixel of the nearest matching column and the column drops', () => {
    const st = start(lvl([[2, 0, 0], [1, 0, 1]], [sp(1, 2), sp(0, 1)], 2));
    expect(bottom(st, 0)).toBe(1);
    expect(target(st, 1, 2)).toBe(2);
    expect(reach(st, 1)).toBe(2);
    take(st, 0);
    expect(pull(st)).toEqual([{ slot: 0, x: 0, y: 1, color: 1, done: false }]);
    expect(bottom(st, 0)).toBe(2);
    expect(target(st, 1, 0)).toBe(2);
  });

  it('only spools on top or next to an empty path to the top are free', () => {
    const grid = [sp(0, 1), null, sp(0, 1), sp(0, 1), sp(0, 1), sp(0, 1), sp(0, 1), null, sp(0, 1)];
    const st = start(lvl([[0]], grid, 3));
    expect([...free(st)]).toEqual([1, 0, 1, 0, 1, 0, 0, 0, 0]);
    expect(take(st, 6)).toBe(-1);
    expect(take(st, 4)).toBe(0);
    expect([...free(st)]).toEqual([1, 0, 1, 1, 0, 1, 1, 0, 1]);
  });

  it('take fails on an empty cell or a full tray', () => {
    const st = start(lvl([[0]], [sp(0, 1), null, sp(0, 1)], 3, 1));
    expect(take(st, 1)).toBe(-1);
    expect(take(st, 0)).toBe(0);
    expect(take(st, 2)).toBe(-1);
    expect(st.grid[2]).not.toBeNull();
  });

  it('finished spools leave the tray, the rest slide over, and an empty picture is won', () => {
    const st = start(lvl([[1, 0]], [sp(0, 1), sp(1, 1)], 2, 2));
    take(st, 0);
    take(st, 1);
    expect(pull(st).map((p) => p.done)).toEqual([true, true]);
    expect(st.tray).toEqual([]);
    expect(won(st)).toBe(true);
    const slide = start(lvl([[1, 1, 0]], [sp(0, 1), sp(1, 2)], 2, 2));
    take(slide, 0);
    take(slide, 1);
    pull(slide);
    expect(slide.tray).toEqual([sp(1, 1)]);
  });

  it('a full tray whose colors end no column is stuck', () => {
    const rows = [[1, 1], [0, 0]];
    const st = start(lvl(rows, [sp(1, 2), sp(0, 2)], 2, 1));
    take(st, 0);
    expect(stuck(st)).toBe(true);
    const room = start(lvl(rows, [sp(1, 2), sp(0, 2)], 2, 2));
    take(room, 0);
    expect(stuck(room)).toBe(false);
  });
});
