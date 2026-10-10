import type { SwipeDir } from '../../core/input';

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  /** body[0] is the head */
  body: Cell[];
  dir: SwipeDir;
  food: Cell | null;
  dead: boolean;
  ate: boolean;
}

const DELTA: Record<SwipeDir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<SwipeDir, SwipeDir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function initSnake(cols: number, rows: number): SnakeState {
  const x = Math.floor(cols / 2);
  const y = Math.floor(rows / 2);
  return { cols, rows, body: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }], dir: 'right', food: null, dead: false, ate: false };
}

/** Advances one tick. Turning straight back is ignored; the tail cell is free because it moves this tick. */
export function step(s: SnakeState, want: SwipeDir): SnakeState {
  if (s.dead) return s;
  const dir = s.body.length > 1 && want === OPPOSITE[s.dir] ? s.dir : want;
  const head = { x: s.body[0].x + DELTA[dir].x, y: s.body[0].y + DELTA[dir].y };
  const ate = !!s.food && s.food.x === head.x && s.food.y === head.y;
  const keep = ate ? s.body : s.body.slice(0, -1);
  const out = head.x < 0 || head.y < 0 || head.x >= s.cols || head.y >= s.rows;
  const bite = keep.some((b) => b.x === head.x && b.y === head.y);
  if (out || bite) return { ...s, dir, dead: true, ate: false };
  return { ...s, dir, body: [head, ...keep], food: ate ? null : s.food, ate };
}

export function placeFood(s: SnakeState, r: () => number): Cell | null {
  const taken = new Set(s.body.map((b) => b.y * s.cols + b.x));
  const free: number[] = [];
  for (let i = 0; i < s.cols * s.rows; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(r() * free.length)];
  return { x: i % s.cols, y: Math.floor(i / s.cols) };
}
