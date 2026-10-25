import type { Store } from './storage';
import type { Scoring, ScoreResult } from './types';

export interface GameStats {
  best?: number;
  plays: number;
  ms: number;
}

type StatsMap = Record<string, GameStats>;
const RECENT_MAX = 8;

export class Stats {
  constructor(private store: Store) {}

  private map(): StatsMap {
    return this.store.get<StatsMap>('stats', {});
  }

  private put(id: string, s: GameStats): void {
    this.store.set('stats', { ...this.map(), [id]: s });
  }

  get(id: string): GameStats {
    const s = this.map()[id];
    return s ? { ...s } : { plays: 0, ms: 0 };
  }

  submit(id: string, v: number, scoring: Scoring): ScoreResult {
    const s = this.get(id);
    if (!Number.isFinite(v)) return { best: s.best ?? 0, isNew: false };
    const better = s.best === undefined || (scoring === 'low' ? v < s.best : v > s.best);
    if (better) this.put(id, { ...s, best: v });
    return { best: better ? v : (s.best as number), isNew: better };
  }

  played(id: string, ms: number): void {
    const s = this.get(id);
    this.put(id, { ...s, plays: s.plays + 1, ms: s.ms + Math.max(0, Math.round(ms)) });
  }

  totalMs(): number {
    return Object.values(this.map()).reduce((n, s) => n + (s.ms || 0), 0);
  }

  favs(): string[] {
    return [...this.store.get<string[]>('favs', [])];
  }

  /** Returns true when the game is now a favorite. */
  toggleFav(id: string): boolean {
    const f = this.favs();
    const on = !f.includes(id);
    this.store.set('favs', on ? [...f, id] : f.filter((x) => x !== id));
    return on;
  }

  recent(): string[] {
    return [...this.store.get<string[]>('recent', [])];
  }

  pushRecent(id: string): void {
    this.store.set('recent', [id, ...this.recent().filter((x) => x !== id)].slice(0, RECENT_MAX));
  }
}
