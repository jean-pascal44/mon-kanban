import { useCallback, useEffect, useMemo, useState } from "react";
import { loadBoard, saveBoard } from "./storage";
import type { BoardState, Card, Column } from "./types";
import { emptyBoard } from "./types";

function newId(): string {
  return crypto.randomUUID();
}

type ColumnDraft = {
  title: string;
  color: string;
  emoji: string;
};

const defaultDraft = (): ColumnDraft => ({
  title: "",
  color: "#6366f1",
  emoji: "📌",
});

export default function App() {
  const [board, setBoard] = useState<BoardState>(() => loadBoard());
  const [columnModal, setColumnModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; column: Column }
    | null
  >(null);
  const [draft, setDraft] = useState<ColumnDraft>(defaultDraft);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  const openCreateColumn = () => {
    setDraft(defaultDraft());
    setColumnModal({ mode: "create" });
  };

  const openEditColumn = (column: Column) => {
    setDraft({
      title: column.title,
      color: column.color,
      emoji: column.emoji,
    });
    setColumnModal({ mode: "edit", column });
  };

  const closeColumnModal = () => {
    setColumnModal(null);
    setDraft(defaultDraft());
  };

  const submitColumn = () => {
    const title = draft.title.trim();
    if (!title) return;
    const emoji = draft.emoji.trim() || "📋";
    const color = draft.color.trim() || "#64748b";

    if (columnModal?.mode === "create") {
      const col: Column = {
        id: newId(),
        title,
        color,
        emoji,
      };
      setBoard((b) => ({ ...b, columns: [...b.columns, col] }));
    } else if (columnModal?.mode === "edit") {
      const id = columnModal.column.id;
      setBoard((b) => ({
        ...b,
        columns: b.columns.map((c) =>
          c.id === id ? { ...c, title, color, emoji } : c,
        ),
      }));
    }
    closeColumnModal();
  };

  const deleteColumn = (columnId: string) => {
    if (!confirm("Supprimer cette colonne et toutes ses cartes ?")) return;
    setBoard((b) => ({
      columns: b.columns.filter((c) => c.id !== columnId),
      cards: b.cards.filter((c) => c.columnId !== columnId),
    }));
  };

  const addCard = (columnId: string) => {
    const title = (newCardTitles[columnId] ?? "").trim();
    if (!title) return;
    const card: Card = {
      id: newId(),
      columnId,
      title,
      body: "",
    };
    setBoard((b) => ({ ...b, cards: [...b.cards, card] }));
    setNewCardTitles((m) => ({ ...m, [columnId]: "" }));
  };

  const updateCard = (cardId: string, patch: Partial<Pick<Card, "title" | "body">>) => {
    setBoard((b) => ({
      ...b,
      cards: b.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    }));
  };

  const deleteCard = (cardId: string) => {
    setBoard((b) => ({ ...b, cards: b.cards.filter((c) => c.id !== cardId) }));
  };

  const moveCardToColumn = useCallback((cardId: string, columnId: string) => {
    setBoard((b) => ({
      ...b,
      cards: b.cards.map((c) =>
        c.id === cardId ? { ...c, columnId } : c,
      ),
    }));
  }, []);

  const onCardDragStart = (e: React.DragEvent, cardId: string) => {
    setDragCardId(cardId);
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCardDragEnd = () => setDragCardId(null);

  const onColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onColumnDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain") || dragCardId;
    if (cardId) moveCardToColumn(cardId, columnId);
    setDragCardId(null);
  };

  const resetAll = () => {
    if (!confirm("Effacer tout le tableau (colonnes et cartes) ?")) return;
    setBoard(emptyBoard());
  };

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of board.columns) map.set(c.id, []);
    for (const card of board.cards) {
      const list = map.get(card.columnId);
      if (list) list.push(card);
    }
    return map;
  }, [board]);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            📋
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Mon Kanban</h1>
            <p className="text-xs text-slate-400">
              Colonnes et couleurs personnalisées · données locales
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateColumn}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/80"
          >
            + Colonne
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Réinitialiser
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-4">
        {board.columns.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <p className="text-slate-300 mb-2">Aucune colonne pour l’instant.</p>
            <p className="text-sm text-slate-500 mb-6">
              Ajoutez un état (ex. « À faire », « En cours »), choisissez une couleur et un emoji.
            </p>
            <button
              type="button"
              onClick={openCreateColumn}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Créer une colonne
            </button>
          </div>
        ) : (
          <div className="flex gap-4 min-h-[calc(100dvh-8rem)] items-start">
            {board.columns.map((col) => {
              const cards = cardsByColumn.get(col.id) ?? [];
              return (
                <section
                  key={col.id}
                  className="w-72 shrink-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/20"
                  style={{
                    borderTopWidth: "4px",
                    borderTopColor: col.color,
                  }}
                  onDragOver={onColumnDragOver}
                  onDrop={(e) => onColumnDrop(e, col.id)}
                >
                  <div className="flex items-start justify-between gap-2 p-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0" title="Emoji de la colonne">
                        {col.emoji}
                      </span>
                      <h2 className="font-semibold text-sm truncate" title={col.title}>
                        {col.title}
                      </h2>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        onClick={() => openEditColumn(col)}
                        aria-label={`Modifier ${col.title}`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-red-950/50 hover:text-red-300"
                        onClick={() => deleteColumn(col.id)}
                        aria-label={`Supprimer ${col.title}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 p-2 min-h-[120px]">
                    {cards.map((card) => (
                      <article
                        key={card.id}
                        draggable
                        onDragStart={(e) => onCardDragStart(e, card.id)}
                        onDragEnd={onCardDragEnd}
                        className={`rounded-lg border border-slate-700/80 bg-slate-800/80 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-600 transition ${
                          dragCardId === card.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-1 items-start">
                          <input
                            className="w-full bg-transparent text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:ring-0"
                            value={card.title}
                            onChange={(e) => updateCard(card.id, { title: e.target.value })}
                            aria-label="Titre de la carte"
                          />
                          <button
                            type="button"
                            className="text-slate-500 hover:text-red-400 text-xs px-1"
                            onClick={() => deleteCard(card.id)}
                            aria-label="Supprimer la carte"
                          >
                            ×
                          </button>
                        </div>
                        <textarea
                          className="mt-1 w-full resize-none bg-transparent text-xs text-slate-400 placeholder:text-slate-600 focus:outline-none focus:ring-0 min-h-[2.5rem]"
                          placeholder="Note…"
                          rows={2}
                          value={card.body}
                          onChange={(e) => updateCard(card.id, { body: e.target.value })}
                        />
                      </article>
                    ))}
                  </div>

                  <div className="p-2 border-t border-slate-800/80">
                    <div className="flex gap-1">
                      <input
                        className="flex-1 rounded-md bg-slate-950/50 border border-slate-700 px-2 py-1.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        placeholder="Nouvelle carte…"
                        value={newCardTitles[col.id] ?? ""}
                        onChange={(e) =>
                          setNewCardTitles((m) => ({ ...m, [col.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCard(col.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addCard(col.id)}
                        className="rounded-md bg-slate-800 px-2 text-sm hover:bg-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {columnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="column-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeColumnModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="column-dialog-title" className="text-lg font-semibold mb-4">
              {columnModal.mode === "create" ? "Nouvelle colonne" : "Modifier la colonne"}
            </h2>
            <div className="space-y-3">
              <label className="block text-sm text-slate-400">
                Titre
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="block text-sm text-slate-400">
                Couleur
                <div className="mt-1 flex gap-2 items-center">
                  <input
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-slate-950"
                    value={/^#[0-9A-Fa-f]{6}$/.test(draft.color) ? draft.color : "#6366f1"}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                  />
                  <input
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
                    value={draft.color}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    placeholder="#6366f1"
                  />
                </div>
              </label>
              <label className="block text-sm text-slate-400">
                Emoji
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-2xl leading-none"
                  value={draft.emoji}
                  onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
                  maxLength={8}
                  placeholder="📌"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
                onClick={closeColumnModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                onClick={submitColumn}
                disabled={!draft.title.trim()}
              >
                {columnModal.mode === "create" ? "Ajouter" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
