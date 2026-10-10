import { describe, it, expect } from 'vitest';
import { angleDiff, roundRect, segDist } from '../../src/core/math';

const recorder = () => {
  const calls: string[] = [];
  const g = new Proxy({}, { get: (_, k) => (...args: number[]) => calls.push(`${String(k)}(${args.join(',')})`) });
  return { g: g as unknown as CanvasRenderingContext2D, calls };
};

describe('roundRect', () => {
  it('draws a path for a normal rectangle', () => {
    const { g, calls } = recorder();
    roundRect(g, 0, 0, 100, 50, 10);
    expect(calls.filter((c) => c.startsWith('arcTo')).length).toBe(4);
  });

  it('draws nothing (and never a negative radius) for a collapsed rectangle', () => {
    const { g, calls } = recorder();
    roundRect(g, 0, 0, -20, 50, 10);
    roundRect(g, 0, 0, 20, 0, 10);
    expect(calls).toEqual([]);
  });

  it('caps the radius at half the shortest side', () => {
    const { g, calls } = recorder();
    roundRect(g, 0, 0, 10, 40, 30);
    expect(calls.find((c) => c.startsWith('arcTo'))).toMatch(/,5\)$/);
  });
});

describe('angleDiff and segDist', () => {
  it('wraps angle differences into (-PI, PI]', () => {
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2);
  });
  it('measures distance to a segment, clamping to its ends', () => {
    expect(segDist(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(segDist(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
  });
});
