import { describe, it, expect } from 'vitest';
import { circleScore } from '../../src/games/perfect-circle/logic';

const ring = (n: number, r: number, noise = 0, sweep = Math.PI * 2) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * sweep;
    const rr = r + (i % 2 ? noise : -noise);
    return { x: 200 + Math.cos(a) * rr, y: 200 + Math.sin(a) * rr };
  });

describe('circleScore', () => {
  it('a perfect circle scores ~100', () => {
    expect(circleScore(ring(120, 80))!.score).toBeGreaterThan(99);
  });

  it('finds the center and radius', () => {
    const r = circleScore(ring(120, 80))!;
    expect(r.cx).toBeCloseTo(200, 0);
    expect(r.r).toBeCloseTo(80, 0);
  });

  it('a wobbly circle scores lower', () => {
    expect(circleScore(ring(120, 80, 12))!.score).toBeLessThan(90);
  });

  it('a half arc is penalized', () => {
    expect(circleScore(ring(60, 80, 0, Math.PI))!.score).toBeLessThan(60);
  });

  it('a straight line scores near zero', () => {
    const line = Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: 100 }));
    expect(circleScore(line)!.score).toBeLessThan(15);
  });

  it('too few points → null', () => {
    expect(circleScore(ring(5, 80))).toBeNull();
  });
});
