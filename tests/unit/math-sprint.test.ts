import { describe, it, expect } from 'vitest';
import { makeEquation } from '../../src/games/math-sprint/logic';

const solve = (a: number, op: string, b: number) => (op === '+' ? a + b : op === '−' ? a - b : a * b);

describe('makeEquation', () => {
  it('labels every equation truthfully and never shows negatives', () => {
    for (let level = 0; level < 8; level++)
      for (let i = 0; i < 200; i++) {
        const eq = makeEquation(level);
        const m = /^(\d+) ([+−×]) (\d+) = (\d+)$/.exec(eq.text);
        expect(m, eq.text).not.toBeNull();
        const [, a, op, b, c] = m!;
        expect(solve(+a, op, +b) === +c).toBe(eq.truth);
      }
  });

  it('only uses + and − on the first levels', () => {
    for (let i = 0; i < 100; i++) expect(makeEquation(0).text).not.toContain('×');
  });

  it('produces both true and false equations', () => {
    const truths = new Set(Array.from({ length: 100 }, () => makeEquation(2).truth));
    expect(truths).toEqual(new Set([true, false]));
  });
});
