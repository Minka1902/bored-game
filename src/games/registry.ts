import type { GameMeta } from '../core/types';

// Metadata only: each game's code is a separate chunk fetched by load() when it is opened.
// Emoji are limited to Unicode 12 or older so they render on older Android and Windows.
export const GAMES: GameMeta[] = [
  // fidget
  { id: 'bubble-wrap', title: 'Bubble Wrap', category: 'fidget', emoji: '💥', color: '#7dd3fc', blurb: 'Pop pop pop', scoring: 'none', load: () => import('./bubble-wrap/index') },
  { id: 'poppers', title: 'Poppers', category: 'fidget', emoji: '🌈', color: '#f472b6', blurb: 'Press every dome', scoring: 'none', load: () => import('./poppers/index') },
  { id: 'spinner', title: 'Spinner', category: 'fidget', emoji: '🌀', color: '#a855f7', blurb: 'Flick it fast', scoring: 'high', unit: 'rpm', load: () => import('./spinner/index') },
  { id: 'swirl', title: 'Swirl', category: 'fidget', emoji: '✨', color: '#6366f1', blurb: 'Stir the stars', scoring: 'none', load: () => import('./swirl/index') },
  // arcade
  { id: 'flapper', title: 'Flapper', category: 'arcade', emoji: '🐤', color: '#ffe14d', blurb: 'Tap through gaps', scoring: 'high', load: () => import('./flapper/index') },
  { id: 'stacker', title: 'Stacker', category: 'arcade', emoji: '🧱', color: '#ff7a45', blurb: 'Stack it high', scoring: 'high', load: () => import('./stacker/index') },
  // brain
  { id: 'g2048', title: '2048', category: 'brain', emoji: '🔢', color: '#ffb020', blurb: 'Swipe to merge', scoring: 'high', load: () => import('./g2048/index') },
  { id: 'perfect-circle', title: 'Perfect Circle', category: 'brain', emoji: '⭕', color: '#ff4d6d', blurb: 'Draw it round', scoring: 'high', unit: '%', load: () => import('./perfect-circle/index') },
  { id: 'ten-seconds', title: 'Ten Seconds', category: 'brain', emoji: '⏱️', color: '#34d399', blurb: 'Stop at 10.00', scoring: 'low', unit: 's', load: () => import('./ten-seconds/index') },
  { id: 'reaction', title: 'Reaction', category: 'brain', emoji: '⚡', color: '#22d3ee', blurb: 'Tap on green', scoring: 'low', unit: 'ms', load: () => import('./reaction/index') },
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
