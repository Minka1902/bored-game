import { describe, it, expect } from 'vitest';
import { fromArt, generate, playPlan } from '../../src/games/ant-feast/logic';
import { pixelate } from '../../src/games/ant-feast/pixelate';
import { mulberry32 } from '../../src/core/rand';

const img = (w: number, h: number, at: (x: number, y: number) => number[]) =>
  Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => at((i >> 2) % w, Math.floor((i >> 2) / w))[i & 3]);

describe('ant-feast pixelate', () => {
  it('keeps distinct colors, most common first, and makes see-through pixels', () => {
    const art = pixelate(img(3, 2, (x, y) => (y ? [0, 0, 0, 0] : x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255])), 3, 2, 6, 'Mine')!;
    expect(art).toEqual({ name: 'Mine', palette: { A: '#ff0000', B: '#0000ff' }, rows: ['AAB', '...'] });
  });

  it('caps the palette at k and merges near-identical shades', () => {
    const art = pixelate(img(4, 1, (x) => [x * 80, 255 - x * 80, x & 1 ? 2 : 0, 255]), 4, 1, 2, 'k')!;
    expect(Object.keys(art.palette)).toHaveLength(2);
    const flat = pixelate(img(4, 1, (x) => [100 + x, 100, 100, 255]), 4, 1, 6, 'flat')!;
    expect(flat.rows).toEqual(['AAAA']);
  });

  it('folds rare edge blends into the nearest main color', () => {
    const art = pixelate(img(100, 1, (x) => (x === 50 ? [128, 0, 128, 255] : x < 50 ? [255, 0, 0, 255] : [0, 0, 255, 255])), 100, 1, 6, 'edge')!;
    expect(Object.keys(art.palette)).toHaveLength(2);
  });

  it('returns null when nothing is opaque', () => {
    expect(pixelate(img(2, 2, () => [9, 9, 9, 0]), 2, 2, 6, 'none')).toBeNull();
  });

  it('a pixelated photo-like gradient is a winnable level', () => {
    const art = pixelate(img(28, 21, (x, y) => [x * 9, y * 12, (x * y) % 255, 255]), 28, 21, 6, 'grad')!;
    const lv = generate(fromArt(art), { cols: 4, chunk: [20, 60], run: 2 }, mulberry32(3));
    expect(playPlan(lv, 5)).toBe(true);
  });
});
