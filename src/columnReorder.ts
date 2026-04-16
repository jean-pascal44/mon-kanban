import type { Column } from "./types";

export function reorderColumns(
  columns: Column[],
  fromId: string,
  toId: string,
): Column[] {
  if (fromId === toId) return columns;
  const fromIdx = columns.findIndex((c) => c.id === fromId);
  const toIdx = columns.findIndex((c) => c.id === toId);
  if (fromIdx < 0 || toIdx < 0) return columns;
  const next = [...columns];
  const [item] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, item);
  return next;
}
