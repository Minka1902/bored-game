import { describe, it, expect } from 'vitest';
import { buy, equip, NEW_LOADOUT, perks, UPGRADES, upgradePrice, wave, WEAPONS, zombieCount } from '../../src/games/zombie-siege/logic';
import { mulberry32 } from '../../src/core/rand';

describe('zombie-siege logic', () => {
  it('each level brings four more zombies, spawned in time order', () => {
    for (let level = 1; level <= 20; level++) {
      const w = wave(level, mulberry32(level));
      expect(w).toHaveLength(zombieCount(level));
      expect(w.every((s, i) => !i || s.at > w[i - 1].at)).toBe(true);
    }
    expect(zombieCount(2) - zombieCount(1)).toBe(4);
  });

  it('runners join from level 3 and brutes from level 5', () => {
    const kinds = (level: number) => new Set(Array.from({ length: 20 }, (_, s) => wave(level, mulberry32(s)).map((z) => z.kind)).flat());
    expect([...kinds(2)]).toEqual(['walker']);
    expect(kinds(4).has('runner')).toBe(true);
    expect(kinds(4).has('brute')).toBe(false);
    expect(kinds(8).has('brute')).toBe(true);
  });

  it('buying a weapon spends coins, adds it and equips it; it cannot be bought twice', () => {
    const smg = WEAPONS.find((w) => w.id === 'smg')!;
    const l = buy({ ...NEW_LOADOUT, coins: smg.price + 5 }, 'smg')!;
    expect(l).toMatchObject({ coins: 5, weapon: 'smg', owned: ['pistol', 'smg'] });
    expect(buy({ ...l, coins: 9999 }, 'smg')).toBeNull();
    expect(buy({ ...NEW_LOADOUT, coins: smg.price - 1 }, 'smg')).toBeNull();
    expect(equip(l, 'pistol').weapon).toBe('pistol');
    expect(equip(l, 'rocket').weapon).toBe('smg');
  });

  it('upgrades get pricier per rank and stop at their max', () => {
    const u = UPGRADES.find((x) => x.id === 'hp')!;
    let l = { ...NEW_LOADOUT, coins: 100000 };
    for (let r = 0; r < u.max; r++) {
      const next = buy(l, 'hp')!;
      expect(l.coins - next.coins).toBe(upgradePrice(u, r));
      l = next;
    }
    expect(buy(l, 'hp')).toBeNull();
    expect(perks(l).hp).toBe(100 + 25 * u.max);
    expect(upgradePrice(u, 2)).toBeGreaterThan(upgradePrice(u, 1));
  });

  it('unknown items buy nothing', () => {
    expect(buy({ ...NEW_LOADOUT, coins: 1e6 }, 'laser')).toBeNull();
  });
});
