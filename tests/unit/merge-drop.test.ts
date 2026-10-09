import { describe, it, expect } from 'vitest';
import { mergeResult, TIERS, DROPPABLE } from '../../src/games/merge-drop/logic';

describe('merge-drop logic', () => {
  it('equal tiers merge up and score points', () => {
    const r = mergeResult(2, 2)!;
    expect(r.tier).toBe(3);
    expect(r.points).toBeGreaterThan(0);
  });

  it('bigger merges are worth more', () => {
    expect(mergeResult(5, 5)!.points).toBeGreaterThan(mergeResult(1, 1)!.points);
  });

  it('unequal tiers do not merge', () => {
    expect(mergeResult(2, 3)).toBeNull();
  });

  it('a pair of top-tier balls vanishes for a bonus', () => {
    const top = TIERS.length - 1;
    const r = mergeResult(top, top)!;
    expect(r.tier).toBe(-1);
    expect(r.points).toBeGreaterThan(mergeResult(top - 1, top - 1)!.points);
  });

  it('radii strictly increase and there are 11 tiers', () => {
    expect(TIERS.length).toBe(11);
    TIERS.slice(1).forEach((t, i) => expect(t.r).toBeGreaterThan(TIERS[i].r));
  });

  it('only small tiers are dropped', () => {
    expect(DROPPABLE).toBe(5);
  });
});
