import type { BoardState, Card, Column } from "./types";

export const BACKUP_VERSION = 1;

export type KanbanBackupFile = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  board: BoardState;
  theme?: "light" | "dark";
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function validateBoardState(data: unknown): BoardState | null {
  if (!isRecord(data)) return null;
  if (!Array.isArray(data.columns) || !Array.isArray(data.cards)) return null;

  const columns: Column[] = [];
  for (const item of data.columns) {
    if (!isRecord(item)) return null;
    const { id, title, color, emoji } = item;
    if (typeof id !== "string" || !id.trim()) return null;
    if (typeof title !== "string") return null;
    if (typeof color !== "string") return null;
    if (typeof emoji !== "string") return null;
    columns.push({ id, title, color, emoji });
  }

  const cards: Card[] = [];
  for (const item of data.cards) {
    if (!isRecord(item)) return null;
    const { id, columnId, title, body } = item;
    if (typeof id !== "string" || !id.trim()) return null;
    if (typeof columnId !== "string") return null;
    if (typeof title !== "string") return null;
    const bodyStr = typeof body === "string" ? body : "";
    cards.push({ id, columnId, title, body: bodyStr });
  }

  return { columns, cards };
}

export type ParseBackupResult =
  | { ok: true; board: BoardState; theme: "light" | "dark" | undefined }
  | { ok: false; error: string };

/**
 * Accepte le fichier exporté par l’app, ou un JSON brut `{ columns, cards }`.
 */
export function parseKanbanBackup(text: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Fichier JSON invalide." };
  }

  if (!isRecord(data)) {
    return { ok: false, error: "Le fichier doit contenir un objet JSON." };
  }

  let boardRaw: unknown;
  if ("board" in data && data.board !== undefined) {
    boardRaw = data.board;
  } else if (Array.isArray(data.columns) && Array.isArray(data.cards)) {
    boardRaw = data;
  } else {
    return {
      ok: false,
      error: "Format inconnu : attendu « board » ou des champs « columns » / « cards ».",
    };
  }

  const board = validateBoardState(boardRaw);
  if (!board) {
    return { ok: false, error: "Structure du tableau invalide (colonnes ou cartes)." };
  }

  let theme: "light" | "dark" | undefined;
  if (data.theme === "light" || data.theme === "dark") {
    theme = data.theme;
  }

  return { ok: true, board, theme };
}

export function downloadKanbanBackup(board: BoardState, theme: "light" | "dark"): void {
  const payload: KanbanBackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    board,
    theme,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mon-kanban-export-${day}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
