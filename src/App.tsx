import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadKanbanBackup, parseKanbanBackup } from "./backup";
import { COLUMN_COLOR_PALETTE, EMOJI_PICKER, THEME_STORAGE_KEY } from "./constants";
import { reorderColumns } from "./columnReorder";
import { loadBoard, saveBoard } from "./storage";
import type { BoardState, Card, Column } from "./types";
import { emptyBoard } from "./types";

const MIME_CARD = "application/x-kanban-card";
const MIME_COLUMN = "application/x-kanban-column";
const COL_PREFIX = "kanban-column:";

function newId(): string {
  return crypto.randomUUID();
}

function readTheme(): "light" | "dark" {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

type ColumnDraft = {
  title: string;
  color: string;
  emoji: string;
};

const defaultDraft = (): ColumnDraft => ({
  title: "",
  color: COLUMN_COLOR_PALETTE[8],
  emoji: "📌",
});

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);
  const [board, setBoard] = useState<BoardState>(() => loadBoard());
  const [columnModal, setColumnModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; column: Column }
    | null
  >(null);
  const [draft, setDraft] = useState<ColumnDraft>(defaultDraft);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

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
    const color = draft.color.trim() || COLUMN_COLOR_PALETTE[0];

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
    e.dataTransfer.setData(MIME_CARD, cardId);
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
    let moveCol = e.dataTransfer.getData(MIME_COLUMN);
    if (!moveCol) {
      const plain = e.dataTransfer.getData("text/plain");
      if (plain.startsWith(COL_PREFIX)) moveCol = plain.slice(COL_PREFIX.length);
    }
    if (moveCol) {
      if (moveCol !== columnId) {
        setBoard((b) => ({
          ...b,
          columns: reorderColumns(b.columns, moveCol, columnId),
        }));
      }
      setDraggingColumnId(null);
      return;
    }
    const plainCard = e.dataTransfer.getData("text/plain");
    const cardId =
      e.dataTransfer.getData(MIME_CARD) ||
      (plainCard && !plainCard.startsWith(COL_PREFIX) ? plainCard : "") ||
      dragCardId;
    if (cardId) moveCardToColumn(cardId, columnId);
    setDragCardId(null);
  };

  const onColumnHandleDragStart = (e: React.DragEvent, columnId: string) => {
    e.stopPropagation();
    setDraggingColumnId(columnId);
    e.dataTransfer.setData(MIME_COLUMN, columnId);
    e.dataTransfer.setData("text/plain", `${COL_PREFIX}${columnId}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const onColumnHandleDragEnd = () => {
    setDraggingColumnId(null);
  };

  const resetAll = () => {
    if (!confirm("Effacer tout le tableau (colonnes et cartes) ?")) return;
    setBoard(emptyBoard());
  };

  const exportBackup = () => {
    downloadKanbanBackup(board, theme);
  };

  const openImportPicker = () => {
    importInputRef.current?.click();
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseKanbanBackup(text);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      if (
        !window.confirm(
          "Remplacer le tableau et éventuellement le thème par le contenu de ce fichier ?",
        )
      ) {
        return;
      }
      setBoard(result.board);
      if (result.theme) setTheme(result.theme);
      setNewCardTitles({});
      setColumnModal(null);
      setDragCardId(null);
      setDraggingColumnId(null);
    } catch {
      window.alert("Impossible de lire ce fichier.");
    }
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

  const shell = "min-h-dvh flex flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100";
  const headerBar =
    "border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/50";
  const muted = "text-slate-500 dark:text-slate-400";
  const btnGhost =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const btnDangerGhost = btnGhost;

  return (
    <div className={shell}>
      <header className={`${headerBar} px-4 py-3 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            📋
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Mon Kanban</h1>
            <p className={`text-xs ${muted}`}>
              Colonnes et couleurs personnalisées · données locales
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={onImportFile}
          />
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-300 p-2 text-lg leading-none hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={openCreateColumn}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/80"
          >
            + Colonne
          </button>
          <button
            type="button"
            onClick={exportBackup}
            className={btnGhost}
            title="Télécharger une sauvegarde JSON (tableau + thème)"
          >
            Exporter
          </button>
          <button
            type="button"
            onClick={openImportPicker}
            className={btnGhost}
            title="Restaurer depuis un fichier JSON exporté précédemment"
          >
            Importer
          </button>
          <button type="button" onClick={resetAll} className={btnDangerGhost}>
            Réinitialiser
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-4">
        {board.columns.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-slate-700 mb-2 dark:text-slate-300">Aucune colonne pour l’instant.</p>
            <p className={`text-sm mb-6 ${muted}`}>
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
              const isDraggingCol = draggingColumnId === col.id;
              return (
                <section
                  key={col.id}
                  className={`w-72 shrink-0 flex flex-col rounded-xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/20 transition-opacity ${
                    isDraggingCol ? "opacity-50" : ""
                  }`}
                  style={{
                    borderTopWidth: "4px",
                    borderTopColor: col.color,
                  }}
                  onDragOver={onColumnDragOver}
                  onDrop={(e) => onColumnDrop(e, col.id)}
                >
                  <div className="flex items-start justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onColumnHandleDragStart(e, col.id)}
                        onDragEnd={onColumnHandleDragEnd}
                        className="shrink-0 cursor-grab active:cursor-grabbing rounded px-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Glisser pour réordonner les colonnes"
                        aria-label={`Réordonner la colonne ${col.title}`}
                      >
                        <span className="text-xs select-none" aria-hidden>
                          ⋮⋮
                        </span>
                      </button>
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
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        onClick={() => openEditColumn(col)}
                        aria-label={`Modifier ${col.title}`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-300"
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
                        className={`rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-300 transition dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:border-slate-600 ${
                          dragCardId === card.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-1 items-start">
                          <input
                            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                            value={card.title}
                            onChange={(e) => updateCard(card.id, { title: e.target.value })}
                            aria-label="Titre de la carte"
                          />
                          <button
                            type="button"
                            className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 text-xs px-1"
                            onClick={() => deleteCard(card.id)}
                            aria-label="Supprimer la carte"
                          >
                            ×
                          </button>
                        </div>
                        <textarea
                          className="mt-1 w-full resize-none bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-0 min-h-[2.5rem] dark:text-slate-400 dark:placeholder:text-slate-600"
                          placeholder="Note…"
                          rows={2}
                          value={card.body}
                          onChange={(e) => updateCard(card.id, { body: e.target.value })}
                        />
                      </article>
                    ))}
                  </div>

                  <div className="p-2 border-t border-slate-200 dark:border-slate-800/80">
                    <div className="flex gap-1">
                      <input
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-600"
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
                        className="rounded-md border border-slate-200 bg-slate-100 px-2 text-sm hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="column-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeColumnModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="column-dialog-title" className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
              {columnModal.mode === "create" ? "Nouvelle colonne" : "Modifier la colonne"}
            </h2>
            <div className="space-y-4">
              <label className="block text-sm text-slate-600 dark:text-slate-400">
                Titre
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  autoFocus
                />
              </label>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Couleur</p>
                <div className="grid grid-cols-5 gap-2" role="listbox" aria-label="Choisir une couleur">
                  {COLUMN_COLOR_PALETTE.map((hex) => {
                    const selected = draft.color.toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        title={hex}
                        className={`h-9 w-full rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                          selected
                            ? "border-slate-900 ring-2 ring-offset-2 ring-indigo-500 dark:border-white dark:ring-offset-slate-900"
                            : "border-white/30 dark:border-slate-600 hover:scale-105"
                        }`}
                        style={{ backgroundColor: hex }}
                        onClick={() => setDraft((d) => ({ ...d, color: hex }))}
                      />
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Emoji</p>
                <div
                  className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/50"
                  role="listbox"
                  aria-label="Choisir un emoji"
                >
                  {EMOJI_PICKER.map((emo) => {
                    const selected = draft.emoji === emo;
                    return (
                      <button
                        key={emo}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`flex h-10 items-center justify-center rounded-lg text-xl transition hover:bg-slate-200 dark:hover:bg-slate-800 ${
                          selected ? "bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-950/80" : ""
                        }`}
                        onClick={() => setDraft((d) => ({ ...d, emoji: emo }))}
                      >
                        <span aria-hidden>{emo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
