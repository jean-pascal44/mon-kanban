import type { BoardState } from "./types";
import { STORAGE_KEY, emptyBoard, normalizeBoard } from "./types";

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyBoard();
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) {
      return emptyBoard();
    }
    return normalizeBoard({
      columns: parsed.columns,
      cards: parsed.cards,
      appTitle: parsed.appTitle,
      appDescription: parsed.appDescription,
    });
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
