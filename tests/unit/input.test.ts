import { describe, it, expect } from 'vitest';
import { bindPointers, PointerTracker, swipeDir, wheelSwipe } from '../../src/core/input';

describe('PointerTracker', () => {
  it('tracks two fingers independently', () => {
    const t = new PointerTracker();
    t.down(1, 0, 0, 0);
    t.down(2, 100, 100, 0);
    const a = t.move(1, 10, 0, 16)!;
    const b = t.move(2, 100, 90, 16)!;
    expect([a.x - a.sx, b.y - b.sy]).toEqual([10, -10]);
    expect(t.up(1, 10, 0, 32)!.id).toBe(1);
    expect(t.count).toBe(1);
  });

  it('keeps the previous position for deltas', () => {
    const t = new PointerTracker();
    t.down(1, 0, 0, 0);
    t.move(1, 5, 5, 1);
    const p = t.move(1, 8, 9, 2)!;
    expect([p.px, p.py]).toEqual([5, 5]);
  });

  it('ignores moves and ups for unknown pointers', () => {
    const t = new PointerTracker();
    expect(t.move(9, 1, 1, 1)).toBeNull();
    expect(t.up(9, 1, 1, 1)).toBeNull();
  });
});

describe('swipeDir', () => {
  it('picks the dominant axis above threshold', () => {
    expect(swipeDir(40, 5)).toBe('right');
    expect(swipeDir(-3, -50)).toBe('up');
    expect(swipeDir(-60, 10)).toBe('left');
    expect(swipeDir(0, 31)).toBe('down');
    expect(swipeDir(5, 5)).toBeNull();
  });
});

describe('wheelSwipe', () => {
  const run = (events: [number, number, number][]) => {
    const out: string[] = [];
    const h = wheelSwipe((d) => out.push(d), { min: 40, idleMs: 100 });
    for (const [deltaX, deltaY, timeStamp] of events) h({ deltaX, deltaY, timeStamp });
    return out;
  };

  it('fires once per gesture, following natural scrolling', () => {
    expect(run([[0, 20, 0], [0, 30, 10], [0, 80, 20], [0, 50, 30]])).toEqual(['up']);
    expect(run([[60, 0, 0]])).toEqual(['left']);
  });

  it('a pause longer than idleMs starts a new gesture', () => {
    expect(run([[0, -50, 0], [0, -50, 50], [0, -50, 300]])).toEqual(['down', 'down']);
  });
});

describe('bindPointers', () => {
  it('tracks a pointer even when the game has no down handler', () => {
    const on = new Map<string, (e: unknown) => void>();
    const el = {
      addEventListener: (t: string, f: (e: unknown) => void) => on.set(t, f),
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: () => {},
    } as unknown as HTMLElement;
    const ups: number[] = [];
    bindPointers(el, { up: (p) => ups.push(p.x - p.sx) });
    const ev = (clientX: number) => ({ pointerId: 1, button: 0, clientX, clientY: 0, timeStamp: 0, preventDefault: () => {} });
    on.get('pointerdown')!(ev(100));
    on.get('pointerup')!(ev(40));
    expect(ups).toEqual([-60]);
  });
});
