import { describe, it, expect } from 'vitest';
import { createLoop, clampDt, MAX_DT } from '../../src/core/loop';

const fakeRaf = () => {
  const q: FrameRequestCallback[] = [];
  let cancelled = 0;
  return {
    q,
    cancelled: () => cancelled,
    raf: { request: (cb: FrameRequestCallback) => (q.push(cb), q.length), cancel: () => void cancelled++ },
  };
};

describe('loop', () => {
  it('clamps dt so a hidden tab does not teleport the game', () => {
    expect(clampDt(16)).toBeCloseTo(0.016);
    expect(clampDt(5000)).toBe(MAX_DT);
    expect(clampDt(-3)).toBe(0);
  });

  it('ticks in seconds and stop cancels the pending frame', () => {
    const f = fakeRaf();
    const ticks: number[] = [];
    const l = createLoop((dt) => ticks.push(dt), f.raf);
    l.start();
    expect(l.running).toBe(true);
    f.q.shift()!(0);
    f.q.shift()!(16);
    l.stop();
    expect(f.cancelled()).toBe(1);
    expect(l.running).toBe(false);
    expect(ticks.at(-1)).toBeCloseTo(0.016);
  });

  it('start is idempotent and a restart does not produce a huge first dt', () => {
    const f = fakeRaf();
    const ticks: number[] = [];
    const l = createLoop((dt) => ticks.push(dt), f.raf);
    l.start();
    l.start();
    expect(f.q.length).toBe(1);
    f.q.shift()!(0);
    l.stop();
    f.q.length = 0;
    l.start();
    f.q.shift()!(9000);
    expect(ticks.every((t) => t <= MAX_DT)).toBe(true);
    expect(ticks.at(-1)).toBe(0);
  });
});
