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

export const DEFAULT_APP_TITLE = "Mon Kanban";
export const DEFAULT_APP_DESCRIPTION =
  "Colonnes et couleurs personnalisées · données locales";

export type BoardState = {
  columns: Column[];
  cards: Card[];
  appTitle: string;
  appDescription: string;
};

export const STORAGE_KEY = "mon-kanban-v1";

export function normalizeBoard(
  partial: Partial<BoardState> & Pick<BoardState, "columns" | "cards">,
): BoardState {
  const title =
    typeof partial.appTitle === "string" && partial.appTitle.trim()
      ? partial.appTitle.trim()
      : DEFAULT_APP_TITLE;
  const desc =
    typeof partial.appDescription === "string"
      ? partial.appDescription
      : DEFAULT_APP_DESCRIPTION;
  return {
    columns: partial.columns,
    cards: partial.cards,
    appTitle: title,
    appDescription: desc,
  };
}

export function emptyBoard(): BoardState {
  return normalizeBoard({ columns: [], cards: [] });
}
