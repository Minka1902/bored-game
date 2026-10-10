import { describe, it, expect } from 'vitest';
import { sliceSlab } from '../../src/games/stacker/logic';

describe('sliceSlab', () => {
  it('cuts the overhang on the right', () => {
    expect(sliceSlab({ x: 0, w: 100 }, { x: 30, w: 100 })).toMatchObject({
      placed: { x: 30, w: 70 },
      cut: { x: 100, w: 30 },
      perfect: false,
    });
  });

  it('cuts the overhang on the left', () => {
    expect(sliceSlab({ x: 50, w: 100 }, { x: 20, w: 100 })).toMatchObject({
      placed: { x: 50, w: 70 },
      cut: { x: 20, w: 30 },
    });
  });

  it('snaps near-perfect drops', () => {
    expect(sliceSlab({ x: 0, w: 100 }, { x: 3, w: 100 })).toMatchObject({
      placed: { x: 0, w: 100 },
      cut: null,
      perfect: true,
    });
  });

  it('misses entirely', () => {
    expect(sliceSlab({ x: 0, w: 100 }, { x: 150, w: 100 }).placed).toBeNull();
  });
});
