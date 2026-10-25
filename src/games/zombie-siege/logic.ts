export type ZombieKind = 'walker' | 'runner' | 'brute';

export interface Weapon {
  id: string;
  name: string;
  icon: string;
  price: number;
  dmg: number;
  /** shots per second */
  rate: number;
  pellets: number;
  /** total cone in radians */
  spread: number;
  speed: number;
  range: number;
  /** extra zombies a bullet passes through */
  pierce: number;
  /** explosion radius, 0 for plain bullets */
  splash: number;
}

export interface Upgrade {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  max: number;
}

export interface Loadout {
  coins: number;
  owned: string[];
  weapon: string;
  ranks: Record<string, number>;
}

export interface Perks {
  dmg: number;
  rate: number;
  hp: number;
  speed: number;
  /** fraction of contact damage taken */
  armor: number;
  magnet: number;
}

export interface Spawn {
  kind: ZombieKind;
  /** seconds after the level starts */
  at: number;
}

export const WEAPONS: Weapon[] = [
  { id: 'pistol', name: 'Pistol', icon: '🔫', price: 0, dmg: 10, rate: 3, pellets: 1, spread: 0.06, speed: 720, range: 320, pierce: 0, splash: 0 },
  { id: 'smg', name: 'SMG', icon: '💨', price: 150, dmg: 7, rate: 10, pellets: 1, spread: 0.16, speed: 760, range: 300, pierce: 0, splash: 0 },
  { id: 'shotgun', name: 'Shotgun', icon: '💥', price: 300, dmg: 9, rate: 1.4, pellets: 7, spread: 0.55, speed: 680, range: 220, pierce: 0, splash: 0 },
  { id: 'rifle', name: 'Rifle', icon: '🎯', price: 550, dmg: 34, rate: 2.2, pellets: 1, spread: 0.01, speed: 1150, range: 480, pierce: 2, splash: 0 },
  { id: 'minigun', name: 'Minigun', icon: '⚙️', price: 900, dmg: 8, rate: 20, pellets: 1, spread: 0.22, speed: 820, range: 340, pierce: 0, splash: 0 },
  { id: 'rocket', name: 'Rockets', icon: '🚀', price: 1400, dmg: 70, rate: 0.9, pellets: 1, spread: 0.02, speed: 460, range: 420, pierce: 0, splash: 80 },
];

export const UPGRADES: Upgrade[] = [
  { id: 'dmg', name: 'Damage', icon: '🗡️', desc: '+15% damage', price: 60, max: 6 },
  { id: 'rate', name: 'Fire rate', icon: '⚡', desc: '+12% shots per second', price: 70, max: 6 },
  { id: 'hp', name: 'Max health', icon: '❤️', desc: '+25 health', price: 50, max: 6 },
  { id: 'speed', name: 'Boots', icon: '👟', desc: '+8% move speed', price: 40, max: 4 },
  { id: 'armor', name: 'Armor', icon: '🛡️', desc: '-10% damage taken', price: 80, max: 5 },
  { id: 'magnet', name: 'Magnet', icon: '🧲', desc: 'Grab coins from further away', price: 30, max: 4 },
];

export const ZOMBIES: Record<ZombieKind, { hp: number; speed: number; dmg: number; coins: number; r: number }> = {
  walker: { hp: 22, speed: 40, dmg: 12, coins: 3, r: 17 },
  runner: { hp: 12, speed: 92, dmg: 8, coins: 4, r: 13 },
  brute: { hp: 110, speed: 27, dmg: 28, coins: 14, r: 25 },
};

export const BASE_HP = 100;
export const BASE_SPEED = 170;
export const BASE_MAGNET = 70;

export const NEW_LOADOUT: Loadout = { coins: 0, owned: ['pistol'], weapon: 'pistol', ranks: {} };

export const weapon = (id: string): Weapon => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

export const rank = (l: Loadout, id: string): number => l.ranks[id] ?? 0;

/** Upgrade prices grow 60% per rank already bought. */
export const upgradePrice = (u: Upgrade, r: number): number => Math.round(u.price * 1.6 ** r);

export const zombieCount = (level: number): number => 8 + 4 * level;

export const hpScale = (level: number): number => 1 + (level - 1) * 0.12;

export function perks(l: Loadout): Perks {
  return {
    dmg: 1 + 0.15 * rank(l, 'dmg'),
    rate: 1 + 0.12 * rank(l, 'rate'),
    hp: BASE_HP + 25 * rank(l, 'hp'),
    speed: BASE_SPEED * (1 + 0.08 * rank(l, 'speed')),
    armor: 1 - 0.1 * rank(l, 'armor'),
    magnet: BASE_MAGNET + 40 * rank(l, 'magnet'),
  };
}

/** Buys a weapon or the next rank of an upgrade. Returns the new loadout, or null when it is owned, maxed or too expensive. */
export function buy(l: Loadout, id: string): Loadout | null {
  const w = WEAPONS.find((x) => x.id === id);
  if (w) {
    if (l.owned.includes(id) || l.coins < w.price) return null;
    return { ...l, coins: l.coins - w.price, owned: [...l.owned, id], weapon: id };
  }
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return null;
  const r = rank(l, id);
  const cost = upgradePrice(u, r);
  if (r >= u.max || l.coins < cost) return null;
  return { ...l, coins: l.coins - cost, ranks: { ...l.ranks, [id]: r + 1 } };
}

export const equip = (l: Loadout, id: string): Loadout => (l.owned.includes(id) ? { ...l, weapon: id } : l);

/** The level's zombies in spawn order: runners join from level 3, brutes from level 5, and they come faster each level. */
export function wave(level: number, r: () => number): Spawn[] {
  const gap = Math.max(0.3, 1.5 - level * 0.08);
  const runners = level >= 3 ? Math.min(0.4, 0.1 + (level - 3) * 0.04) : 0;
  const brutes = level >= 5 ? Math.min(0.2, 0.05 + (level - 5) * 0.02) : 0;
  let at = 1;
  return Array.from({ length: zombieCount(level) }, () => {
    const roll = r();
    const s: Spawn = { kind: roll < brutes ? 'brute' : roll < brutes + runners ? 'runner' : 'walker', at };
    at += gap * (0.6 + r() * 0.8);
    return s;
  });
}
