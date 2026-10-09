import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/physics/circles';

describe('World', () => {
  it('a ball falls and rests on the floor without tunnelling', () => {
    const w = new World();
    w.gravity = 1000;
    w.bounds = { l: 0, r: 100, b: 100 };
    const b = w.add({ x: 50, y: 0, vx: 0, vy: 0, r: 10, m: 1 });
    for (let i = 0; i < 240; i++) w.step(1 / 60);
    expect(b.y).toBeGreaterThan(85);
    expect(b.y).toBeLessThanOrEqual(90.5);
  });

  it('overlapping balls separate', () => {
    const w = new World();
    w.gravity = 0;
    const a = w.add({ x: 0, y: 0, vx: 0, vy: 0, r: 10, m: 1 });
    const c = w.add({ x: 5, y: 0, vx: 0, vy: 0, r: 10, m: 1 });
    for (let i = 0; i < 30; i++) w.step(1 / 60);
    expect(Math.hypot(c.x - a.x, c.y - a.y)).toBeGreaterThanOrEqual(19.5);
  });

  it('static bodies stay put and contacts are reported', () => {
    const w = new World();
    w.gravity = 1000;
    const peg = w.add({ x: 50, y: 50, vx: 0, vy: 0, r: 5, m: 1, static: true });
    const ball = w.add({ x: 51, y: 0, vx: 0, vy: 0, r: 5, m: 1 });
    let hits = 0;
    w.onContact = (a, b) => {
      if ((a === peg || b === peg) && (a === ball || b === ball)) hits++;
    };
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect([peg.x, peg.y]).toEqual([50, 50]);
    expect(hits).toBeGreaterThan(0);
  });

  it('balls bounce off segments', () => {
    const w = new World();
    w.gravity = 1000;
    w.segments.push({ ax: 0, ay: 100, bx: 200, by: 100 });
    const b = w.add({ x: 100, y: 0, vx: 0, vy: 0, r: 10, m: 1 });
    for (let i = 0; i < 240; i++) w.step(1 / 60);
    expect(b.y).toBeLessThanOrEqual(90.5);
    expect(b.y).toBeGreaterThan(80);
  });

  it('remove takes a body out of the simulation', () => {
    const w = new World();
    const b = w.add({ x: 0, y: 0, vx: 0, vy: 0, r: 1, m: 1 });
    w.remove(b);
    expect(w.bodies).not.toContain(b);
  });
});
