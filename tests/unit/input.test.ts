import { describe, it, expect } from 'vitest';
import { PointerTracker, swipeDir } from '../../src/core/input';

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
