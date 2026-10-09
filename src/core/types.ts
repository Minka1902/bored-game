import type { ScopedStore } from './storage';

export type Category = 'fidget' | 'arcade' | 'brain';
/** How a game's score is ranked: bigger is better, smaller is better, or no score at all. */
export type Scoring = 'high' | 'low' | 'none';

export interface GameMeta {
  id: string;
  title: string;
  category: Category;
  emoji: string;
  color: string;
  blurb: string;
  scoring: Scoring;
  /** Suffix shown after scores, e.g. 'ms', '%', 'rpm', 's'. */
  unit?: string;
  load: () => Promise<{ default: GameFactory }>;
}

export interface ScoreResult {
  best: number;
  isNew: boolean;
}

export type SfxName =
  | 'pop' | 'click' | 'tick' | 'whoosh' | 'hit' | 'score' | 'fail' | 'win' | 'thud' | 'blip'
  | 'kick' | 'snare' | 'hat' | 'clap';

export interface Sfx {
  enabled: boolean;
  unlock(): void;
  /** pitch multiplies every frequency of the preset; vol multiplies its loudness. */
  play(name: SfxName, pitch?: number, vol?: number): void;
  tone(freq: number, dur?: number, type?: OscillatorType, vol?: number): void;
}

export interface Haptics {
  enabled: boolean;
  tap(): void;
  bump(): void;
  buzz(ms?: number): void;
}

export interface Hud {
  set(text: string | number): void;
  sub(text: string): void;
  clear(): void;
}

export interface GameContext {
  /** Full-size stage container (position: relative). Games render only inside it. */
  root: HTMLElement;
  meta: GameMeta;
  sfx: Sfx;
  haptics: Haptics;
  store: ScopedStore;
  hud: Hud;
  submitScore(v: number): ScoreResult;
  best(): number | undefined;
  /** Submits the score and shows the shared game-over card. retry() must restart the round in place. */
  gameOver(o: { score: number; text?: string; retry: () => void }): void;
  /** One-line hint that fades on the first touch. */
  hint(text: string): void;
}

export interface GameInstance {
  pause(): void;
  resume(): void;
  destroy(): void;
}

export type GameFactory = (ctx: GameContext) => GameInstance;
