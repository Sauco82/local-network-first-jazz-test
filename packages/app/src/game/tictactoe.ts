import type { Board } from "./board";
import { CELL_EMPTY } from "./board";

export type LineOutcome =
  | { kind: "ongoing" }
  | { kind: "win"; side: "left" | "right" }
  | { kind: "draw" };

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function flat(board: Board): number[] {
  return [...board[0], ...board[1], ...board[2]];
}

function boardFull(board: Board): boolean {
  return flat(board).every((c) => c !== CELL_EMPTY);
}

/** After a move: three in a row → win; full board with no line → draw; else ongoing. */
export function evaluateLineOutcome(board: Board): LineOutcome {
  const f = flat(board);
  for (const [a, b, c] of LINES) {
    const v = f[a];
    if (v !== CELL_EMPTY && v === f[b] && v === f[c]) {
      return { kind: "win", side: v === 1 ? "left" : "right" };
    }
  }
  if (boardFull(board)) {
    return { kind: "draw" };
  }
  return { kind: "ongoing" };
}
