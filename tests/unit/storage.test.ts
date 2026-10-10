import { describe, it, expect } from 'vitest';
import { Store, type KV } from '../../src/core/storage';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('Store', () => {
  it('round-trips JSON under the bg1: prefix', () => {
    const kv = mem();
    const s = new Store(kv);
    s.set('x', { a: 1 });
    expect(kv.m.get('bg1:x')).toBe('{"a":1}');
    expect(s.get('x', null)).toEqual({ a: 1 });
  });

  it('returns fallback for missing or corrupt values', () => {
    const kv = mem();
    kv.setItem('bg1:bad', '{nope');
    const s = new Store(kv);
    expect(s.get('bad', 7)).toBe(7);
    expect(s.get('missing', 'd')).toBe('d');
  });

  it('survives a backend that throws', () => {
    const kv: KV = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('quota'); },
      removeItem() { throw new Error('x'); },
    };
    const s = new Store(kv);
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a', 0)).toBe(1);
  });

  it('works with no backend at all', () => {
    const s = new Store(null);
    s.set('a', 2);
    expect(s.get('a', 0)).toBe(2);
  });

  it('removes keys', () => {
    const kv = mem();
    const s = new Store(kv);
    s.set('a', 1);
    s.remove('a');
    expect(s.get('a', 0)).toBe(0);
    expect(kv.m.has('bg1:a')).toBe(false);
  });

  it('scopes per game', () => {
    const kv = mem();
    const g = new Store(kv).scoped('flap');
    g.set('lvl', 3);
    expect(kv.m.get('bg1:g:flap:lvl')).toBe('3');
    expect(g.get('lvl', 0)).toBe(3);
  });
});
