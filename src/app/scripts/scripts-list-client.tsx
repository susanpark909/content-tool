"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { createJournalEntry, deleteIdea, updateJournalContent } from "@/app/idea/actions";
import { stageOf, type Idea } from "@/app/idea/idea-table";
import { cn } from "@/lib/utils";
import { useRememberedState } from "@/lib/use-remembered-state";
import { createBoardColumn, deleteBoardColumn, renameBoardColumn, reorderBoardColumns, setIdeaBoardColumn, type BoardColumn } from "./actions";

const GOAL_META: Record<"views" | "comments" | "shares", { label: string; icon: string }> = {
  views: { label: "Views", icon: "visibility" },
  comments: { label: "Comments", icon: "chat_bubble" },
  shares: { label: "Shares", icon: "send" },
};

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

type MenuItem = { label: string; icon: string; onClick: () => void; danger?: boolean; heading?: boolean };

// A small "..." menu. Used on every board card, every list row and every board column.
function DotsMenu({ items, label, className }: { items: MenuItem[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cn("relative flex-none", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="flex size-7 items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
      >
        <MaterialIcon name="more_horiz" size={20} />
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          />
          <span className="absolute top-8 right-0 z-40 flex min-w-[170px] flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
            {items.map((it, i) =>
              it.heading ? (
                <span key={i} className="px-3 pt-2 pb-1 text-[10.5px] font-extrabold tracking-wide text-[#9a9a98] uppercase">
                  {it.label}
                </span>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    it.onClick();
                  }}
                  className={cn("flex items-center gap-2 px-3 py-2 text-left text-[13px] font-bold hover:bg-[#F6F6F5]", it.danger ? "text-[#D10A6E]" : "text-[#0D0D0D]")}
                >
                  <MaterialIcon name={it.icon} size={16} /> {it.label}
                </button>
              ),
            )}
          </span>
        </>
      )}
    </span>
  );
}

