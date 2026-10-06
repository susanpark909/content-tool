"use client";

import { useMemo, useState, useTransition } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { IdeaPanel } from "@/app/idea/idea-panel";
import { createIdeaOnDate } from "./actions";
import { stageOf, type Idea } from "@/app/idea/idea-table";
import { deleteIdea, saveScriptSections } from "@/app/idea/actions";
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
        const id = dragId;
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

  const openIdea = openId ? ideas.find((x) => x.id === openId) ?? null : null;
  const previewIdea = previewId ? ideas.find((x) => x.id === previewId) ?? null : null;

  function saveScript(id: string, next: { hook: string; body: string; cta: string }) {
    const idea = ideas.find((x) => x.id === id);
    patch(id, next);
    startTransition(async () => {
      const sid = await saveScriptSections(id, idea?.scriptId ?? null, next);
      if (sid && sid !== idea?.scriptId) patch(id, { scriptId: sid });
    });
  }

  function unschedule(id: string) {
    patch(id, { scheduledDate: null, scheduledTimeMinutes: null });
    setOpenId(null);
    setPreviewId(null);
    startTransition(async () => {
      await scheduleIdea(id, null);
    });
    flash("Removed from calendar. It's still in Ideas.");
  }

  // Add Post (any view): a new draft on that day, opened straight in
  // the full editor so the title/script can be filled in.
  function addPost(date: string) {
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
            format: "reel",
            goal: null,
            inspirationReelId: null,
            inspiration: null,
          },
        ]);
        setDraftStartId(res.id);
        setOpenId(res.id);
      })
      .catch(() => flash("Couldn't add the post."));
  }

  function handleDeleted(id: string) {
    setIdeas((prev) => prev.filter((x) => x.id !== id));
    setOpenId(null);
    setPreviewId(null);
  }

  const rangeLabel = view === "week" ? `${short(ws)} – ${short(we)}, ${we.getFullYear()}` : `${MON[m]} ${y}`;

  function chipStyle(id: string, on: boolean) {
    return {
      opacity: dragId === id ? 0.4 : 1,
      transform: on ? "translateY(-3px)" : "none",
      boxShadow: on ? "0 14px 28px rgba(13,13,13,.18)" : "0 2px 8px rgba(13,13,13,.07)",
      borderColor: on ? "#BDBDBB" : "#F0F0F1",
    };
  }

  function Chip({ idea }: { idea: Idea }) {
    const st = ST[calStatus(idea)];
    const on = previewId === idea.id;
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          try {
            e.dataTransfer.setData("text/plain", idea.id);
          } catch {}
          setDragId(idea.id);
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
        className="flex min-w-0 cursor-grab flex-col gap-1 rounded-md border bg-white px-1.5 py-1 transition-transform hover:shadow-[0_8px_20px_rgba(13,13,13,0.12)]"
      >
        <span className="truncate text-xs font-semibold">{idea.text || "(no text)"}</span>
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
            <span className="min-w-[230px] text-[20px] md:text-[26px] font-black tracking-[-0.02em] max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[18px]">{rangeLabel}</span>
            <button
              type="button"
              onClick={() => goTo(today)}
              className="flex h-[38px] items-center rounded-md border border-[#E4E4E2] px-3.5 text-[13px] font-bold hover:border-[#0D0D0D] max-md:h-8 max-md:px-3"
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
            <div className="flex flex-col gap-2 border-t border-[#F0F0F1] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold">
                  {DOW[parseIso(sel).getDay()]}, {short(parseIso(sel))}
                  {sel === today ? " · Today" : ""}
                </span>
                <AddPostButton onClick={() => addPost(sel)} visible alwaysSubtle />
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
                        {p.format === "carousel" ? "Carousel" : "Reel"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
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
                const show = list.length > MAX_PER_DAY ? list.slice(0, MAX_PER_DAY - 1) : list;
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
                      <Chip key={p.id} idea={p} />
                    ))}
                    {list.length > show.length && (
                      <span className="flex-none pl-2 text-xs font-extrabold">+{list.length - show.length} more</span>
                    )}
                    <AddPostButton onClick={() => addPost(c.key)} visible={isSel || hover === c.key} />
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          </>
        )}

        {view === "week" && (
          <div className="overflow-x-auto">
            <div className="grid min-w-[860px] grid-cols-7 border-t border-[#F0F0F1] max-md:min-w-0 max-md:grid-cols-1">
            {week.map((c) => {
              const list = byDate[c.key] ?? [];
              const isSel = c.key === sel;
              const drop = dropOn === c.key && !!dragId;
              return (
                <div
                  key={c.key}
                  onClick={() => setSel(c.key)}
                  {...dropProps(c.key)}
                  className="relative flex min-h-[460px] min-w-0 cursor-pointer flex-col overflow-hidden border-r border-[#F0F0F1] bg-white max-md:min-h-0 max-md:border-r-0 max-md:border-b"
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
                            setDragId(p.id);
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
                          className="flex cursor-grab flex-col gap-1.5 rounded-lg border bg-white p-2.5 hover:shadow-[0_8px_20px_rgba(13,13,13,0.12)]"
                        >
                          <span className="line-clamp-3 text-[13px] leading-[1.35] font-semibold">{p.text || "(no text)"}</span>
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
                              {p.format === "carousel" ? "Carousel" : "Reel"}
                            </span>
                            {p.goal && (
                              <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap">
                                <MaterialIcon name={GL[p.goal][1]} size={13} weight={500} />
                                {GL[p.goal][0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <AddPostButton onClick={() => addPost(c.key)} visible alwaysSubtle />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
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
              <AddPostButton onClick={() => addPost(sel)} visible alwaysSubtle />
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
          onDelete={() =>
            deleteIdea(previewIdea.id)
              .then(() => handleDeleted(previewIdea.id))
              .catch(() => flash("Couldn't delete the post."))
          }
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
  onDelete,
}: {
  idea: Idea;
  onClose: () => void;
  onOpen: () => void;
  onSaveScript: (next: { hook: string; body: string; cta: string }) => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const st = ST[calStatus(idea)];
  const d = idea.scheduledDate ? parseIso(idea.scheduledDate) : null;
  const [hook, setHook] = useState(idea.hook);
  const [body, setBody] = useState(idea.body);
  const [cta, setCta] = useState(idea.cta);
  const [full, setFull] = useState([idea.hook, idea.body, idea.cta].filter((t) => t.trim()).join("\n\n"));

  function saveSections(next: { hook: string; body: string; cta: string }) {
    setFull([next.hook, next.body, next.cta].filter((t) => t.trim()).join("\n\n"));
    onSaveScript(next);
  }

  function onFullBlur() {
    const parts = full.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const nextHook = parts[0] || "";
    const nextCta = parts.length > 2 ? parts[parts.length - 1] : "";
    const nextBody = parts.slice(1, parts.length > 2 ? -1 : undefined).join("\n\n");
    setHook(nextHook);
    setBody(nextBody);
    setCta(nextCta);
    onSaveScript({ hook: nextHook, body: nextBody, cta: nextCta });
  }

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
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <MaterialIcon name="calendar_today" size={18} className="text-[#0D0D0D]" />
                {d ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "Not scheduled"}
              </span>
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
            <span className="text-[15px] font-extrabold">Content Breakdown</span>
            <div className="flex flex-col gap-3 rounded-[10px] border border-[#F0F0F1] bg-[#FBFBFA] px-4.5 py-4">
              {(
                [
                  ["Hook", hook, setHook, "Write the hook…"],
                  ["Body", body, setBody, "Write the body…"],
                  ["CTA", cta, setCta, "Write the call to action…"],
                ] as const
              ).map(([label, value, setter, placeholder]) => (
                <div key={label} className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-3 text-sm leading-[1.55]">
                  <span className="font-extrabold">{label}</span>
                  <textarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    onBlur={() => saveSections({ hook: label === "Hook" ? value : hook, body: label === "Body" ? value : body, cta: label === "CTA" ? value : cta })}
                    placeholder={placeholder}
                    rows={1}
                    className="min-h-6 w-full resize-none border-0 bg-transparent text-sm leading-[1.55] text-[#0D0D0D] outline-none"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-[15px] font-extrabold">Full Script</span>
            <div className="rounded-[10px] border border-[#F0F0F1] bg-[#FBFBFA] px-4.5 py-4">
              <textarea
                value={full}
                onChange={(e) => setFull(e.target.value)}
                onBlur={onFullBlur}
                placeholder="Write the full script…"
                className="min-h-[120px] w-full resize-none border-0 bg-transparent text-sm leading-[1.65] text-[#0D0D0D] outline-none"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#F0F0F1] px-6 py-4 max-md:px-4 max-md:py-3">
          {confirmingDelete ? (
            <>
              <span className="mr-auto text-[13px] font-extrabold text-[#0D0D0D]">Delete this post?</span>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-10 items-center gap-1.5 rounded-md bg-[#D10A6E] px-3.5 text-[13.5px] font-extrabold text-white hover:bg-[#0D0D0D]"
              >
                <MaterialIcon name="delete" size={17} />
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex h-10 items-center rounded-md border border-[#E4E4E2] px-3.5 text-[13.5px] font-bold text-[#0D0D0D] hover:bg-[#F0F0F1]"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex h-10 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-bold text-[#D10A6E] hover:bg-[#FFE8F4] max-md:mr-auto max-md:-ml-1"
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
