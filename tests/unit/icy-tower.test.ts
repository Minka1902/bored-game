import { describe, it, expect } from 'vitest';
import { COMBO_TIME, GAP, floorWidth, HALF, jumpVelocity, land, makeFloor, MILESTONE, step, tickCombo, W, type Body, type Floor } from '../../src/games/icy-tower/logic';
import { mulberry32 } from '../../src/core/rand';

const body = (o: Partial<Body> = {}): Body => ({ x: W / 2, y: 0, vx: 0, vy: 0, floor: 0, grounded: true, ...o });
const floors = (list: Record<number, Floor>) => (n: number): Floor => list[n] ?? { n, x: 0, w: 0 };

describe('icy-tower logic', () => {
  it('floors narrow as you climb, stay inside the tower, and milestones span it', () => {
    const r = mulberry32(3);
    for (let n = 1; n < 400; n++) {
      const f = makeFloor(n, r);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(W);
    }
    expect(floorWidth(MILESTONE)).toBe(W);
    expect(floorWidth(120)).toBeLessThan(floorWidth(10));
  });

  it('running faster jumps higher', () => {
    expect(jumpVelocity(400)).toBeGreaterThan(jumpVelocity(100));
    expect(jumpVelocity(-400)).toBe(jumpVelocity(400));
  });

  it('a standing jump lands on the floor above when it is overhead', () => {
    const b = body();
    const at = floors({ 0: { n: 0, x: 0, w: W }, 1: { n: 1, x: W / 2 - 40, w: 80 } });
    let landed = -1;
    step(b, 0, true, 1 / 120, at);
    for (let i = 0; i < 240 && landed < 0; i++) landed = step(b, 0, false, 1 / 120, at);
    expect(landed).toBe(1);
    expect(b.y).toBe(GAP);
    expect(b.grounded).toBe(true);
  });

  it('falls through the gap when no floor is overhead and lands back on the ground', () => {
    const b = body();
    const at = floors({ 0: { n: 0, x: 0, w: W }, 1: { n: 1, x: 0, w: 40 } });
    let landed = -1;
    step(b, 0, true, 1 / 120, at);
    for (let i = 0; i < 240 && landed < 0; i++) landed = step(b, 0, false, 1 / 120, at);
    expect(landed).toBe(0);
  });

  it('walking off an edge starts a fall', () => {
    const b = body({ y: GAP, floor: 1, x: 70, vx: -200 });
    const at = floors({ 0: { n: 0, x: 0, w: W }, 1: { n: 1, x: 60, w: 100 } });
    for (let i = 0; i < 30 && b.grounded; i++) step(b, -1, false, 1 / 60, at);
    expect(b.grounded).toBe(false);
    expect(b.x + HALF).toBeLessThanOrEqual(60);
  });

  it('bounces off the walls keeping its speed', () => {
    const b = body({ x: W - 12, vx: 300, grounded: false, y: 500, vy: 100 });
    step(b, 0, false, 1 / 60, floors({}));
    expect(b.vx).toBe(-300);
  });

  it('multi-floor jumps chain into a combo that pays floors squared', () => {
    let c = { floors: 0, jumps: 0, t: 0 };
    c = land(c, 0, 3).combo;
    c = land(c, 3, 5).combo;
    expect(c).toEqual({ floors: 5, jumps: 2, t: COMBO_TIME });
    const end = land(c, 5, 6);
    expect(end.bonus).toBe(25);
    expect(end.combo.jumps).toBe(0);
  });

  it('a lone multi-floor jump pays nothing, and a combo times out into its payout', () => {
    expect(land(land({ floors: 0, jumps: 0, t: 0 }, 0, 4).combo, 4, 5).bonus).toBe(0);
    const c = land(land({ floors: 0, jumps: 0, t: 0 }, 0, 2).combo, 2, 4).combo;
    expect(tickCombo(c, 1).bonus).toBe(0);
    expect(tickCombo(c, COMBO_TIME + 0.1).bonus).toBe(16);
  });
});