// Add a new idea, or edit the words of an existing one.
function IdeaDialog({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[560px] flex-col gap-3 rounded-2xl border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-center justify-between">
          <span className="text-[22px] font-extrabold tracking-[-0.01em]">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your idea…"
          rows={6}
          className="w-full resize-none rounded-lg border border-[#E4E4E2] p-3 text-[15px] leading-[1.55] font-medium outline-none focus:border-[#0D0D0D]"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D]">
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => onSave(text)}
            className="h-10 rounded-lg bg-[#FF1F8F] px-5 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScriptsListClient({ initial, initialColumns }: { initial: Idea[]; initialColumns: BoardColumn[] }) {
  const [ideas, setIdeas] = useState(initial);
  const [columns, setColumns] = useState(initialColumns);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; id: string; text: string } | null>(null);
  const [filter, setFilter] = useRememberedState<"all" | Stage>("vh-scripts-filter", "all");
  const [view, setView] = useRememberedState<"list" | "board">("vh-scripts-view", "list");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const rows = useMemo(
    () =>
      ideas
        .map((i) => ({ idea: i, stage: stageOf(i) as Stage, script: [i.body, i.cta].filter((t) => t.trim()).join("\n\n") }))
        .sort((a, b) => (b.idea.createdAt > a.idea.createdAt ? 1 : -1)),
    [ideas],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, raw: 0, scripted: 0, sched: 0, posted: 0 };
    rows.forEach((r) => c[r.stage]++);
    return c;
  }, [rows]);
  const [sort, setSort] = useRememberedState<{ key: "created" | "idea" | "status" | "sched" | "posted"; dir: 1 | -1 }>("vh-scripts-sort", { key: "created", dir: -1 });
  const rank: Record<Stage, number> = { raw: 0, scripted: 1, sched: 2, posted: 3 };
  const shown = useMemo(() => {
    const base = filter === "all" ? rows : rows.filter((r) => r.stage === filter);
    const val = (r: (typeof rows)[number]) =>
      sort.key === "idea" ? r.idea.text.toLowerCase() : sort.key === "status" ? rank[r.stage] : sort.key === "sched" ? (r.idea.scheduledDate ?? "") : sort.key === "posted" ? (r.idea.postedAt ?? "") : r.idea.createdAt;
    return [...base].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (sort.key === "sched" || sort.key === "posted") {
        if (!x && y) return 1;
        if (x && !y) return -1;
      }
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, sort]);
  function head(key: "idea" | "status" | "sched" | "posted", label: string) {
    const on = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => setSort(on ? { key, dir: (sort.dir * -1) as 1 | -1 } : { key, dir: key === "idea" || key === "status" ? 1 : -1 })}
        className={cn("flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]", on && "text-[#0D0D0D]")}
      >
        <span>{label}</span>
        <span>{on ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  }
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
    () =>
      [...columns]
        .sort((a, b) => a.position - b.position)
        .map((c) => {
          const st = c.stageKey ? STAGES.find((s) => s.key === c.stageKey) : null;
          return st
            ? { id: c.id, label: c.name, stageKey: st.key as string, icon: st.icon, dot: st.dot, bg: st.bg, fg: st.fg, tint: st.tint }
            : { id: c.id, label: c.name, stageKey: null as string | null, icon: "view_column", dot: "#0D0D0D", bg: "#E8E8E6", fg: "#0D0D0D", tint: "#F4F4F3" };
        }),
    [columns],
  );

  function moveCard(id: string, col: { id: string; stageKey: string | null }) {
    const columnId = col.id;
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, boardColumnId: columnId } : i)));
    startTransition(async () => {
      await setIdeaBoardColumn(id, columnId);
    });
  }
  function reorder(ids: string[]) {
    setColumns((prev) => ids.map((id, i) => ({ ...prev.find((c) => c.id === id)!, position: i })));
    startTransition(async () => {
      await reorderBoardColumns(ids);
    });
  }
  function shiftCol(id: string, by: -1 | 1) {
    const ids = boardCols.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  }
  function dropColBefore(dragged: string, target: string) {
    if (dragged === target) return;
    const ids = boardCols.map((c) => c.id).filter((id) => id !== dragged);
    ids.splice(ids.indexOf(target), 0, dragged);
    reorder(ids);
  }
  function addCol() {
    const name = newColName.trim();
    setAddingCol(false);
    setNewColName("");
    if (!name) return;
    startTransition(async () => {
      const col = await createBoardColumn(name, columns.length);
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
  function deleteOne(id: string) {
    if (!window.confirm("Delete this idea and its script?")) return;
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await deleteIdea(id);
    });
  }
  function saveDialog(text: string) {
    const d = dialog;
    setDialog(null);
    if (!d || !text.trim()) return;
    if (d.mode === "edit") {
      setIdeas((prev) => prev.map((i) => (i.id === d.id ? { ...i, text: text.trim() } : i)));
      startTransition(async () => {
        await updateJournalContent(d.id, text);
      });
      return;
    }
    startTransition(async () => {
      const created = await createJournalEntry(text);
      if (!created) return;
      setIdeas((prev) => [
        {
          id: created.id,
          text: text.trim(),
          createdAt: created.createdAt,
          sourceReelId: null,
          attachments: [],
          scheduledDate: null,
          scheduledTimeMinutes: null,
          posted: false,
          postedAt: null,
          scripted: false,
          scriptId: null,
          hook: "",
          body: "",
          cta: "",
          scriptUpdatedAt: null,
          draft: false,
          boardColumnId: null,
          format: "reel",
          goal: null,
          inspirationReelId: null,
          inspiration: null,
        },
        ...prev,
      ]);
    });
  }
  const ideaMenu = (idea: Idea, withMove: boolean): MenuItem[] => [
    { label: "Rename", icon: "edit", onClick: () => setDialog({ mode: "edit", id: idea.id, text: idea.text }) },
    ...(withMove
      ? ([
          { label: "Move to", icon: "", heading: true, onClick: () => {} },
          ...boardCols.map((c) => ({ label: c.label, icon: "arrow_forward", onClick: () => moveCard(idea.id, c) })),
        ] as MenuItem[])
      : []),
    { label: "Delete", icon: "delete", danger: true, onClick: () => deleteOne(idea.id) },
  ];

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
          <button
            type="button"
            onClick={() => setDialog({ mode: "add" })}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
          >
            <MaterialIcon name="add" size={20} weight={500} /> <span className="max-md:hidden">Add</span> Idea
          </button>
          {view === "board" &&
            (addingCol ? (
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
                className="h-11 w-[170px] rounded-lg border border-[#0D0D0D] bg-white px-3 text-[14px] font-bold outline-none md:w-[200px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingCol(true)}
                className="flex h-11 items-center gap-1.5 rounded-lg border border-[#E4E4E2] bg-white px-4 text-[13.5px] font-extrabold hover:border-[#FF1F8F] hover:text-[#FF1F8F] max-md:hidden"
              >
                <MaterialIcon name="view_column" size={20} /> Add Column
              </button>
            ))}
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

      {/* tabs (big) */}
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
        <>
          <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:hidden">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_120px_100px_100px_90px_110px_110px_32px] items-center gap-5 border-b border-[#CFCFCD] px-4 py-3 text-xs font-bold text-[#4a4a48]">
                <input
                  type="checkbox"
                  checked={shown.length > 0 && shown.every((r) => checked.has(r.idea.id))}
                  onChange={(e) => setChecked(e.target.checked ? new Set(shown.map((r) => r.idea.id)) : new Set())}
                  className="size-4 cursor-pointer accent-[#FF1F8F]"
                />
                {head("idea", "Idea")}
                {head("status", "Status")}
                <span>Format</span>
                <span>Goal</span>
                <span>Narration</span>
                {head("sched", "Scheduled date")}
                {head("posted", "Posted date")}
                <span />
              </div>
              {shown.length === 0 && <div className="px-5 py-10 text-center text-sm font-medium text-[#4a4a48]">Nothing here yet.</div>}
              {shown.map(({ idea, stage, script }) => {
                const st = stageMeta(stage);
                const chip = "flex w-fit items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap";
                const date = "text-[13px] font-semibold whitespace-nowrap text-[#4a4a48]";
                return (
                  <div key={idea.id} className="grid grid-cols-[28px_minmax(0,1fr)_120px_100px_100px_90px_110px_110px_32px] items-center gap-5 border-b border-[#D9D9D7] px-4 py-[13px] last:border-b-0 hover:bg-[#F6F6F5]">
                    <input type="checkbox" checked={checked.has(idea.id)} onChange={() => toggle(idea.id)} className="size-4 cursor-pointer accent-[#FF1F8F]" />
                    <Link href={`/scripts/${idea.id}`} className="truncate text-[15px] font-medium" title={idea.text}>
                      {idea.text || "(no text)"}
                    </Link>
                    <span className="flex w-fit items-center gap-[7px] rounded-[12px] px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
                      <span className="size-[7px] rounded-full" style={{ background: st.dot }} />
                      {st.label.replace(/s$/, "")}
                    </span>
                    <span className={chip}>
                      <MaterialIcon name={idea.format === "carousel" ? "view_carousel" : "smart_display"} size={13} weight={500} />
                      {idea.format === "carousel" ? "Carousel" : "Reel"}
                    </span>
                    {idea.goal ? (
                      <span className={chip}>
                        <MaterialIcon name={GOAL_META[idea.goal].icon} size={13} weight={500} />
                        {GOAL_META[idea.goal].label}
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold text-[#9a9a98]">—</span>
                    )}
                    <span className={date}>{narration(script) ?? "—"}</span>
                    <span className={date}>{idea.scheduledDate ? fmtDate(idea.scheduledDate).toUpperCase() : "—"}</span>
                    <span className={date}>{idea.posted && idea.postedAt ? fmtDate(idea.postedAt).toUpperCase() : "—"}</span>
                    <DotsMenu label="Idea options" items={ideaMenu(idea, false)} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:hidden">
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
                  </Link>
                  <DotsMenu label="Idea options" items={ideaMenu(idea, false)} />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:overflow-x-auto md:pb-3">
          {boardCols.map((col, ci) => {
            const items = rows.filter((r) => (r.idea.boardColumnId ? r.idea.boardColumnId === col.id : col.stageKey === r.stage));
            const isOver = overCol === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  if (!dragId && !dragCol) return;
                  e.preventDefault();
                  setOverCol(col.id);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragCol) dropColBefore(dragCol, col.id);
                  else if (dragId) moveCard(dragId, col);
                  setDragId(null);
                  setDragCol(null);
                  setOverCol(null);
                }}
                className={cn("flex min-h-[260px] flex-col gap-3 rounded-2xl p-3 transition-shadow md:min-w-[230px] md:flex-1", dragCol === col.id && "opacity-50")}
                style={{ background: col.tint, boxShadow: isOver ? "inset 0 0 0 2px #FF1F8F" : undefined }}
              >
                <div
                  className="flex items-center gap-2 px-1 pt-0.5 md:cursor-grab"
                  draggable={editingCol !== col.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragCol(col.id);
                  }}
                  onDragEnd={() => {
                    setDragCol(null);
                    setOverCol(null);
                  }}
                >
                  <span className="flex size-8 flex-none items-center justify-center rounded-lg" style={{ background: col.bg, color: col.fg }}>
                    <MaterialIcon name={col.icon} size={18} />
                  </span>
                  {editingCol === col.id ? (
                    <input
                      autoFocus
                      defaultValue={col.label}
                      onBlur={(e) => renameCol(col.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingCol(null);
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-[#BDBDBB] bg-white px-2 text-[15px] font-extrabold outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.01em]">{col.label}</span>
                  )}
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold shadow-[0_1px_4px_rgba(13,13,13,0.08)]">{items.length}</span>
                  <DotsMenu
                    label="Column options"
                    items={[
                      { label: "Rename", icon: "edit", onClick: () => setEditingCol(col.id) },
                      ...(ci > 0 ? [{ label: "Move left", icon: "arrow_back", onClick: () => shiftCol(col.id, -1) }] : []),
                      ...(ci < boardCols.length - 1 ? [{ label: "Move right", icon: "arrow_forward", onClick: () => shiftCol(col.id, 1) }] : []),
                      ...(!col.stageKey ? [{ label: "Delete column", icon: "delete", danger: true, onClick: () => removeCol(col.id) }] : []),
                    ]}
                  />
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
                      "group relative flex flex-col gap-3 rounded-xl border border-[#F0F0F1] bg-white p-3.5 pr-10 pl-4 shadow-[0_4px_14px_rgba(13,13,13,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(13,13,13,0.14)]",
                      dragId === idea.id && "opacity-40",
                    )}
                  >
                    <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: col.dot }} />
                    <DotsMenu label="Idea options" items={ideaMenu(idea, true)} className="absolute top-2 right-2" />
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
        </div>
      )}

      {dialog && (
        <IdeaDialog
          title={dialog.mode === "add" ? "Add An Idea" : "Rename Idea"}
          initial={dialog.mode === "edit" ? dialog.text : ""}
          onSave={saveDialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
