import { describe, it, expect } from 'vitest';
import { fitSize } from '../../src/core/stage';

describe('fitSize', () => {
  it('caps dpr and computes backing pixels', () => {
    expect(fitSize(390, 844, 3, 2)).toEqual({ w: 390, h: 844, dpr: 2, pxW: 780, pxH: 1688 });
  });

  it('uses dpr 1 when the device reports none', () => {
    expect(fitSize(100, 50, 0, 2).dpr).toBe(1);
  });

  it('never returns a zero-size canvas', () => {
    const r = fitSize(0, 0, 1, 2);
    expect(r.pxW).toBeGreaterThan(0);
    expect(r.pxH).toBeGreaterThan(0);
  });
});
