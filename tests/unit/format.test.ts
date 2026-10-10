import { describe, it, expect } from 'vitest';
import { fmtScore, fmtDuration } from '../../src/app/format';

describe('fmtScore', () => {
  it('formats integers with thousands separators and unit', () => {
    expect(fmtScore(12345)).toBe('12,345');
    expect(fmtScore(250, 'ms')).toBe('250 ms');
  });
  it('keeps two decimals for small fractional values and one for bigger ones', () => {
    expect(fmtScore(0.0712, 's')).toBe('0.07 s');
    expect(fmtScore(42.36, 's')).toBe('42.4 s');
  });
  it('glues % to the number', () => {
    expect(fmtScore(93.41, '%')).toBe('93.4%');
  });
});

describe('fmtDuration', () => {
  it('says less than a minute for short totals', () => {
    expect(fmtDuration(0)).toBe('0 min');
    expect(fmtDuration(59_000)).toBe('<1 min');
  });
  it('uses minutes, then hours and minutes', () => {
    expect(fmtDuration(12 * 60_000 + 5_000)).toBe('12 min');
    expect(fmtDuration(3 * 3_600_000 + 12 * 60_000)).toBe('3 h 12 min');
  });
});
