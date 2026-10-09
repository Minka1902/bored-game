export const N = 8;
/** 0 = empty, otherwise a color index + 1 */
export type Grid = number[][];
export type Piece = number[][];

export const PIECES: Piece[] = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1, 1, 1, 1]],
  [[1], [1], [1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  [[1, 0], [1, 1]],
  [[0, 1], [1, 1]],
  [[1, 1], [1, 0]],
  [[1, 1], [0, 1]],
  [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
];

export const emptyGrid = (): Grid => Array.from({ length: N }, () => Array(N).fill(0));

export function canPlace(grid: Grid, piece: Piece, r: number, c: number): boolean {
  for (let i = 0; i < piece.length; i++)
    for (let j = 0; j < piece[i].length; j++) {
      if (!piece[i][j]) continue;
      const rr = r + i;
      const cc = c + j;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || grid[rr][cc]) return false;
    }
  return true;
}

export interface PlaceResult {
  grid: Grid;
  cleared: { rows: number[]; cols: number[] };
  points: number;
}

/** Places a piece (caller checks canPlace), clears full rows and columns, and scores the move. */
export function place(grid: Grid, piece: Piece, r: number, c: number, v = 1): PlaceResult {
  const g = grid.map((row) => row.slice());
  let cells = 0;
  piece.forEach((row, i) =>
    row.forEach((on, j) => {
      if (!on) return;
      g[r + i][c + j] = v;
      cells++;
    }),
  );
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < N; i++) {
    if (g[i].every(Boolean)) rows.push(i);
    if (g.every((row) => row[i])) cols.push(i);
  }
  for (const i of rows) g[i].fill(0);
  for (const j of cols) for (const row of g) row[j] = 0;
  const lines = rows.length + cols.length;
  return { grid: g, cleared: { rows, cols }, points: cells + 10 * lines * lines };
}

export function anyFits(grid: Grid, pieces: Piece[]): boolean {
  return pieces.some((p) => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canPlace(grid, p, r, c)) return true;
    return false;
  });
}
