import { describe, it, expect } from 'vitest';
import { parseRoute, playHref } from '../../src/app/router';

describe('parseRoute', () => {
  it('parses play routes', () => {
    expect(parseRoute('#/play/snake')).toEqual({ name: 'play', id: 'snake' });
  });

  it('falls back to home for anything else', () => {
    for (const h of ['', '#', '#/', '#/nope', '#/play/', '#/play']) expect(parseRoute(h)).toEqual({ name: 'home' });
  });

  it('decodes ids safely', () => {
    expect(parseRoute('#/play/%E2%9C%93')).toEqual({ name: 'play', id: '✓' });
    expect(parseRoute('#/play/%E0%A4%A')).toEqual({ name: 'home' });
  });

  it('playHref round-trips', () => {
    expect(parseRoute(playHref('g2048'))).toEqual({ name: 'play', id: 'g2048' });
  });
});
