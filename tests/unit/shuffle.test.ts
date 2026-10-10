import { describe, it, expect } from 'vitest';
import { pickNext } from '../../src/app/shuffle';

describe('pickNext', () => {
  it('never returns the current game when others exist', () => {
    for (let i = 0; i < 50; i++) expect(pickNext(['a', 'b'], [], Math.random, 'a')).toBe('b');
  });

  it('avoids recent games when possible', () => {
    expect(pickNext(['a', 'b', 'c', 'd'], ['a', 'b', 'c'], () => 0, 'a')).toBe('d');
  });

  it('falls back gracefully when everything is recent', () => {
    expect(pickNext(['a', 'b'], ['a', 'b'], () => 0.99, 'a')).toBe('b');
  });

  it('returns the only game when there is just one', () => {
    expect(pickNext(['a'], ['a'], Math.random, 'a')).toBe('a');
  });
});
