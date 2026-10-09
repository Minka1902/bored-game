export type Board = number[][];
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Cell = [number, number];

export const SIZE = 4;

export interface SlideResult {
  board: Board;
  moved: boolean;
  gained: number;
  /** cells where a merge produced a new tile */
  merges: Cell[];
  /** every tile's journey, for the slide animation */
  moves: { from: Cell; to: Cell; v: number }[];
}

export const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

/** The cells of line i, ordered from the edge tiles slide toward. */
function line(i: number, dir: Dir): Cell[] {
  return Array.from({ length: SIZE }, (_, j): Cell => {
    if (dir === 'left') return [i, j];
    if (dir === 'right') return [i, SIZE - 1 - j];
    if (dir === 'up') return [j, i];
    return [SIZE - 1 - j, i];
  });
}

export function slide(board: Board, dir: Dir): SlideResult {
  const b = board.map((r) => r.slice());
  const res: SlideResult = { board: b, moved: false, gained: 0, merges: [], moves: [] };
  for (let i = 0; i < SIZE; i++) {
    const cells = line(i, dir);
    const tiles = cells.map((c) => ({ c, v: b[c[0]][c[1]] })).filter((t) => t.v > 0);
    const out: number[] = [];
    for (let k = 0; k < tiles.length; k++) {
      const dest = cells[out.length];
      const t = tiles[k];
      const next = tiles[k + 1];
      if (next && next.v === t.v) {
        out.push(t.v * 2);
        res.gained += t.v * 2;
        res.merges.push(dest);
        res.moves.push({ from: t.c, to: dest, v: t.v }, { from: next.c, to: dest, v: next.v });
        k++;
      } else {
        out.push(t.v);
        res.moves.push({ from: t.c, to: dest, v: t.v });
      }
    }
    cells.forEach(([r, c], k) => {
      const v = out[k] ?? 0;
      if (b[r][c] !== v) res.moved = true;
      b[r][c] = v;
    });
  }
  return res;
}

export function canMove(b: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c];
      if (!v) return true;
      if (c + 1 < SIZE && b[r][c + 1] === v) return true;
      if (r + 1 < SIZE && b[r + 1][c] === v) return true;
    }
  return false;
}

/** Puts a 2 (90%) or 4 into a random empty cell; returns a new board. */
export function spawn(board: Board, r: () => number): Board {
  const b = board.map((row) => row.slice());
  const empty: Cell[] = [];
  b.forEach((row, ri) => row.forEach((v, ci) => !v && empty.push([ri, ci])));
  if (!empty.length) return b;
  const [er, ec] = empty[Math.floor(r() * empty.length)];
  b[er][ec] = r() < 0.9 ? 2 : 4;
  return b;
}
