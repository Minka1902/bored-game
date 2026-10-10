import { describe, it, expect } from 'vitest';
import { singlePointer, type Ptr } from '../../src/core/input';
import { remapBodies } from '../../src/core/physics/circles';

const ptr = (id: number, x = 0, y = 0): Ptr => ({ id, x, y, sx: x, sy: y, px: x, py: y, t0: 0, t: 0 });

describe('singlePointer', () => {
  it('follows only the first finger until it lifts', () => {
    const log: string[] = [];
    const h = singlePointer({
      down: (p) => log.push(`down${p.id}`),
      move: (p) => log.push(`move${p.id}`),
      up: (p) => log.push(`up${p.id}`),
    });
    h.down!(ptr(1));
    h.down!(ptr(2));
    h.move!(ptr(2));
    h.move!(ptr(1));
    h.up!(ptr(2));
    h.up!(ptr(1));
    h.down!(ptr(2));
    expect(log).toEqual(['down1', 'move1', 'up1', 'down2']);
  });

  it('passes hover through untouched', () => {
    let hovered = 0;
    singlePointer({ hover: () => hovered++ }).hover!(1, 2);
    expect(hovered).toBe(1);
  });
});

describe('remapBodies', () => {
  it('moves and scales bodies from one box into another', () => {
    const b = { x: 50, y: 100, vx: 10, vy: 0, r: 10, m: 100 };
    remapBodies([b], { x: 0, y: 0, w: 100, h: 200 }, { x: 100, y: 50, w: 200, h: 400 });
    expect([b.x, b.y, b.r, b.vx]).toEqual([200, 250, 20, 20]);
    expect(b.m).toBe(400);
  });

  it('keeps static bodies scaled too', () => {
    const peg = { x: 10, y: 10, vx: 0, vy: 0, r: 2, m: 1, static: true };
    remapBodies([peg], { x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 50, h: 50 });
    expect([peg.x, peg.y, peg.r]).toEqual([5, 5, 1]);
  });
});
