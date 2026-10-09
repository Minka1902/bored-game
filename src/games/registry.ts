import type { GameMeta } from '../core/types';

// Metadata only: each game's code is a separate chunk fetched by load() when it is opened.
export const GAMES: GameMeta[] = [
  {
    id: 'test-pattern', title: 'Test Pattern', category: 'fidget', emoji: '🧪', color: '#22d3ee',
    blurb: 'Engine check', scoring: 'none', load: () => import('./test-pattern/index'),
  },
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
