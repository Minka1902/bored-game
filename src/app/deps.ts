import type { Store } from '../core/storage';
import type { Stats } from '../core/stats';
import type { Haptics, Sfx } from '../core/types';

export interface Settings {
  sound: boolean;
  haptics: boolean;
}

/** Services shared by every screen. */
export interface Deps {
  store: Store;
  stats: Stats;
  sfx: Sfx;
  haptics: Haptics;
}

export interface Nav {
  home(): void;
  shuffle(): void;
}

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function loadSettings(store: Store): Settings {
  return { sound: true, haptics: true, ...store.get<Partial<Settings>>('settings', {}) };
}

export function applySettings(d: Deps, s: Settings): void {
  d.sfx.enabled = s.sound;
  d.haptics.enabled = s.haptics;
  d.store.set('settings', s);
}

export const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M13 9.5C14 8 15 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3" /></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></svg>',
};
