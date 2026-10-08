"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { IdeaPanel } from "@/app/idea/idea-panel";
import { createIdeaOnDate } from "./actions";
import { stageOf, type Idea } from "@/app/idea/idea-table";
import { deleteIdea, saveScriptSections, setIdeaDraft, updateJournalContent } from "@/app/idea/actions";
import { AutoTextarea } from "@/components/auto-textarea";
import { DictateButton } from "@/components/dictate-button";
import { scheduleIdea } from "./actions";

const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_PER_DAY = 3;

type CalStatus = "new" | "scripted" | "posted";
const ST: Record<CalStatus, { label: string; bg: string; fg: string; dot: string }> = {
  new: { label: "Draft", bg: "#EFEFEE", fg: "#6b6b69", dot: "#6b6b69" },
  scripted: { label: "Scripted", bg: "#FFE3F0", fg: "#FF1F8F", dot: "#FF1F8F" },
  posted: { label: "Posted", bg: "#EAF8D8", fg: "#4CAF00", dot: "#4CAF00" },
};
const GL: Record<string, [string, string]> = {
  views: ["Views", "visibility"],
  comments: ["Comments", "chat_bubble"],
  shares: ["Shares", "send"],
};

function calStatus(idea: Idea): CalStatus {
  if (idea.posted) return "posted";
  if (idea.draft) return "new";
  if (idea.hook.trim() || idea.body.trim() || idea.cta.trim()) return "scripted";
  return "new";
}

