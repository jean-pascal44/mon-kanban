import type { BoardState } from "./types";
import { STORAGE_KEY, emptyBoard } from "./types";

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyBoard();
    const parsed = JSON.parse(raw) as BoardState;
    if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) {
      return emptyBoard();
    }
    return parsed;
  } catch {
    return emptyBoard();
  }
}

export function saveBoard(state: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota ou mode privé
  }
}
