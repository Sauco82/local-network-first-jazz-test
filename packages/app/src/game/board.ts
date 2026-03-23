/** 3×3 grid: `0` empty, `1` left player, `2` right player. */
export type Board = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export const CELL_EMPTY = 0;
export const CELL_LEFT = 1;
export const CELL_RIGHT = 2;

export const EMPTY_BOARD: Board = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export function setBoardCell(board: Board, row: number, col: number, value: number): Board {
  return board.map((r, ri) =>
    ri === row
      ? (r.map((c, ci) => (ci === col ? value : c)) as [number, number, number])
      : r,
  ) as Board;
}
