import type { GameMeta } from '../core/types';

// Metadata only: each game's code is a separate chunk fetched by load() when it is opened.
// Emoji are limited to Unicode 12 or older so they render on older Android and Windows.
export const GAMES: GameMeta[] = [
  // arcade
  { id: 'flapper', title: 'Flapper', emoji: '🐤', color: '#ffe14d', blurb: 'Tap through gaps', scoring: 'high', load: () => import('./flapper/index') },
  { id: 'stacker', title: 'Stacker', emoji: '🧱', color: '#ff7a45', blurb: 'Stack it high', scoring: 'high', load: () => import('./stacker/index') },
  { id: 'knife-throw', title: 'Knife Throw', emoji: '🔪', color: '#e5e7eb', blurb: 'Stick them all', scoring: 'high', load: () => import('./knife-throw/index') },
  { id: 'chop', title: 'Chop', emoji: '🪓', color: '#4ade80', blurb: 'Dodge the branches', scoring: 'high', load: () => import('./chop/index') },
  { id: 'hop-run', title: 'Hop Run', emoji: '🦖', color: '#fb7185', blurb: 'Jump the cacti', scoring: 'high', load: () => import('./hop-run/index') },
  { id: 'brick-breaker', title: 'Brick Breaker', emoji: '🧨', color: '#f87171', blurb: 'Smash every brick', scoring: 'high', load: () => import('./brick-breaker/index') },
  { id: 'snake', title: 'Snake', emoji: '🐍', color: '#34d399', blurb: 'Eat, grow, repeat', scoring: 'high', load: () => import('./snake/index') },
  { id: 'dodge', title: 'Dodge', emoji: '☄️', color: '#38bdf8', blurb: 'Survive the rain', scoring: 'high', unit: 's', load: () => import('./dodge/index') },
  { id: 'tile-tap', title: 'Tile Tap', emoji: '🎹', color: '#fff6e9', blurb: 'Only the dark ones', scoring: 'high', load: () => import('./tile-tap/index') },
  { id: 'slice', title: 'Slice', emoji: '🍉', color: '#f43f5e', blurb: 'Swipe, dodge bombs', scoring: 'high', load: () => import('./slice/index') },
  { id: 'merge-drop', title: 'Merge Drop', emoji: '🍊', color: '#fb923c', blurb: 'Match and merge', scoring: 'high', load: () => import('./merge-drop/index') },
  { id: 'block-fit', title: 'Block Fit', emoji: '🟦', color: '#818cf8', blurb: 'Fill the lines', scoring: 'high', load: () => import('./block-fit/index') },
  { id: 'keepy-up', title: 'Keepy Up', emoji: '⚽', color: '#4ade80', blurb: "Don't let it drop", scoring: 'high', load: () => import('./keepy-up/index') },
  { id: 'peg-drop', title: 'Peg Drop', emoji: '🎯', color: '#f472b6', blurb: 'Bounce to riches', scoring: 'high', load: () => import('./peg-drop/index') },
  // brain
  { id: 'g2048', title: '2048', emoji: '🔢', color: '#ffb020', blurb: 'Swipe to merge', scoring: 'high', load: () => import('./g2048/index') },
  { id: 'perfect-circle', title: 'Perfect Circle', emoji: '⭕', color: '#ff4d6d', blurb: 'Draw it round', scoring: 'high', unit: '%', load: () => import('./perfect-circle/index') },
  { id: 'ten-seconds', title: 'Ten Seconds', emoji: '⏱️', color: '#34d399', blurb: 'Stop at 10.00', scoring: 'low', unit: 's', load: () => import('./ten-seconds/index') },
  { id: 'reaction', title: 'Reaction', emoji: '⚡', color: '#22d3ee', blurb: 'Tap on green', scoring: 'low', unit: 'ms', load: () => import('./reaction/index') },
  { id: 'odd-color', title: 'Odd Color', emoji: '👁️', color: '#facc15', blurb: 'Spot the different one', scoring: 'high', load: () => import('./odd-color/index') },
  { id: 'color-clash', title: 'Color Clash', emoji: '🎨', color: '#c084fc', blurb: 'Ink, not words', scoring: 'high', load: () => import('./color-clash/index') },
  { id: 'math-sprint', title: 'Math Sprint', emoji: '➗', color: '#2dd4bf', blurb: 'Right or wrong?', scoring: 'high', load: () => import('./math-sprint/index') },
  { id: 'echo', title: 'Echo', emoji: '🎵', color: '#fb7185', blurb: 'Repeat the pattern', scoring: 'high', load: () => import('./echo/index') },
  { id: 'ball-sort', title: 'Ball Sort', emoji: '🧪', color: '#a3e635', blurb: 'One color per tube', scoring: 'high', levels: true, load: () => import('./ball-sort/index') },
  { id: 'ant-feast', title: 'Ant Feast', emoji: '🐜', color: '#ff7a45', blurb: 'Eat the picture', scoring: 'high', levels: true, load: () => import('./ant-feast/index') },
  { id: 'bus-loop', title: 'Bus Loop', emoji: '🚌', color: '#3b82f6', blurb: 'Park, board, depart', scoring: 'high', levels: true, load: () => import('./bus-loop/index') },
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
