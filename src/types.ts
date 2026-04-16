export type Column = {
  id: string;
  title: string;
  /** Couleur d’accent (hex ou CSS valide) */
  color: string;
  emoji: string;
};

export type Card = {
  id: string;
  columnId: string;
  title: string;
  body: string;
};

export type BoardState = {
  columns: Column[];
  cards: Card[];
};

export const STORAGE_KEY = "mon-kanban-v1";

export function emptyBoard(): BoardState {
  return { columns: [], cards: [] };
}
