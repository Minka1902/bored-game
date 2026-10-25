import { describe, it, expect } from 'vitest';
import { ART } from '../../src/games/ant-feast/art';
import { bite, EMPTY, fromArt, generate, playPlan, reach, start, stuck, take, target, won, type Level } from '../../src/games/ant-feast/logic';
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
  it('every picture has even rows drawn only with its own palette', () => {
    for (const a of ART) {
      expect(a.rows.every((r) => r.length === a.rows[0].length), a.name).toBe(true);
      const used = new Set(a.rows.join('').replace(/\./g, ''));
      expect([...used].sort(), a.name).toEqual(Object.keys(a.palette).sort());
    }
  });

  it('fromArt maps palette keys to color indexes and see-through to EMPTY', () => {
    const pic = fromArt({ name: 't', palette: { A: '#000000', B: '#ffffff' }, rows: ['A.', 'BA'] });
    expect([pic.w, pic.h, [...pic.px]]).toEqual([2, 2, [0, EMPTY, 1, 0]]);
  });

  it('every picture is won by its plan with one slot and with five, at easy and hard chunk sizes', () => {
    ART.forEach((a, k) => {
      const pic = fromArt(a);
      for (const [lo, run] of [[3, 2], [12, 5]]) {
        const lv = generate(pic, { cols: 4, chunk: [lo, lo * 3], run }, mulberry32(k * 7 + lo));
        expect(playPlan(lv, 1), a.name).toBe(true);
        expect(playPlan(lv, SLOTS), a.name).toBe(true);
        const lens = lv.cols.map((c) => c.length);
        expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(run + 1);
      }
    });
  });

  it('tile counts match the picture exactly, color by color', () => {
    const pic = fromArt(ART[ART.length - 1]);
    const lv = generate(pic, { cols: 4, chunk: [8, 30], run: 3 }, mulberry32(7));
    const tiles = lv.cols.flat();
    for (let c = 0; c < Object.keys(ART[ART.length - 1].palette).length; c++) {
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
