"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { deleteIdea } from "@/app/idea/actions";
import { stageOf, type Idea } from "@/app/idea/idea-table";
import { cn } from "@/lib/utils";
import { createBoardColumn, deleteBoardColumn, renameBoardColumn, setIdeaBoardColumn, type BoardColumn } from "./actions";

type Stage = "raw" | "scripted" | "sched" | "posted";
const STAGES: { key: Stage; label: string; icon: string; dot: string; bg: string; fg: string; tint: string }[] = [
  { key: "raw", label: "Drafts", icon: "edit_note", dot: "#6B6B69", bg: "#EFEFEE", fg: "#6B6B69", tint: "#F4F4F3" },
  { key: "scripted", label: "Scripted", icon: "description", dot: "#FF1F8F", bg: "#FFE3F0", fg: "#FF1F8F", tint: "#FFF3F9" },
  { key: "sched", label: "Scheduled", icon: "event", dot: "#2F6BFF", bg: "#E3ECFF", fg: "#2F6BFF", tint: "#F1F5FF" },
  { key: "posted", label: "Posted", icon: "check_circle", dot: "#4CAF00", bg: "#EAF8D8", fg: "#4CAF00", tint: "#F5FBEC" },
];

function narration(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (!words) return null;
  const sec = Math.round((words / 220) * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function fmtDate(value: string) {
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ScriptsListClient({ initial, initialColumns }: { initial: Idea[]; initialColumns: BoardColumn[] }) {
  const [ideas, setIdeas] = useState(initial);
  const [columns, setColumns] = useState(initialColumns);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [filter, setFilter] = useState<"all" | Stage>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const rows = useMemo(
    () =>
      ideas
        .map((i) => ({ idea: i, stage: stageOf(i) as Stage, script: [i.hook, i.body, i.cta].filter((t) => t.trim()).join("\n\n") }))
        .sort((a, b) => (b.idea.createdAt > a.idea.createdAt ? 1 : -1)),
    [ideas],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, raw: 0, scripted: 0, sched: 0, posted: 0 };
    rows.forEach((r) => c[r.stage]++);
    return c;
  }, [rows]);
  const shown = filter === "all" ? rows : rows.filter((r) => r.stage === filter);
  const stageMeta = (k: Stage) => STAGES.find((s) => s.key === k)!;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const boardCols = useMemo(
    () => [
      ...STAGES.map((s) => ({ key: s.key as string, label: s.label, icon: s.icon, dot: s.dot, bg: s.bg, fg: s.fg, tint: s.tint, custom: false })),
      ...columns.map((c) => ({ key: c.id, label: c.name, icon: "view_column", dot: "#0D0D0D", bg: "#E8E8E6", fg: "#0D0D0D", tint: "#F4F4F3", custom: true })),
    ],
    [columns],
  );
  function moveCard(id: string, columnId: string | null) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, boardColumnId: columnId } : i)));
    startTransition(async () => {
      await setIdeaBoardColumn(id, columnId);
    });
  }
  function addCol() {
    const name = newColName.trim();
    setAddingCol(false);
    setNewColName("");
    if (!name) return;
    startTransition(async () => {
      const col = await createBoardColumn(name, columns.length + 1);
      setColumns((prev) => [...prev, col]);
    });
  }
  function renameCol(id: string, name: string) {
    setEditingCol(null);
    const next = name.trim();
    if (!next) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name: next } : c)));
    startTransition(async () => {
      await renameBoardColumn(id, next);
    });
  }
  function removeCol(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setIdeas((prev) => prev.map((i) => (i.boardColumnId === id ? { ...i, boardColumnId: null } : i)));
    startTransition(async () => {
      await deleteBoardColumn(id);
    });
  }
  function deleteChecked() {
    const ids = [...checked];
    setIdeas((prev) => prev.filter((i) => !checked.has(i.id)));
    setChecked(new Set());
    startTransition(async () => {
      await Promise.all(ids.map((id) => deleteIdea(id)));
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-[22px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
            Scripts
            <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
          </h1>
          <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Every idea you capture lands here. Open one to write it.</p>
        </div>
        <div className="flex flex-none gap-2">
          {checked.size > 0 && (
            <button
              type="button"
              onClick={deleteChecked}
              className="flex h-11 items-center gap-1.5 rounded-lg border border-[#FFC2E0] bg-[#FFF0F7] px-4 text-[13.5px] font-extrabold text-[#D10A6E]"
            >
              <MaterialIcon name="delete" size={18} /> Delete {checked.size}
            </button>
          )}
          <div className="flex h-11 overflow-hidden rounded-lg border border-[#E4E4E2] bg-white">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                title={v === "list" ? "List view" : "Board view"}
                aria-label={v === "list" ? "List view" : "Board view"}
                className="flex w-12 items-center justify-center hover:text-[#FF1F8F]"
                style={{ background: view === v ? "#F0F0F1" : undefined }}
              >
                <MaterialIcon name={v === "list" ? "view_list" : "view_kanban"} size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* tabs (big) + view toggle */}
      <div className={view === "list" ? "flex flex-wrap items-center gap-3" : "hidden"}>
        {view === "list" && (
        <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-[#F0F0F1] bg-white p-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] [scrollbar-width:none]">
          {[{ key: "all" as const, label: "All", icon: "layers" }, ...STAGES.map((s) => ({ key: s.key, label: s.label, icon: s.icon }))].map((t) => {
            const on = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className="flex h-11 flex-none items-center gap-2 rounded-lg px-5 text-[15px] font-bold whitespace-nowrap hover:bg-[#F6F6F5] max-md:px-4 max-md:text-[14px]"
                style={{ background: on ? "#F0F0F1" : undefined }}
              >
                <MaterialIcon name={t.icon} size={20} className={on ? "text-[#FF1F8F]" : "text-[#4a4a48]"} />
                {t.label}
                <span className="rounded-full bg-white/70 px-2 text-[12.5px] font-bold text-[#4a4a48]" style={{ background: on ? "#FFFFFF" : "#F0F0F1" }}>
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {view === "list" ? (
        <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          {shown.length === 0 && <div className="px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">Nothing here yet.</div>}
          {shown.map(({ idea, stage, script }) => {
            const st = stageMeta(stage);
            return (
              <div key={idea.id} className="flex items-center gap-3 border-b border-[#F0F0F1] px-4 py-3.5 last:border-b-0 hover:bg-[#FBFBFA] md:px-5">
                <input
                  type="checkbox"
                  checked={checked.has(idea.id)}
                  onChange={() => toggle(idea.id)}
                  className="size-4 flex-none cursor-pointer accent-[#FF1F8F]"
                />
                <Link href={`/scripts/${idea.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-[1.35] font-semibold md:text-[15.5px]">{idea.text || "(no text)"}</span>
                  <span
                    className="flex flex-none items-center gap-1.5 rounded-[12px] px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    <span className="size-[7px] rounded-full" style={{ background: st.dot }} />
                    {stage === "sched" && idea.scheduledDate ? fmtDate(idea.scheduledDate) : st.label.replace(/s$/, "")}
                  </span>
                  <span className="w-12 flex-none text-right text-[12.5px] font-semibold text-[#4a4a48] max-md:hidden">{narration(script) ?? ""}</span>
                  <MaterialIcon name="chevron_right" size={20} className="flex-none text-[#9a9a98]" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:overflow-x-auto md:pb-3">
          {boardCols.map((col) => {
            const items = rows.filter((r) => (col.custom ? r.idea.boardColumnId === col.key : !r.idea.boardColumnId && r.stage === col.key));
            const isOver = overCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverCol(col.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveCard(dragId, col.custom ? col.key : null);
                  setDragId(null);
                  setOverCol(null);
                }}
                className="flex min-h-[260px] flex-col gap-3 rounded-2xl p-3 transition-shadow md:w-[calc(25%-12px)] md:min-w-[250px] md:flex-none"
                style={{ background: col.tint, boxShadow: isOver ? "inset 0 0 0 2px #FF1F8F" : undefined }}
              >
                <div className="flex items-center gap-2 px-1 pt-0.5">
                  <span className="flex size-8 flex-none items-center justify-center rounded-lg" style={{ background: col.bg, color: col.fg }}>
                    <MaterialIcon name={col.icon} size={18} />
                  </span>
                  {editingCol === col.key ? (
                    <input
                      autoFocus
                      defaultValue={col.label}
                      onBlur={(e) => renameCol(col.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingCol(null);
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-[#BDBDBB] bg-white px-2 text-[15px] font-extrabold outline-none"
                    />
                  ) : (
                    <span
                      className={cn("min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.01em]", col.custom && "cursor-text")}
                      onClick={() => col.custom && setEditingCol(col.key)}
                      title={col.custom ? "Click to rename" : undefined}
                    >
                      {col.label}
                    </span>
                  )}
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold shadow-[0_1px_4px_rgba(13,13,13,0.08)]">{items.length}</span>
                  {col.custom && (
                    <button type="button" onClick={() => removeCol(col.key)} title="Delete column" aria-label="Delete column" className="flex size-7 flex-none items-center justify-center rounded-md text-[#6b6b69] hover:bg-white hover:text-[#D10A6E]">
                      <MaterialIcon name="delete" size={16} />
                    </button>
                  )}
                </div>
                {items.map(({ idea, script }) => (
                  <Link
                    key={idea.id}
                    href={`/scripts/${idea.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(idea.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[#F0F0F1] bg-white p-3.5 pl-4 shadow-[0_4px_14px_rgba(13,13,13,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(13,13,13,0.14)]",
                      dragId === idea.id && "opacity-40",
                    )}
                  >
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: col.dot }} />
                    <span className="line-clamp-3 text-[14px] leading-[1.35] font-bold">{idea.text || "(no text)"}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold">
                      <span className="flex items-center gap-1 rounded-lg bg-[#F0F0F1] px-2 py-0.5">
                        <MaterialIcon name={idea.format === "carousel" ? "view_carousel" : "smart_display"} size={13} />
                        {idea.format === "carousel" ? "Carousel" : "Reel"}
                      </span>
                      {narration(script) && (
                        <span className="flex items-center gap-1 rounded-lg bg-[#F0F0F1] px-2 py-0.5">
                          <MaterialIcon name="schedule" size={13} />
                          {narration(script)}
                        </span>
                      )}
                      {idea.scheduledDate && (
                        <span className="flex items-center gap-1 rounded-lg px-2 py-0.5" style={{ background: col.bg, color: col.fg }}>
                          <MaterialIcon name="event" size={13} />
                          {fmtDate(idea.scheduledDate)}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D4D4D2] py-8 text-center text-xs font-semibold text-[#9a9a98]">
                    <MaterialIcon name={col.icon} size={22} />
                    Nothing here yet
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex-none md:w-[250px]">
            {addingCol ? (
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onBlur={addCol}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCol();
                  if (e.key === "Escape") {
                    setAddingCol(false);
                    setNewColName("");
                  }
                }}
                placeholder="Column name…"
                className="h-12 w-full rounded-xl border border-[#BDBDBB] bg-white px-3.5 text-[14px] font-bold outline-none focus:border-[#0D0D0D]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingCol(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#BDBDBB] text-[14px] font-bold text-[#4a4a48] hover:border-[#FF1F8F] hover:text-[#FF1F8F]"
              >
                <MaterialIcon name="add" size={20} /> Add Column
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
