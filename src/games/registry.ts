import type { GameMeta } from '../core/types';

// Metadata only: each game's code is a separate chunk fetched by load() when it is opened.
// Emoji are limited to Unicode 12 or older so they render on older Android and Windows.
export const GAMES: GameMeta[] = [
  // fidget
  { id: 'bubble-wrap', title: 'Bubble Wrap', category: 'fidget', emoji: '💥', color: '#7dd3fc', blurb: 'Pop pop pop', scoring: 'none', load: () => import('./bubble-wrap/index') },
  { id: 'poppers', title: 'Poppers', category: 'fidget', emoji: '🌈', color: '#f472b6', blurb: 'Press every dome', scoring: 'none', load: () => import('./poppers/index') },
  { id: 'spinner', title: 'Spinner', category: 'fidget', emoji: '🌀', color: '#a855f7', blurb: 'Flick it fast', scoring: 'high', unit: 'rpm', load: () => import('./spinner/index') },
  { id: 'swirl', title: 'Swirl', category: 'fidget', emoji: '✨', color: '#6366f1', blurb: 'Stir the stars', scoring: 'none', load: () => import('./swirl/index') },
  { id: 'switchboard', title: 'Switchboard', category: 'fidget', emoji: '🎛️', color: '#a3e635', blurb: 'Click all the things', scoring: 'none', load: () => import('./switchboard/index') },
  { id: 'fireworks', title: 'Fireworks', category: 'fidget', emoji: '🎆', color: '#e879f9', blurb: 'Light up the sky', scoring: 'none', load: () => import('./fireworks/index') },
  { id: 'power-wash', title: 'Power Wash', category: 'fidget', emoji: '🚿', color: '#22d3ee', blurb: 'Blast off the dirt', scoring: 'none', load: () => import('./power-wash/index') },
  { id: 'kaleido', title: 'Kaleido', category: 'fidget', emoji: '🔮', color: '#c084fc', blurb: 'Mirror doodles', scoring: 'none', load: () => import('./kaleido/index') },
  { id: 'beat-pads', title: 'Beat Pads', category: 'fidget', emoji: '🥁', color: '#fb923c', blurb: 'Make noise, nicely', scoring: 'none', load: () => import('./beat-pads/index') },
  { id: 'slime', title: 'Slime', category: 'fidget', emoji: '🟢', color: '#86efac', blurb: 'Squish it', scoring: 'none', load: () => import('./slime/index') },
  { id: 'sandfall', title: 'Sandfall', category: 'fidget', emoji: '⏳', color: '#fcd34d', blurb: 'Pour rainbow sand', scoring: 'none', load: () => import('./sandfall/index') },
  { id: 'ripples', title: 'Ripples', category: 'fidget', emoji: '💧', color: '#60a5fa', blurb: 'Touch the water', scoring: 'none', load: () => import('./ripples/index') },
  { id: 'soap-cut', title: 'Soap Cut', category: 'fidget', emoji: '🧼', color: '#f9a8d4', blurb: 'Crunchy cubes', scoring: 'none', load: () => import('./soap-cut/index') },
  // arcade
  { id: 'flapper', title: 'Flapper', category: 'arcade', emoji: '🐤', color: '#ffe14d', blurb: 'Tap through gaps', scoring: 'high', load: () => import('./flapper/index') },
  { id: 'stacker', title: 'Stacker', category: 'arcade', emoji: '🧱', color: '#ff7a45', blurb: 'Stack it high', scoring: 'high', load: () => import('./stacker/index') },
  { id: 'knife-throw', title: 'Knife Throw', category: 'arcade', emoji: '🔪', color: '#e5e7eb', blurb: 'Stick them all', scoring: 'high', load: () => import('./knife-throw/index') },
  { id: 'chop', title: 'Chop', category: 'arcade', emoji: '🪓', color: '#4ade80', blurb: 'Dodge the branches', scoring: 'high', load: () => import('./chop/index') },
  { id: 'hop-run', title: 'Hop Run', category: 'arcade', emoji: '🦖', color: '#fb7185', blurb: 'Jump the cacti', scoring: 'high', load: () => import('./hop-run/index') },
  { id: 'brick-breaker', title: 'Brick Breaker', category: 'arcade', emoji: '🧨', color: '#f87171', blurb: 'Smash every brick', scoring: 'high', load: () => import('./brick-breaker/index') },
  { id: 'snake', title: 'Snake', category: 'arcade', emoji: '🐍', color: '#34d399', blurb: 'Eat, grow, repeat', scoring: 'high', load: () => import('./snake/index') },
  { id: 'dodge', title: 'Dodge', category: 'arcade', emoji: '☄️', color: '#38bdf8', blurb: 'Survive the rain', scoring: 'high', unit: 's', load: () => import('./dodge/index') },
  { id: 'tile-tap', title: 'Tile Tap', category: 'arcade', emoji: '🎹', color: '#fff6e9', blurb: 'Only the dark ones', scoring: 'high', load: () => import('./tile-tap/index') },
  { id: 'slice', title: 'Slice', category: 'arcade', emoji: '🍉', color: '#f43f5e', blurb: 'Swipe, dodge bombs', scoring: 'high', load: () => import('./slice/index') },
  { id: 'merge-drop', title: 'Merge Drop', category: 'arcade', emoji: '🍊', color: '#fb923c', blurb: 'Match and merge', scoring: 'high', load: () => import('./merge-drop/index') },
  { id: 'block-fit', title: 'Block Fit', category: 'arcade', emoji: '🟦', color: '#818cf8', blurb: 'Fill the lines', scoring: 'high', load: () => import('./block-fit/index') },
  { id: 'keepy-up', title: 'Keepy Up', category: 'arcade', emoji: '⚽', color: '#4ade80', blurb: "Don't let it drop", scoring: 'high', load: () => import('./keepy-up/index') },
  { id: 'peg-drop', title: 'Peg Drop', category: 'arcade', emoji: '🎯', color: '#f472b6', blurb: 'Bounce to riches', scoring: 'high', load: () => import('./peg-drop/index') },
  // brain
  { id: 'g2048', title: '2048', category: 'brain', emoji: '🔢', color: '#ffb020', blurb: 'Swipe to merge', scoring: 'high', load: () => import('./g2048/index') },
  { id: 'perfect-circle', title: 'Perfect Circle', category: 'brain', emoji: '⭕', color: '#ff4d6d', blurb: 'Draw it round', scoring: 'high', unit: '%', load: () => import('./perfect-circle/index') },
  { id: 'ten-seconds', title: 'Ten Seconds', category: 'brain', emoji: '⏱️', color: '#34d399', blurb: 'Stop at 10.00', scoring: 'low', unit: 's', load: () => import('./ten-seconds/index') },
  { id: 'reaction', title: 'Reaction', category: 'brain', emoji: '⚡', color: '#22d3ee', blurb: 'Tap on green', scoring: 'low', unit: 'ms', load: () => import('./reaction/index') },
  { id: 'odd-color', title: 'Odd Color', category: 'brain', emoji: '👁️', color: '#facc15', blurb: 'Spot the different one', scoring: 'high', load: () => import('./odd-color/index') },
  { id: 'color-clash', title: 'Color Clash', category: 'brain', emoji: '🎨', color: '#c084fc', blurb: 'Ink, not words', scoring: 'high', load: () => import('./color-clash/index') },
  { id: 'math-sprint', title: 'Math Sprint', category: 'brain', emoji: '➗', color: '#2dd4bf', blurb: 'Right or wrong?', scoring: 'high', load: () => import('./math-sprint/index') },
  { id: 'echo', title: 'Echo', category: 'brain', emoji: '🎵', color: '#fb7185', blurb: 'Repeat the pattern', scoring: 'high', load: () => import('./echo/index') },
  { id: 'ball-sort', title: 'Ball Sort', category: 'brain', emoji: '🧪', color: '#a3e635', blurb: 'One color per tube', scoring: 'high', load: () => import('./ball-sort/index') },
  { id: 'ant-feast', title: 'Ant Feast', category: 'brain', emoji: '🐜', color: '#ff7a45', blurb: 'Eat the picture', scoring: 'high', load: () => import('./ant-feast/index') },
  { id: 'bus-loop', title: 'Bus Loop', category: 'brain', emoji: '🚌', color: '#3b82f6', blurb: 'Park, board, depart', scoring: 'high', load: () => import('./bus-loop/index') },
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
