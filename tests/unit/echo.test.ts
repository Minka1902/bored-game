import { describe, it, expect } from 'vitest';
import { nextSequence, checkInput } from '../../src/games/echo/logic';

describe('echo logic', () => {
  it('appends one pad in 0-3 without changing the rest', () => {
    expect(nextSequence([1, 2], () => 0.99)).toEqual([1, 2, 3]);
    expect(nextSequence([], () => 0)).toEqual([0]);
  });

  it('checks partial, wrong and complete input', () => {
    expect(checkInput([0, 1, 2], [0, 1])).toBe('ok');
    expect(checkInput([0, 1, 2], [0, 2])).toBe('wrong');
    expect(checkInput([0, 1, 2], [0, 1, 2])).toBe('complete');
  });

  it('extra input past the sequence is wrong', () => {
    expect(checkInput([0], [0, 1])).toBe('wrong');
  });
});