function iso(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseIso(s: string) {
  return new Date(s + "T12:00:00");
}
function fmtTime(minutes: number | null) {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function short(d: Date) {
  return MON[d.getMonth()].slice(0, 3) + " " + d.getDate();
}
function todayIso() {
  const d = new Date();
  return iso(d);
}

type View = "month" | "week" | "list";

export function CalendarView({ initial }: { initial: Idea[] }) {
  const today = todayIso();
  const [ideas, setIdeas] = useState(initial);
  const [y, setY] = useState(parseIso(today).getFullYear());
  const [m, setM] = useState(parseIso(today).getMonth());
  const [view, setView] = useState<View>("month");
  const [sel, setSel] = useState(today);
  const [hover, setHover] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftStartId, setDraftStartId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  }

  function patch(id: string, p: Partial<Idea>) {
    setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function goTo(key: string) {
    const d = parseIso(key);
    setSel(key);
    setY(d.getFullYear());
    setM(d.getMonth());
  }

  function shift(n: number) {
    if (view === "week") {
      const d = parseIso(sel);
      d.setDate(d.getDate() + 7 * n);
      goTo(iso(d));
      return;
    }
    const d = new Date(y, m + n, 1);
    const t = parseIso(today);
    setY(d.getFullYear());
    setM(d.getMonth());
    setSel(t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() ? today : iso(d));
  }

  function moveTo(id: string, date: string) {
    const idea = ideas.find((x) => x.id === id);
    if (!idea || idea.scheduledDate === date) return;
    patch(id, { scheduledDate: date });
    startTransition(async () => {
      const scheduledTimeMinutes = await scheduleIdea(id, date);
      patch(id, { scheduledTimeMinutes });
    });
    flash("Moved to " + short(parseIso(date)));
  }

  function dropProps(key: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        if (dropOn !== key) setDropOn(key);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        let id = dragId;
        if (!id) {
          try {
            id = e.dataTransfer.getData("text/plain") || null;
          } catch {}
        }
        setDragId(null);
        setDropOn(null);
        if (id) moveTo(id, key);
      },
    };
  }

  const byDate = useMemo(() => {
    const map: Record<string, Idea[]> = {};
    for (const p of ideas) {
      if (!p.scheduledDate) continue;
      (map[p.scheduledDate] ??= []).push(p);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => (a.scheduledTimeMinutes ?? 0) - (b.scheduledTimeMinutes ?? 0));
    }
    return map;
  }, [ideas]);

  const lead = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((lead + dim) / 7);
  const cells = useMemo(() => {
    const out: { key: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(y, m, 1 - lead + i);
      out.push({ key: iso(d), day: d.getDate(), inMonth: d.getMonth() === m });
    }
    return out;
  }, [y, m, lead, weeks]);

  const ws = parseIso(sel);
  ws.setDate(ws.getDate() - ws.getDay());
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);
  const week = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return { key: iso(d), dow: DOW[d.getDay()].slice(0, 3), day: d.getDate() };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const monthPosts = useMemo(
    () =>
      ideas
        .filter((p) => p.scheduledDate && parseIso(p.scheduledDate).getMonth() === m && parseIso(p.scheduledDate).getFullYear() === y)
        .sort((a, b) =>
          a.scheduledDate! < b.scheduledDate!
            ? -1
            : a.scheduledDate! > b.scheduledDate!
              ? 1
              : (a.scheduledTimeMinutes ?? 0) - (b.scheduledTimeMinutes ?? 0),
        ),
    [ideas, m, y],
  );

  // Coming back from Reel Detail: reopen the idea you were writing.
  useEffect(() => {
    try {
      const id = sessionStorage.getItem("vh-reopen-idea");
      if (id) {
        sessionStorage.removeItem("vh-reopen-idea");
        if (initial.some((i) => i.id === id)) setOpenId(id);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openIdea = openId ? ideas.find((x) => x.id === openId) ?? null : null;
  const previewIdea = previewId ? ideas.find((x) => x.id === previewId) ?? null : null;

  function saveScript(id: string, next: { hook: string; body: string; cta: string }) {
    const idea = ideas.find((x) => x.id === id);
    // Writing a script never changes the status by itself: an idea that is still a
    // Draft stays a Draft until you pick Scripted yourself.
    const keepDraft = !!idea && !idea.posted && !idea.draft && calStatus(idea) === "new";
    patch(id, keepDraft ? { ...next, draft: true } : next);
    startTransition(async () => {
      const sid = await saveScriptSections(id, idea?.scriptId ?? null, next);
      if (sid && sid !== idea?.scriptId) patch(id, { scriptId: sid });
      if (keepDraft) await setIdeaDraft(id, true);
    });
  }

  function unschedule(id: string) {
    // stays on the card so you can pick a new date right away
    patch(id, { scheduledDate: null, scheduledTimeMinutes: null });
    startTransition(async () => {
      await scheduleIdea(id, null);
    });
    flash("Unscheduled. Pick a new date any time.");
  }

  // Add Post (any view): a new draft on that day, opened straight in
  // the full editor so the title/script can be filled in.
  function addPost(date: string) {
    if (adding) return;
    setAdding(true);
    flash("Adding post…");
    createIdeaOnDate("New post", date)
      .then((res) => {
        if (!res) return;
        setIdeas((prev) => [
          ...prev,
          {
            id: res.id,
            text: "New post",
            createdAt: new Date().toISOString(),
            sourceReelId: null,
            attachments: [],
            scheduledDate: date,
            scheduledTimeMinutes: res.scheduledTimeMinutes ?? null,
            posted: false,
            postedAt: null,
            scripted: false,
            scriptId: null,
            hook: "",
            body: "",
            cta: "",
            scriptUpdatedAt: null,
            draft: false,
            format: "reel",
            goal: null,
            inspirationReelId: null,
            inspiration: null,
          },
        ]);
        setDraftStartId(res.id);
        setOpenId(res.id);
      })
      .catch(() => flash("Couldn't add the post."))
      .finally(() => setAdding(false));
  }

  // Add Post opens a small chooser: write a brand new post, or pull one in from Ideas.
  const [addDate, setAddDate] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [pickQuery, setPickQuery] = useState("");
  function requestAdd(date: string) {
    setPickQuery("");
    setAddDate(date);
  }
  function scheduleExisting(id: string, date: string) {
    setAddDate(null);
    patch(id, { scheduledDate: date });
    startTransition(async () => {
      const scheduledTimeMinutes = await scheduleIdea(id, date);
      patch(id, { scheduledTimeMinutes });
    });
    flash("Added to " + short(parseIso(date)));
  }

  function handleDeleted(id: string) {
    setIdeas((prev) => prev.filter((x) => x.id !== id));
    setOpenId(null);
    setPreviewId(null);
  }

  const atToday = sel === today && y === parseIso(today).getFullYear() && m === parseIso(today).getMonth();
  const rangeLabel = view === "week" ? `${short(ws)} – ${short(we)}, ${we.getFullYear()}` : `${MON[m]} ${y}`;

  function chipStyle(id: string, on: boolean) {
    return {
      opacity: dragId === id ? 0.4 : 1,
      transform: on ? "translateY(-3px)" : "none",
      boxShadow: on ? "0 14px 28px rgba(13,13,13,.18)" : "0 2px 8px rgba(13,13,13,.07)",
      borderColor: on ? "#BDBDBB" : "#F0F0F1",
    };
  }

  function renderChip(idea: Idea) {
    const st = ST[calStatus(idea)];
    const on = previewId === idea.id;
    return (
      <div
        key={idea.id}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          try {
            e.dataTransfer.setData("text/plain", idea.id);
            e.dataTransfer.effectAllowed = "move";
          } catch {}
          // after the browser has picked the chip up, not during
          setTimeout(() => setDragId(idea.id), 0);
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropOn(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setPreviewId(idea.id);
        }}
        style={chipStyle(idea.id, on)}
        className="group relative flex min-w-0 cursor-grab flex-col gap-1 rounded-md border bg-white px-1.5 py-1 transition-transform hover:shadow-[0_8px_20px_rgba(13,13,13,0.12)]"
      >
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            unschedule(idea.id);
          }}
          title="Remove from calendar (stays in Ideas)"
          aria-label="Remove from calendar"
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border border-[#E4E4E2] bg-white text-[#4a4a48] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-[#0D0D0D] hover:text-white max-md:hidden"
        >
          <MaterialIcon name="close" size={13} />
        </button>
        <span className="truncate pr-4 text-xs font-semibold">{idea.text || "(no text)"}</span>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            className="flex flex-none items-center gap-1 rounded-lg px-1.5 py-px text-[10.5px] font-bold"
            style={{ background: st.bg, color: st.fg }}
          >
            <span className="size-[5px] rounded-full" style={{ background: st.dot }} />
            {st.label}
          </span>
          <span className="flex-none text-[10.5px] font-semibold text-[#4a4a48]">{fmtTime(idea.scheduledTimeMinutes)}</span>
        </div>
      </div>
    );
  }

  const dayPanel = (
            <div className="flex flex-col gap-2 border-t border-[#F0F0F1] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold">
                  {DOW[parseIso(sel).getDay()]}, {short(parseIso(sel))}
                  {sel === today ? " · Today" : ""}
                </span>
                <AddPostButton onClick={() => requestAdd(sel)} visible alwaysSubtle />
              </div>
              {(byDate[sel] ?? []).length === 0 && (
                <span className="text-[13px] font-medium text-[#4a4a48]">Nothing planned for this day.</span>
              )}
              {(byDate[sel] ?? []).map((p) => {
                const st = ST[calStatus(p)];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreviewId(p.id)}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-[#F0F0F1] bg-white p-2.5 text-left shadow-[0_2px_8px_rgba(13,13,13,.07)]"
                  >
                    <span className="line-clamp-2 text-[13.5px] leading-[1.3] font-semibold">{p.text || "(no text)"}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="flex items-center gap-1 rounded-[10px] px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                      <span className="text-[11.5px] font-semibold text-[#4a4a48]">{fmtTime(p.scheduledTimeMinutes)}</span>
                      <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-1.5 py-0.5 text-[11px] font-bold">
                        <MaterialIcon name={p.format === "carousel" ? "view_carousel" : "smart_display"} size={12} weight={500} />
                        Format: {p.format === "carousel" ? "Carousel" : "Reel"}
                      </span>
                      {p.goal && (
                        <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-1.5 py-0.5 text-[11px] font-bold">
                          <MaterialIcon name={GL[p.goal][1]} size={12} weight={500} />
                          Goal: {GL[p.goal][0]}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
  );

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Calendar
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
          Plan it. Move it. Post it.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5.5 py-4.5 max-md:gap-2.5 max-md:px-3.5 max-md:py-3">
          <div className="flex flex-wrap items-center gap-3.5 max-md:w-full max-md:flex-nowrap max-md:gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => shift(-1)}
                title="Previous"
                className="flex size-[38px] items-center justify-center rounded-md border border-[#E4E4E2] hover:border-[#0D0D0D] max-md:size-8"
              >
                <MaterialIcon name="chevron_left" size={22} />
              </button>
              <button
                type="button"
                onClick={() => shift(1)}
                title="Next"
                className="flex size-[38px] items-center justify-center rounded-md border border-[#E4E4E2] hover:border-[#0D0D0D] max-md:size-8"
              >
                <MaterialIcon name="chevron_right" size={22} />
              </button>
            </div>
            <span className="min-w-[230px] text-[20px] md:text-[26px] font-black tracking-[-0.02em] max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[18px]"><span className="max-md:hidden">{rangeLabel}</span><span className="md:hidden">{view === "week" ? `${short(ws)} – ${short(we)}` : rangeLabel}</span></span>
            <button
              type="button"
              onClick={() => goTo(today)}
              className={`flex h-[38px] items-center rounded-md border border-[#E4E4E2] px-3.5 text-[13px] font-bold hover:border-[#0D0D0D] max-md:h-8 max-md:px-3 ${atToday ? "max-md:hidden" : ""}`}
            >
              Today
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4.5 max-md:w-full max-md:flex-col max-md:items-stretch max-md:gap-2">
            <div className="flex gap-1 rounded-lg bg-[#F6F6F5] p-1">
              {(["month", "week", "list"] as View[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  className="flex h-[34px] items-center rounded-md border px-4.5 text-[13.5px] font-bold text-[#0D0D0D] transition-shadow max-md:h-8 max-md:flex-1 max-md:justify-center max-md:px-2"
                  style={{
                    background: view === k ? "#FFFFFF" : "transparent",
                    borderColor: view === k ? "#D9D9D7" : "transparent",
                    boxShadow: view === k ? "0 3px 10px rgba(13,13,13,.10)" : "none",
                  }}
                >
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 max-md:flex-nowrap">
              {(["new", "scripted", "posted"] as CalStatus[]).map((k) => (
                <span
                  key={k}
                  className="flex w-[104px] items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold whitespace-nowrap max-md:w-auto max-md:min-w-0 max-md:flex-1 max-md:justify-center"
                  style={{ background: ST[k].bg, color: ST[k].fg }}
                >
                  <span className="size-[7px] rounded-full" style={{ background: ST[k].dot }} />
                  {ST[k].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {view === "month" && (
          <>
          <div className="md:hidden">
            <div className="grid grid-cols-7 border-t border-[#F0F0F1] bg-[#FBFBFA]">
              {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
                <span key={i} className="py-2 text-center text-[11px] font-bold text-[#4a4a48]">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-[#F0F0F1]">
              {cells.map((c) => {
                const list = byDate[c.key] ?? [];
                const isSel = c.key === sel;
                const isToday = c.key === today;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSel(c.key)}
                    className="flex h-[52px] min-w-0 flex-col items-center gap-0.5 border-r border-b border-[#F0F0F1] pt-1"
                    style={{ background: c.inMonth ? "#FFFFFF" : "#FBFBFA", opacity: c.inMonth ? 1 : 0.55 }}
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[13px] font-extrabold [font-variant-numeric:tabular-nums]"
                      style={{
                        background: isSel ? "#C6FF3D" : "transparent",
                        boxShadow: isToday && !isSel ? "inset 0 0 0 1.5px #0D0D0D" : undefined,
                      }}
                    >
                      {c.day}
                    </span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {list.slice(0, 3).map((p) => (
                        <span key={p.id} className="size-1.5 rounded-full" style={{ background: ST[calStatus(p)].dot }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            {dayPanel}
          </div>
          <div className="overflow-x-auto max-md:hidden">
            <div className="min-w-[860px]">
            <div className="grid grid-cols-7 border-t border-[#F0F0F1] bg-[#FBFBFA]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                <span key={w} className="border-r border-[#F0F0F1] px-3 py-2.5 text-xs font-bold text-[#4a4a48]">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-[#F0F0F1]">
              {cells.map((c, i) => {
                const list = byDate[c.key] ?? [];
                const expanded = expandedDays.has(c.key);
                const show = !expanded && list.length > MAX_PER_DAY ? list.slice(0, MAX_PER_DAY - 1) : list;
                const isToday = c.key === today;
                const isSel = c.key === sel;
                const drop = dropOn === c.key && !!dragId;
                const lifted = drop || isSel;
                const isLastRow = i >= cells.length - 7;
                return (
                  <div
                    key={c.key}
                    onClick={() => setSel(c.key)}
                    onMouseEnter={() => setHover(c.key)}
                    onMouseLeave={() => setHover((h) => (h === c.key ? null : h))}
                    {...dropProps(c.key)}
                    className="flex min-h-[176px] min-w-0 cursor-pointer flex-col gap-1.5 border-r border-b border-[#F0F0F1] p-2 pb-2.5"
                    style={{
                      background: lifted ? "#FFFFFF" : !c.inMonth ? "#FBFBFA" : hover === c.key ? "#FBFBFA" : "#FFFFFF",
                      boxShadow: lifted
                        ? isLastRow
                          ? "0 -10px 18px rgba(13,13,13,.16), 6px 0 16px rgba(13,13,13,.10), -6px 0 16px rgba(13,13,13,.10)"
                          : "0 12px 32px rgba(13,13,13,.16)"
                        : "none",
                      borderTop: lifted ? "6px solid #0D0D0D" : undefined,
                      borderTopLeftRadius: lifted ? 8 : 0,
                      borderTopRightRadius: lifted ? 8 : 0,
                      borderBottomLeftRadius: lifted && !isLastRow ? 8 : 0,
                      borderBottomRightRadius: lifted && !isLastRow ? 8 : 0,
                      zIndex: lifted ? 2 : "auto",
                      opacity: c.inMonth ? 1 : 0.6,
                      position: "relative",
                    }}
                  >
                    <div className="flex h-7 flex-none items-center">
                      <span
                        className="flex size-7 items-center justify-center rounded-full text-[13.5px] font-extrabold [font-variant-numeric:tabular-nums]"
                        style={{
                          background: isSel ? "#C6FF3D" : "transparent",
                          color: isSel || isToday || c.inMonth ? "#0D0D0D" : "#9a9a98",
                        }}
                      >
                        {c.day}
                      </span>
                    </div>
                    {show.map((p) => (
                      renderChip(p)
                    ))}
                    {list.length > MAX_PER_DAY && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          });
                        }}
                        className="w-fit flex-none rounded px-2 py-0.5 text-xs font-extrabold hover:bg-[#F0F0F1]"
                      >
                        {expanded ? "Show less" : `+${list.length - show.length} more`}
                      </button>
                    )}
                    <AddPostButton onClick={() => requestAdd(c.key)} visible={isSel || hover === c.key} />
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          </>
        )}

        {view === "week" && (
          <>
          <div className="md:hidden">
            <div className="grid grid-cols-7 border-t border-[#F0F0F1]">
              {week.map((c) => {
                const list = byDate[c.key] ?? [];
                const isSel = c.key === sel;
                const isToday = c.key === today;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSel(c.key)}
                    className="flex h-[64px] min-w-0 flex-col items-center gap-0.5 border-r border-b border-[#F0F0F1] bg-white pt-1.5"
                  >
                    <span className="text-[11px] font-bold text-[#4a4a48]">{c.dow[0]}</span>
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[13px] font-extrabold [font-variant-numeric:tabular-nums]"
                      style={{
                        background: isSel ? "#C6FF3D" : "transparent",
                        boxShadow: isToday && !isSel ? "inset 0 0 0 1.5px #0D0D0D" : undefined,
                      }}
                    >
                      {c.day}
                    </span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {list.slice(0, 3).map((p) => (
                        <span key={p.id} className="size-1.5 rounded-full" style={{ background: ST[calStatus(p)].dot }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            {dayPanel}
          </div>
          <div className="overflow-x-auto max-md:hidden">
            <div className="grid min-w-[860px] grid-cols-7 border-t border-[#F0F0F1]">
            {week.map((c) => {
              const list = byDate[c.key] ?? [];
              const isSel = c.key === sel;
              const drop = dropOn === c.key && !!dragId;
              return (
                <div
                  key={c.key}
                  onClick={() => setSel(c.key)}
                  {...dropProps(c.key)}
                  className="relative flex min-h-[460px] min-w-0 cursor-pointer flex-col overflow-hidden border-r border-[#F0F0F1] bg-white"
                  style={{
                    boxShadow:
                      drop || isSel
                        ? "0 -10px 18px rgba(13,13,13,.16), 6px 0 16px rgba(13,13,13,.10), -6px 0 16px rgba(13,13,13,.10)"
                        : "none",
                    borderTopLeftRadius: drop || isSel ? 8 : 0,
                    borderTopRightRadius: drop || isSel ? 8 : 0,
                    borderTop: drop || isSel ? "6px solid #0D0D0D" : "6px solid transparent",
                    zIndex: drop || isSel ? 2 : "auto",
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b border-[#F0F0F1] px-3 py-2.5"
                    style={{ background: drop || isSel ? "#FFFFFF" : "#FBFBFA" }}
                  >
                    <span className="text-xs font-bold text-[#4a4a48]">{c.dow}</span>
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[13.5px] font-extrabold [font-variant-numeric:tabular-nums]"
                      style={{ background: isSel ? "#C6FF3D" : "transparent" }}
                    >
                      {c.day}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {list.map((p) => {
                      const st = ST[calStatus(p)];
                      const on = previewId === p.id;
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            try {
                              e.dataTransfer.setData("text/plain", p.id);
                              e.dataTransfer.effectAllowed = "move";
                            } catch {}
                            setTimeout(() => setDragId(p.id), 0);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDropOn(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewId(p.id);
                          }}
                          style={chipStyle(p.id, on)}
                          className="group relative flex cursor-grab flex-col gap-1.5 rounded-lg border bg-white p-2.5 hover:shadow-[0_8px_20px_rgba(13,13,13,0.12)]"
                        >
                          <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            unschedule(p.id);
          }}
          title="Remove from calendar (stays in Ideas)"
          aria-label="Remove from calendar"
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border border-[#E4E4E2] bg-white text-[#4a4a48] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-[#0D0D0D] hover:text-white max-md:hidden top-1.5 right-1.5"
        >
          <MaterialIcon name="close" size={13} />
        </button>
                          <span className="line-clamp-3 pr-4 text-[13px] leading-[1.35] font-semibold">{p.text || "(no text)"}</span>
                          <span className="text-[11.5px] font-semibold text-[#4a4a48]">{fmtTime(p.scheduledTimeMinutes)}</span>
                          <span
                            className="flex w-fit items-center gap-1.5 rounded-[10px] px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: st.bg, color: st.fg }}
                          >
                            <span className="size-1.5 rounded-full" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap">
                              <MaterialIcon name={p.format === "carousel" ? "view_carousel" : "smart_display"} size={13} weight={500} />
                              Format: {p.format === "carousel" ? "Carousel" : "Reel"}
                            </span>
                            {p.goal && (
                              <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap">
                                <MaterialIcon name={GL[p.goal][1]} size={13} weight={500} />
                                Goal: {GL[p.goal][0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <AddPostButton onClick={() => requestAdd(c.key)} visible alwaysSubtle />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          </>
        )}

        {view === "list" && (
          <div className="border-t border-[#F0F0F1]">
            <div className="grid grid-cols-[150px_80px_minmax(0,1fr)_110px_20px] gap-4 border-b border-[#F0F0F1] bg-[#FBFBFA] px-5.5 py-2.5 text-xs font-bold text-[#4a4a48] max-md:hidden">
              <span>Date</span>
              <span>Time</span>
              <span>Post</span>
              <span>Status</span>
              <span />
            </div>
            {monthPosts.length === 0 && (
              <div className="px-5.5 py-10 text-center text-sm font-medium text-[#4a4a48]">Nothing planned this month.</div>
            )}
            <div className="border-b border-[#F0F0F1] px-4 py-2">
              <AddPostButton onClick={() => requestAdd(sel)} visible alwaysSubtle />
            </div>
            {monthPosts.map((p) => {
              const st = ST[calStatus(p)];
              const d = parseIso(p.scheduledDate!);
              const isToday = p.scheduledDate === today;
              return (
                <div
                  key={p.id}
                  onClick={() => setPreviewId(p.id)}
                  className="grid cursor-pointer grid-cols-[150px_80px_minmax(0,1fr)_110px_20px] items-center gap-4 border-b border-[#F0F0F1] bg-white px-5.5 py-3.5 hover:bg-[#FBFBFA] max-md:flex max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-1 max-md:px-3.5 max-md:py-2.5"
                >
                  <span className="text-[13.5px] font-bold whitespace-nowrap text-[#0D0D0D]">
                    {DOW[d.getDay()].slice(0, 3)}, {short(d)}
                    {isToday ? " · Today" : ""}
                  </span>
                  <span className="text-[13px] font-semibold whitespace-nowrap text-[#4a4a48]">{fmtTime(p.scheduledTimeMinutes)}</span>
                  <span className="truncate text-[14.5px] font-semibold max-md:order-last max-md:basis-full max-md:text-[14px]">{p.text || "(no text)"}</span>
                  <span
                    className="flex w-[104px] items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold whitespace-nowrap max-md:ml-auto max-md:w-auto"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    <span className="size-[7px] rounded-full" style={{ background: st.dot }} />
                    {st.label}
                  </span>
                  <MaterialIcon name="chevron_right" size={20} className="text-[#4a4a48] max-md:hidden" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewIdea && (
        <PreviewCard
          idea={previewIdea}
          onClose={() => setPreviewId(null)}
          onOpen={() => {
            setOpenId(previewIdea.id);
            setPreviewId(null);
          }}
          onSaveScript={(next) => saveScript(previewIdea.id, next)}
          onUnschedule={() => unschedule(previewIdea.id)}
          onSchedule={(date) => moveTo(previewIdea.id, date)}
          onSaveText={(text) => {
            patch(previewIdea.id, { text });
            startTransition(async () => {
              await updateJournalContent(previewIdea.id, text);
            });
          }}
          onDelete={() => {
            const gone = previewIdea;
            handleDeleted(gone.id);
            flash("Post deleted");
            deleteIdea(gone.id).catch(() => {
              setIdeas((prev) => [...prev, gone]);
              flash("Couldn't delete the post.");
            });
          }}
        />
      )}

      {openIdea && (
        <IdeaPanel
          idea={openIdea}
          startAsDraft={openIdea.id === draftStartId}
          onClose={() => setOpenId(null)}
          onUpdate={(patchVal) => patch(openIdea.id, patchVal)}
          onDeleted={() => handleDeleted(openIdea.id)}
        />
      )}

      {addDate && (
        <div
          onClick={() => setAddDate(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.28)] p-6 backdrop-blur-[6px] max-md:p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[14px] border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <span className="text-xl font-extrabold tracking-[-0.01em]">Add Post · {short(parseIso(addDate))}</span>
              <button
                type="button"
                onClick={() => setAddDate(null)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1]"
              >
                <MaterialIcon name="close" size={20} />
              </button>
            </div>
            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={() => {
                  const d = addDate;
                  setAddDate(null);
                  addPost(d);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#FF1F8F] text-[14px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
              >
                <MaterialIcon name="edit_square" size={18} weight={500} />
                Write A New Post
              </button>
            </div>
            <div className="flex items-center gap-3 px-5 pb-2 text-xs font-bold text-[#4a4a48]">
              <span className="h-px flex-1 bg-[#F0F0F1]" />
              Or Pull In From Ideas
              <span className="h-px flex-1 bg-[#F0F0F1]" />
            </div>
            <div className="px-5 pb-2">
              <input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Search your ideas…"
                autoComplete="off"
                className="h-10 w-full rounded-md border border-[#E4E4E2] px-3 text-sm font-medium outline-none focus:border-[#0D0D0D]"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-[#F0F0F1] pb-2">
              {(() => {
                const q = pickQuery.trim().toLowerCase();
                const list = ideas
                  .filter((i) => !i.scheduledDate && !i.posted)
                  .filter((i) => !q || i.text.toLowerCase().includes(q))
                  .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
                if (list.length === 0)
                  return (
                    <span className="px-5 py-6 text-sm font-semibold text-[#4a4a48]">
                      {q ? "No ideas match." : "No unscheduled ideas. Everything is already on the calendar or posted."}
                    </span>
                  );
                return list.map((i) => {
                  const st = ST[calStatus(i)];
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => scheduleExisting(i.id, addDate)}
                      className="flex items-center gap-3 px-5 py-2.5 text-left hover:bg-[#F6F6F5]"
                    >
                      <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-[1.3] font-semibold">{i.text || "(no text)"}</span>
                      <span
                        className="flex flex-none items-center gap-1 rounded-[10px] px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-md bg-[#0D0D0D] px-4.5 py-3 text-sm font-bold text-[#FBFBFA]">
          <span className="size-2 rounded-full bg-[#C6FF3D]" />
          {toast}
        </div>
      )}
    </PageShell>
  );
}

function AddPostButton({
  onClick,
  visible,
  alwaysSubtle,
}: {
  onClick: () => void;
  visible: boolean;
  alwaysSubtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="mt-auto flex h-8 w-fit flex-none items-center gap-1 rounded-md px-2 text-[12.5px] font-bold text-[#4a4a48] transition-opacity hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible || alwaysSubtle ? "auto" : "none" }}
    >
      <MaterialIcon name="add" size={16} weight={500} />
      Add post
    </button>
  );
}

function PreviewCard({
  idea,
  onClose,
  onOpen,
  onSaveScript,
  onSaveText,
  onUnschedule,
  onSchedule,
  onDelete,
}: {
  idea: Idea;
  onClose: () => void;
  onOpen: () => void;
  onSaveScript: (next: { hook: string; body: string; cta: string }) => void;
  onSaveText: (text: string) => void;
  onUnschedule: () => void;
  onSchedule: (date: string) => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef<string | null>(null);
  useEffect(() => {
    handledRef.current = idea.scheduledDate ?? "";
    const el = dateRef.current;
    if (!el) return;
    const apply = () => {
      const v = el.value || "";
      if (v === handledRef.current) return;
      handledRef.current = v;
      if (v) onSchedule(v);
      else onUnschedule();
    };
    el.addEventListener("change", apply);
    el.addEventListener("input", apply);
    el.addEventListener("blur", apply);
    return () => {
      el.removeEventListener("change", apply);
      el.removeEventListener("input", apply);
      el.removeEventListener("blur", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea.scheduledDate, idea.posted]);
  const st = ST[calStatus(idea)];
  const d = idea.scheduledDate ? parseIso(idea.scheduledDate) : null;
  // Same as the script writer on the Ideas page: an Idea box and one Script box
  // (an older separate hook / CTA is folded into the Script box).
  const merged = [idea.hook, idea.body, idea.cta].filter((t) => t.trim()).join("\n\n");
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState(idea.text);
  const [script, setScript] = useState(merged);

  useEffect(() => {
    if (idea.hook.trim() || idea.cta.trim()) onSaveScript({ hook: "", body: merged, cta: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveScriptNow = (value: string) => onSaveScript({ hook: "", body: value, cta: "" });
  const joinSpoken = (a: string, b: string) => (a.trim() ? a.replace(/\s+$/, "") + " " + b : b);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const sec = Math.round((wordCount / 220) * 60);
  const narration = wordCount === 0 ? "0 words" : `${wordCount} words  •  ~${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} to narrate`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[45] flex items-center justify-center bg-[rgba(13,13,13,0.28)] p-8 backdrop-blur-[10px] max-md:p-3"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[820px] flex-col overflow-hidden rounded-[14px] border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]"
      >
        <div className="flex items-start gap-4 border-b border-[#F0F0F1] px-7 py-6 pl-7 max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-2 max-md:px-4 max-md:py-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-3 max-md:order-2 max-md:basis-full max-md:gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              <span
                className="flex w-[104px] items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                style={{ background: st.bg, color: st.fg }}
              >
                <span className="size-[7px] rounded-full" style={{ background: st.dot }} />
                {st.label}
              </span>
              {idea.goal && (
                <span className="flex items-center gap-1.5 rounded-xl bg-[#FFF0F7] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#D10A6E]">
                  <MaterialIcon name={GL[idea.goal][1]} size={14} weight={500} />
                  Goal: {GL[idea.goal][0]}
                </span>
              )}
            </div>
            <span className="text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-pretty max-md:text-[19px] max-md:leading-[1.25]">{idea.text || "(no text)"}</span>
            <div className="flex flex-wrap items-center gap-4 text-[13.5px] font-medium text-[#4a4a48] max-md:gap-x-3.5 max-md:gap-y-1 max-md:text-[12.5px]">
              {idea.posted ? (
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <MaterialIcon name="calendar_today" size={18} className="text-[#0D0D0D]" />
                  {d ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "Not scheduled"}
                </span>
              ) : (
                <span className="relative flex cursor-pointer items-center gap-1.5 rounded-md bg-[#F0F0F1] py-1 pr-1.5 pl-2 whitespace-nowrap text-[#0D0D0D] hover:bg-[#E4E4E2]">
                  <MaterialIcon name="calendar_today" size={18} />
                  {d ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "Pick a date"}
                  <MaterialIcon name="expand_more" size={18} className="text-[#4a4a48]" />
                  <input
                    ref={dateRef}
                    type="date"
                    defaultValue={idea.scheduledDate ?? ""}
                    key={idea.scheduledDate ?? "none"}
                    onClick={() => {
                      try {
                        dateRef.current?.showPicker?.();
                      } catch {}
                    }}
                    aria-label="Scheduled date"
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </span>
              )}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <MaterialIcon name="schedule" size={18} className="text-[#0D0D0D]" />
                {fmtTime(idea.scheduledTimeMinutes) || "—"}
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
                </svg>
                Instagram ({idea.format === "carousel" ? "Carousel" : "Reel"})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="flex h-9 flex-none items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[13px] font-bold whitespace-nowrap hover:bg-[#F0F0F1] max-md:order-1 max-md:mr-auto max-md:h-8"
          >
            <MaterialIcon name="open_in_full" size={17} />
            Open &amp; Edit
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex size-9 flex-none items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D] max-md:order-1 max-md:size-8"
          >
            <MaterialIcon name="close" size={22} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-7 py-6 max-md:gap-4 max-md:px-4 max-md:py-4">
          <div className="flex flex-col gap-2.5">
            <span className="text-[15px] font-extrabold">Idea</span>
            <div className="relative rounded-[10px] border border-[#F0F0F1] bg-[#FBFBFA] px-4.5 py-3.5">
              <AutoTextarea
                value={text}
                onChange={setText}
                onBlur={() => text !== idea.text && onSaveText(text)}
                minRows={2}
                className="w-full resize-none border-0 bg-transparent text-sm leading-[1.55] text-[#0D0D0D] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-[15px] font-extrabold">Script</span>
            <div className="relative rounded-[10px] border border-[#F0F0F1] bg-[#FBFBFA] px-4.5 py-4">
              <AutoTextarea
                value={script}
                onChange={setScript}
                onBlur={() => saveScriptNow(script)}
                minRows={9}
                placeholder="Free write here. Don't worry about structure yet."
                className="w-full resize-none border-0 bg-transparent pb-9 text-sm leading-[1.65] text-[#0D0D0D] outline-none"
              />
              <DictateButton
                className="absolute right-2 bottom-2"
                onText={(t) => {
                  const next = joinSpoken(script, t);
                  setScript(next);
                  saveScriptNow(next);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#4a4a48]">{narration}</span>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(script);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {}
                }}
                className="flex h-8 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#0D0D0D]"
              >
                <MaterialIcon name={copied ? "check" : "content_copy"} size={15} />
                {copied ? "Copied" : "Copy Script"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#F0F0F1] px-6 py-4 max-md:px-4 max-md:py-3">
          {confirmingDelete ? (
            <div className="flex w-full items-center gap-2.5 max-md:flex-col max-md:items-stretch">
              <span className="mr-auto text-[13.5px] font-extrabold text-[#0D0D0D] max-md:mr-0 max-md:text-center">
                Delete this post? This can&apos;t be undone.
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex h-10 flex-1 items-center justify-center rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:bg-[#F0F0F1] md:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#D10A6E] px-4 text-[13.5px] font-extrabold whitespace-nowrap text-white hover:bg-[#0D0D0D] md:flex-none"
                >
                  <MaterialIcon name="delete" size={17} />
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex h-10 items-center gap-1.5 rounded-md border border-[#FFC2E0] bg-[#FFF0F7] px-3.5 text-[13.5px] font-extrabold text-[#D10A6E] hover:bg-[#FFE3F0] max-md:mr-auto"
              >
                <MaterialIcon name="delete" size={18} />
                Delete
              </button>
              <span className="mr-auto flex items-center gap-1.5 text-[12.5px] font-medium text-[#6b6b69] max-md:hidden">
                <MaterialIcon name="cloud_done" size={16} />
                Changes save automatically
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 items-center rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:bg-[#F0F0F1]"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
