import { describe, it, expect } from 'vitest';
import { Store } from '../../src/core/storage';
import { Stats } from '../../src/core/stats';

const fresh = () => new Stats(new Store(null));

describe('Stats', () => {
  it('tracks best for high scoring', () => {
    const st = fresh();
    expect(st.submit('a', 5, 'high')).toEqual({ best: 5, isNew: true });
    expect(st.submit('a', 3, 'high')).toEqual({ best: 5, isNew: false });
    expect(st.submit('a', 9, 'high')).toEqual({ best: 9, isNew: true });
  });

  it('tracks best for low scoring (reaction ms)', () => {
    const st = fresh();
    st.submit('r', 300, 'low');
    expect(st.submit('r', 250, 'low')).toEqual({ best: 250, isNew: true });
    expect(st.submit('r', 400, 'low')).toEqual({ best: 250, isNew: false });
  });

  it('ignores non-finite scores', () => {
    const st = fresh();
    st.submit('a', 4, 'high');
    expect(st.submit('a', NaN, 'high')).toEqual({ best: 4, isNew: false });
  });

  it('accumulates plays and time; totals', () => {
    const st = fresh();
    st.played('a', 1000);
    st.played('a', 500);
    st.played('b', 10);
    expect(st.get('a')).toMatchObject({ plays: 2, ms: 1500 });
    expect(st.get('zzz')).toEqual({ plays: 0, ms: 0 });
    expect(st.totalMs()).toBe(1510);
  });

  it('persists through the store', () => {
    const store = new Store(null);
    new Stats(store).submit('a', 7, 'high');
    expect(new Stats(store).get('a').best).toBe(7);
  });

  it('favorites toggle and recent is MRU, unique, capped at 8', () => {
    const st = fresh();
    expect(st.toggleFav('a')).toBe(true);
    expect(st.favs()).toEqual(['a']);
    expect(st.toggleFav('a')).toBe(false);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'a']) st.pushRecent(id);
    expect(st.recent()).toEqual(['a', 'i', 'h', 'g', 'f', 'e', 'd', 'c']);
  });
});
