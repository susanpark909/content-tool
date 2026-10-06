"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { DictateButton } from "@/components/dictate-button";
import { uploadJournalAttachment } from "@/lib/journal-upload";
import {
  addAttachmentsToEntry,
  deleteIdea,
  getSavedScriptsForInspiration,
  removeAttachment,
  saveScriptSections,
  scheduleIdea,
  setIdeaFormat,
  setIdeaGoal,
  setIdeaInspiration,
  setIdeaPosted,
  setIdeaDraft,
  updateJournalContent,
  type SavedScriptOption,
} from "./actions";
import { queueBrandProfileNote } from "@/app/settings/actions";
import type { Idea } from "./idea-table";

const TEXT_FIELD_CLASS = "w-full resize-none border-0 bg-transparent text-[15px] leading-[1.6] text-[#0D0D0D] outline-none";

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

function fmtDuration(seconds: number | null) {
  if (seconds == null) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function fmtLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(minutes: number | null) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const STATUS_CHIP: Record<string, { label: string; dot: string; bg: string; fg: string }> = {
  raw: { label: "Draft", dot: "#6B6B69", bg: "#EFEFEE", fg: "#6B6B69" },
  scripted: { label: "Scripted", dot: "#FF1F8F", bg: "#FFE3F0", fg: "#FF1F8F" },
  sched: { label: "Scheduled", dot: "#2F6BFF", bg: "#E3ECFF", fg: "#2F6BFF" },
  posted: { label: "Posted", dot: "#4CAF00", bg: "#EAF8D8", fg: "#4CAF00" },
};

const FORMATS: { key: "reel" | "carousel"; label: string; icon: string }[] = [
  { key: "reel", label: "Reel", icon: "smart_display" },
  { key: "carousel", label: "Carousel", icon: "view_carousel" },
];

const GOALS: { key: "views" | "comments" | "shares"; label: string; icon: string }[] = [
  { key: "views", label: "Views", icon: "visibility" },
  { key: "comments", label: "Comments", icon: "chat_bubble" },
  { key: "shares", label: "Shares", icon: "send" },
];

function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      {...rest}
      className={`rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] ${className}`}
    >
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 items-center justify-center gap-1.5 rounded-[13px] px-2 text-[11.5px] font-semibold whitespace-nowrap hover:shadow-[inset_0_0_0_1px_#0D0D0D] md:h-[26px] md:text-[12.5px]"
      style={{ background: active ? "#FF1F8F" : "#F0F0F1", color: "#0D0D0D" }}
    >
      <MaterialIcon name={icon} size={16} weight={500} />
      <span>{label}</span>
    </button>
  );
}

export function IdeaPanel({
  idea,
  onClose,
  onUpdate,
  onDeleted,
  startAsDraft,
}: {
  idea: Idea;
  onClose: () => void;
  onUpdate: (patch: Partial<Idea>) => void;
  onDeleted: () => void;
  // New posts from the calendar arrive with a date already set but should
  // read as Draft until the user picks/changes a date.
  startAsDraft?: boolean;
}) {
  const [draftHold, setDraftHold] = useState(!!startAsDraft);
  const [panelOpen, setPanelOpen] = useState(true);
  // On phones the keyboard covers the bottom of the screen. Track the part of
  // the screen that's actually visible so the editor can shrink to fit it.
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setVv(mq.matches ? { h: v.height, top: v.offsetTop } : null);
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, []);
  // Phone typing mode: while you're typing in a box, show only that box. This
  // keys off focus (not keyboard size) because browsers differ on how they
  // resize the page when the keyboard opens.
  const [focused, setFocused] = useState<string | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const keyboardOpen = isPhone && (focused !== null || (vv !== null && vv.h < window.innerHeight - 120));
  // Tapping a box keeps the same screen (no separate single-box view); the box just
  // scrolls into view above the keyboard. Kept as a switch in case it is wanted later.
  const focusMode = false;
  const secCls = (name: string, gap: string) =>
    `flex flex-col ${gap} ${
      focusMode
        ? focused === name
          ? "max-md:min-h-0 max-md:flex-1 max-md:[&>div]:flex-1 max-md:[&_textarea]:h-full"
          : "max-md:hidden"
        : ""
    }`;
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setPanelOpen(false);
  }, []);
  const [text, setText] = useState(idea.text);
  // One script box: an older separate hook / CTA is folded into the top and bottom of it.
  const mergedScript = [idea.hook, idea.body, idea.cta].filter((t) => t.trim()).join("\n\n");
  const [hook, setHook] = useState("");
  const [body, setBody] = useState(mergedScript);
  const [cta, setCta] = useState("");
  const [scriptId, setScriptId] = useState(idea.scriptId);
  const [scheduledDate, setScheduledDate] = useState(idea.scheduledDate ?? "");
  const [isPosted, setIsPosted] = useState(idea.posted);
  const [brandQueued, setBrandQueued] = useState(false);
  const [attachments, setAttachments] = useState(idea.attachments);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);


  function saveText() {
    if (text === idea.text) return;
    onUpdate({ text });
    startTransition(async () => {
      await updateJournalContent(idea.id, text);
    });
  }

  function saveScript(next: { hook: string; body: string; cta: string }) {
    startTransition(async () => {
      const id = await saveScriptSections(idea.id, scriptId, next);
      if (id && id !== scriptId) setScriptId(id);
      onUpdate(next);
    });
  }

  // Save writes everything and stays on this page. Close it yourself with the X.
  const [justSaved, setJustSaved] = useState(false);
  function handleSaveClick() {
    saveText();
    saveScript({ hook, body, cta });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  // Fold an older separate hook / CTA into the Script box once, so nothing is hidden.
  useEffect(() => {
    if (idea.hook.trim() || idea.cta.trim()) saveScript({ hook: "", body: mergedScript, cta: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSchedule(value: string) {
    setDraftHold(false);
    setScheduledDate(value);
    startTransition(async () => {
      const scheduledTimeMinutes = await scheduleIdea(idea.id, value || null);
      onUpdate({ scheduledDate: value || null, scheduledTimeMinutes });
    });
  }

  function togglePosted() {
    setDraftHold(false);
    const next = !isPosted;
    setIsPosted(next);
    startTransition(async () => {
      await setIdeaPosted(idea.id, next);
      if (next && idea.draft) await setIdeaDraft(idea.id, false);
      onUpdate({ posted: next, postedAt: next ? new Date().toISOString() : null, ...(next ? { draft: false } : {}) });
    });
  }

  // Draft / Scripted pills: there's no separate flag for either - they're
  // read off real content (hook/body/cta) - so clicking them takes the idea
  // off the calendar and off "posted" rather than faking a stage no content
  // backs up. The chip that lights up afterward reflects whatever's
  // actually true (has a script or not), same as the list/table status.
  function handleUnschedule(draft: boolean) {
    setScheduledDate("");
    setDraftHold(false);
    if (isPosted) setIsPosted(false);
    startTransition(async () => {
      await scheduleIdea(idea.id, null);
      if (isPosted) await setIdeaPosted(idea.id, false);
      await setIdeaDraft(idea.id, draft);
      onUpdate({ scheduledDate: null, scheduledTimeMinutes: null, posted: false, postedAt: null, draft });
    });
  }

  function handleSetScheduled() {
    setDraftHold(false);
    const date = scheduledDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    })();
    setScheduledDate(date);
    if (isPosted) setIsPosted(false);
    startTransition(async () => {
      const scheduledTimeMinutes = await scheduleIdea(idea.id, date);
      if (isPosted) await setIdeaPosted(idea.id, false);
      if (idea.draft) await setIdeaDraft(idea.id, false);
      onUpdate({ scheduledDate: date, scheduledTimeMinutes, posted: false, postedAt: null, draft: false });
    });
  }

  function handleFormat(format: "reel" | "carousel") {
    onUpdate({ format });
    startTransition(async () => {
      await setIdeaFormat(idea.id, format);
    });
  }

  function handleGoal(goal: "views" | "comments" | "shares") {
    const next = idea.goal === goal ? null : goal;
    onUpdate({ goal: next });
    startTransition(async () => {
      await setIdeaGoal(idea.id, next);
    });
  }

  function handleAddToBrand() {
    const full = [hook, body, cta].filter(Boolean).join("\n\n") || text;
    startTransition(async () => {
      await queueBrandProfileNote(full, idea.id);
      setBrandQueued(true);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map(uploadJournalAttachment));
      const rows = await addAttachmentsToEntry(idea.id, uploaded);
      const mapped = rows.map((r) => ({
        id: r.id,
        fileUrl: r.file_url,
        fileType: r.file_type,
        fileName: r.file_name,
      }));
      setAttachments((prev) => [...prev, ...mapped]);
      onUpdate({ attachments: [...attachments, ...mapped] });
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await removeAttachment(id);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteIdea(idea.id);
      onDeleted();
    });
  }

  // 220 wpm, not the generic "150 wpm conversational" figure the design
  // used - checked against 6 of Susan's own transcribed reels (duration vs.
  // real word count) and they land at 209-234 wpm, averaging ~219.
  const full = [hook, body, cta].filter((t) => t.trim()).join("\n\n");

  // Voice typing: words spoken into a box are added to its end and saved right
  // away (the latest values live in a ref so a chunk never overwrites newer text).
  const latest = useRef({ text, hook, body, cta, full });
  useEffect(() => {
    latest.current = { text, hook, body, cta, full };
  });
  const joinSpoken = (a: string, b: string) => (a.trim() ? a.replace(/\s+$/, "") + " " + b : b);

  function dictateIdea(t: string) {
    const next = joinSpoken(latest.current.text, t);
    latest.current = { ...latest.current, text: next };
    setText(next);
    onUpdate({ text: next });
    startTransition(async () => {
      await updateJournalContent(idea.id, next);
    });
  }

  function dictateSection(key: "hook" | "body" | "cta", t: string) {
    const cur = latest.current;
    const next = { hook: cur.hook, body: cur.body, cta: cur.cta };
    next[key] = joinSpoken(cur[key], t);
    latest.current = { ...cur, ...next };
    if (key === "hook") setHook(next.hook);
    if (key === "body") setBody(next.body);
    if (key === "cta") setCta(next.cta);
    saveScript(next);
  }

  // Narration time is based on the Script box only (not Idea, Hook or CTA).
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const seconds = Math.round((wordCount / 220) * 60);
  const wordsText =
    wordCount === 0
      ? "0 words"
      : `${wordCount} words  •  ~${seconds >= 60 ? Math.floor(seconds / 60) + " min " : ""}${seconds % 60} sec to narrate`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex box-border p-0 md:p-8"
      style={{
        background: "rgba(13,13,13,.28)",
        backdropFilter: "blur(10px)",
        ...(vv && focused !== null ? { top: vv.top, height: vv.h, bottom: "auto" } : {}),
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white md:rounded-[14px] shadow-[0_24px_72px_rgba(13,13,13,0.28)]"
      >
        <div className="flex flex-none flex-row-reverse items-center gap-1.5 border-b border-[#F0F0F1] px-2.5 py-1.5 md:contents">
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className={`absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-lg hover:bg-[#F0F0F1] max-md:static md:top-[18px] md:right-[18px] md:size-10 ${focusMode ? "max-md:hidden" : ""}`}
        >
          <MaterialIcon name="close" size={26} />
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Hide details panel" : "Show details panel"}
          className={`absolute top-2 right-12 z-10 flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-bold hover:bg-[#F0F0F1] max-md:static md:top-[18px] md:right-16 md:h-10 md:gap-1.5 md:px-3 md:text-[13px] ${focusMode ? "max-md:hidden" : ""}`}
        >
          <MaterialIcon name={panelOpen ? "right_panel_close" : "right_panel_open"} size={22} />
          <span className="md:hidden">{panelOpen ? "Script" : "Details"}</span>
          <span className="max-md:hidden">{panelOpen ? "Hide details" : "Show details"}</span>
        </button>

        {focusMode && (
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
            className="static z-20 flex h-8 items-center rounded-md bg-[#FF1F8F] px-4 text-[12.5px] font-extrabold text-[#0D0D0D] md:hidden"
          >
            Done
          </button>
        )}
          {panelOpen && (
            <button
              type="button"
              disabled={brandQueued}
              onClick={handleAddToBrand}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[#E4E4E2] px-2.5 text-[12.5px] font-bold hover:border-[#0D0D0D] disabled:opacity-80 md:hidden"
              style={{ background: brandQueued ? "#C6FF3D" : "#FBFBFA" }}
            >
              <MaterialIcon name={brandQueued ? "bookmark_added" : "bookmark"} size={16} />
              {brandQueued ? "Sent to Brand Profile" : "Add to Brand Profile"}
            </button>
          )}
        </div>

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 gap-3 p-2.5 pt-2 pb-2 ${focusMode ? "max-md:grid-rows-[minmax(0,1fr)]" : "max-md:auto-rows-max"} max-md:content-start max-md:overflow-y-auto md:[grid-template-columns:var(--cols)] md:gap-6 md:p-9 md:pb-4`}
          style={{ "--cols": panelOpen ? "minmax(0,1fr) 380px" : "minmax(0,1fr)" } as React.CSSProperties}
          onBlurCapture={() => setFocused(null)}
          onFocusCapture={(e) => {
            const t = e.target as HTMLElement;
            setFocused(t.closest("[data-field]")?.getAttribute("data-field") ?? null);
            if (window.matchMedia("(max-width: 767px)").matches && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
              setTimeout(() => t.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
            }
          }}
        >
          <div className={`flex min-h-0 flex-col gap-3 pr-1 md:overflow-y-auto ${panelOpen ? "max-md:hidden" : ""} ${focusMode ? "max-md:h-full" : ""}`}>
            <div data-field="idea" className={secCls("idea", "gap-3")}>
<span className="text-base font-extrabold tracking-[-0.01em]">Idea</span>
            <Card className="relative p-3.5 px-3.5 md:px-5">
              <AutoTextarea
                value={text}
                onChange={setText}
                onBlur={saveText}
                minRows={2}
                className={`${TEXT_FIELD_CLASS} pr-9`}
              />
              <DictateButton onText={dictateIdea} className="absolute top-2 right-2" />
            </Card>
</div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xl font-black tracking-[-0.02em]">Script</span>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(full);
                  } catch {}
                }}
                className="flex h-[34px] items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#0D0D0D]"
              >
                <MaterialIcon name="content_copy" size={16} />
                Copy
              </button>
            </div>

            <div data-field="body" className="flex flex-col gap-2">
              <Card className="relative flex px-3.5 py-3 md:px-5">
                <AutoTextarea
                  value={body}
                  onChange={setBody}
                  onBlur={() => saveScript({ hook, body, cta })}
                  minRows={9}
                  placeholder="Free write here. Don't worry about structure yet."
                  wrapperClassName="flex-1"
                  className={`${TEXT_FIELD_CLASS} pr-9`}
                />
                <DictateButton onText={(t) => dictateSection("body", t)} className="absolute top-2 right-2" />
              </Card>
            </div>

            <span className={`text-[13px] font-semibold text-[#4a4a48] ${focusMode ? "max-md:hidden" : ""}`}>{wordsText}</span>
          </div>

          {panelOpen && (
            <div className="mt-1 flex min-h-0 flex-col gap-2.5 pr-1 pl-1 md:mt-11 md:gap-2 md:overflow-y-auto">
              <SavedPostsCard
                idea={idea}
                onPick={(reelId, summary) => {
                  onUpdate({ inspirationReelId: reelId, inspiration: summary });
                  startTransition(async () => {
                    await setIdeaInspiration(idea.id, reelId);
                  });
                }}
              />

              <Card className="flex flex-col gap-1.5 px-3 py-2 md:px-4 md:py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold">Attachments</span>
                  <span className="rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11px] font-extrabold">
                    {attachments.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-2.5">
                  {attachments.map((a) => {
                    const isImg = a.fileType?.startsWith("image/");
                    return (
                      <div
                        key={a.id}
                        title={a.fileName ?? ""}
                        className="group relative size-7 flex-none overflow-visible rounded-md md:size-9"
                      >
                        <button
                          type="button"
                          onClick={() => isImg && setLightbox(a.fileUrl)}
                          className="block size-7 overflow-hidden rounded-md md:size-9"
                        >
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.fileUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center bg-[#FFD9EB] text-[11px] font-black tracking-[0.04em]">
                              {(a.fileName?.split(".").pop() || "").toUpperCase().slice(0, 4)}
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAttachment(a.id);
                          }}
                          title="Remove"
                          className="absolute -top-1.5 -right-1.5 hidden size-[18px] items-center justify-center rounded-full bg-[#0D0D0D] text-white group-hover:flex hover:bg-[#FF1F8F]"
                        >
                          <MaterialIcon name="close" size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <label className="flex size-7 flex-none cursor-pointer flex-col items-center justify-center gap-0 rounded-md border border-dashed md:size-9 border-[#CFCFCD] text-[11px] font-semibold text-[#4a4a48] hover:border-[#0D0D0D] hover:text-[#0D0D0D]">
                    <MaterialIcon name="add" size={20} className="max-md:text-[18px]!" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      disabled={isUploading}
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </Card>

              <div className="flex flex-col gap-2.5 md:gap-2">
                <Card className="flex flex-col gap-1.5 px-3 py-2 md:px-3.5 md:py-2.5">
                  <span className="text-[13px] font-bold">Status</span>
                  <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                    {(["raw", "scripted", "sched", "posted"] as const).map((k) => {
                      const simpleStage = isPosted
                        ? "posted"
                        : scheduledDate && !draftHold
                          ? "sched"
                          : idea.draft
                            ? "raw"
                            : hook.trim() || body.trim() || cta.trim()
                              ? "scripted"
                              : "raw";
                      const active = k === simpleStage;
                      const onClick =
                        k === "posted"
                          ? togglePosted
                          : k === "sched"
                            ? handleSetScheduled
                            : k === "raw"
                              ? () => handleUnschedule(true)
                              : () => handleUnschedule(false);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={onClick}
                          className="flex h-6 items-center justify-center gap-1.5 rounded-[16px] px-2 text-[11.5px] font-bold whitespace-nowrap hover:shadow-[inset_0_0_0_1px_#0D0D0D] md:h-[32px] md:gap-2 md:text-[12.5px]"
                          style={{ background: active ? "#FF1F8F" : "#F0F0F1", color: "#0D0D0D" }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ background: active ? "#E6FF00" : "transparent", border: "1.5px solid #0D0D0D" }}
                          />
                          {STATUS_CHIP[k].label}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card className="flex flex-col gap-1.5 px-3 py-2 md:px-3.5 md:py-2.5">
                  <span className="text-[13px] font-bold">Format</span>
                  <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                    {FORMATS.map((f) => (
                      <Pill
                        key={f.key}
                        active={idea.format === f.key}
                        onClick={() => handleFormat(f.key)}
                        icon={f.icon}
                        label={f.label}
                      />
                    ))}
                  </div>
                </Card>

                <Card className="flex flex-col gap-1.5 px-3 py-2 md:px-3.5 md:py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-bold">Goal</span>
                    <span className="text-xs font-semibold text-[#4a4a48]">What should this post do?</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                    {GOALS.map((g) => (
                      <Pill
                        key={g.key}
                        active={idea.goal === g.key}
                        onClick={() => handleGoal(g.key)}
                        icon={g.icon}
                        label={g.label}
                      />
                    ))}
                  </div>
                </Card>

                <Card className="flex flex-col gap-1.5 px-3 py-2 md:px-3.5 md:py-2.5">
                  <span className="text-[13px] font-bold">Schedule</span>
                  <div className="flex h-8 items-center gap-2 rounded-md border border-[#E4E4E2] pr-2 pl-2.5 md:h-[30px] md:gap-2.5 md:pl-3">
                    <label
                      className="relative flex h-full flex-1 cursor-pointer items-center gap-2 md:gap-2.5"
                      onClick={(e) => {
                        e.preventDefault();
                        dateInputRef.current?.showPicker?.();
                      }}
                    >
                      <MaterialIcon name="calendar_month" size={20} />
                      <span
                        className="text-[12px] font-semibold md:text-[13px]"
                        style={{ color: scheduledDate ? "#0D0D0D" : "#8a8a88" }}
                      >
                        {scheduledDate
                          ? fmtLong(scheduledDate) +
                            (fmtTime(idea.scheduledTimeMinutes) ? " · " + fmtTime(idea.scheduledTimeMinutes) : "")
                          : "Pick a date"}
                      </span>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => handleSchedule(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>
                    {scheduledDate && (
                      <button
                        type="button"
                        onClick={() => handleSchedule("")}
                        title="Clear date"
                        className="rounded p-1.5 text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
                      >
                        <MaterialIcon name="close" size={20} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={brandQueued}
                    onClick={handleAddToBrand}
                    className="flex h-7 items-center justify-center gap-2 rounded-md border border-[#F0F0F1] text-[11.5px] font-semibold hover:border-[#0D0D0D] disabled:opacity-70 max-md:hidden md:h-[30px] md:gap-2.5 md:text-[12.5px]"
                    style={{ background: brandQueued ? "#C6FF3D" : "#FBFBFA" }}
                  >
                    <MaterialIcon name={brandQueued ? "bookmark_added" : "bookmark"} size={20} className="max-md:text-[16px]!" />
                    {brandQueued ? "Sent to Brand Profile" : "Add to Brand Profile"}
                  </button>
                  <div className="mt-1 flex justify-between gap-3 border-t border-[#F0F0F1] pt-2.5 text-[11.5px] md:mt-0 md:pt-2 md:text-[12.5px]">
                    <span className="flex gap-1.5">
                      <span className="font-medium text-[#4a4a48]">Created</span>
                      <span className="font-semibold">{fmtLong(idea.createdAt)}</span>
                    </span>
                    <span className="flex gap-1.5">
                      <span className="font-medium text-[#4a4a48]">Updated</span>
                      <span className="font-semibold">
                        {idea.scriptUpdatedAt ? fmtLong(idea.scriptUpdatedAt) : fmtLong(idea.createdAt)}
                      </span>
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className={`mx-2.5 flex items-center justify-between gap-2 border-t border-[#F0F0F1] py-2 md:mx-9 md:gap-3 md:py-4`}>
          {confirmingDelete ? (
            <div className="flex items-center gap-2 max-md:w-full">
              <span className="text-sm font-semibold text-[#4a4a48] max-md:mr-auto max-md:text-[13px] max-md:font-extrabold max-md:whitespace-nowrap max-md:text-[#0D0D0D]">
                Delete this idea?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-[#D10A6E] px-3 py-1.5 text-sm font-bold text-white max-md:order-3 max-md:flex max-md:h-8 max-md:items-center max-md:gap-1 max-md:py-0 max-md:text-[12.5px] max-md:font-extrabold max-md:whitespace-nowrap"
              >
                <MaterialIcon name="delete" size={15} className="md:hidden" />
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 text-sm font-semibold text-[#4a4a48] hover:text-[#0D0D0D] max-md:order-2 max-md:flex max-md:h-8 max-md:items-center max-md:rounded-md max-md:border max-md:border-[#E4E4E2] max-md:bg-white max-md:py-0 max-md:text-[12.5px] max-md:font-bold max-md:text-[#0D0D0D]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="-ml-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-bold text-[#D10A6E] hover:bg-[#FFE8F4] md:gap-2 md:text-[14.5px]"
            >
              <MaterialIcon name="delete" size={20} className="max-md:text-[16px]!" />
              Delete<span className="max-md:hidden"> idea</span>
            </button>
          )}
          <div className={`flex gap-2 md:gap-3 ${confirmingDelete ? "max-md:hidden" : ""}`}>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center rounded-md border border-[#E4E4E2] bg-white px-3 text-[12.5px] font-bold hover:border-[#0D0D0D] md:h-12 md:px-8 md:text-[15px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[12.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] md:h-12 md:px-10 md:text-[15px]"
            >
              {justSaved ? (
                <>
                  <MaterialIcon name="check" size={16} />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-8"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            title="Close"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-lg text-white hover:bg-white/15"
          >
            <MaterialIcon name="close" size={26} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function SavedPostsCard({
  idea,
  onPick,
}: {
  idea: Idea;
  onPick: (reelId: string | null, summary: Idea["inspiration"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(!idea.inspiration);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SavedScriptOption[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && options === null) {
      startTransition(async () => {
        setOptions(await getSavedScriptsForInspiration());
      });
    }
  }, [open, options]);

  const pick = idea.inspiration;
  const filtered = (options ?? []).filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.hookText.toLowerCase().includes(q) || (o.ownerUsername ?? "").toLowerCase().includes(q);
  });

  return (
    <Card className="flex flex-none flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2.5 px-3 py-1.5 md:px-3.5 md:py-2.5"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <MaterialIcon name="library_books" size={18} />
          <span className="text-[13px] font-bold">Saved Posts</span>
          {pick && !picking && (
            <span className="truncate text-[11.5px] font-medium text-[#4a4a48]">
              {pick.ownerUsername ? `@${pick.ownerUsername}` : "—"} · {fmtN(pick.views ?? 0)} views
            </span>
          )}
        </div>
        <MaterialIcon name={open ? "expand_less" : "expand_more"} size={22} className="shrink-0 text-[#4a4a48]" />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-[#F0F0F1] px-3.5 pt-2.5 pb-3.5">
          {picking ? (
            <>
              <div className="flex h-10 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3">
                <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search saved scripts…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none"
                />
              </div>
              <div className="flex max-h-[220px] flex-col overflow-y-auto">
                {isPending && (
                  <span className="px-2 py-2.5 text-[13.5px] font-medium text-[#4a4a48]">Loading...</span>
                )}
                {!isPending &&
                  filtered.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        onPick(o.id, {
                          id: o.id,
                          hookText: o.hookText,
                          bodyText: o.bodyText,
                          ctaText: o.ctaText,
                          ownerUsername: o.ownerUsername,
                          views: o.views,
                          likes: o.likes,
                          commentsCount: o.commentsCount,
                          sharesCount: o.sharesCount,
                          repostsCount: o.repostsCount,
                          savesCount: o.savesCount,
                          durationSeconds: o.durationSeconds,
                        });
                        setPicking(false);
                      }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-md px-2 py-2.5 text-left hover:bg-[#F6F6F5]"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold">{o.hookText}</span>
                        <span className="text-xs font-medium text-[#6b6b69]">
                          {o.ownerUsername ? `@${o.ownerUsername}` : "—"}
                        </span>
                      </div>
                      <span className="text-[12.5px] font-bold whitespace-nowrap">{fmtN(o.views ?? 0)} views</span>
                    </button>
                  ))}
                {!isPending && filtered.length === 0 && (
                  <span className="px-2 py-2.5 text-[13.5px] font-medium text-[#4a4a48]">
                    No saved scripts match.
                  </span>
                )}
              </div>
            </>
          ) : (
            pick && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] md:grid md:grid-cols-3 md:gap-x-3 md:gap-y-1.5 md:text-[12.5px]">
                    {[
                      ["visibility", pick.views, "Views"],
                      ["favorite", pick.likes, "Likes"],
                      ["chat_bubble", pick.commentsCount, "Comments"],
                      ["send", pick.sharesCount, "Shares"],
                      ["repeat", pick.repostsCount, "Reposts"],
                      ["bookmark", pick.savesCount, "Saves"],
                    ].map(([icon, val, label]) =>
                      val != null ? (
                        <span key={label as string} className="flex items-center gap-1 font-bold whitespace-nowrap">
                          <MaterialIcon name={icon as string} size={15} />
                          {fmtN(val as number)}
                          <span className="font-medium text-[#6b6b69]">{label as string}</span>
                        </span>
                      ) : null,
                    )}
                    <span className="flex items-center gap-1 font-bold whitespace-nowrap">
                      <MaterialIcon name="schedule" size={15} />
                      {fmtDuration(pick.durationSeconds) || "—"}
                      <span className="font-medium text-[#6b6b69]">Length</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/analyze-reel/reel/${pick.id}`}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#BDBDBB]"
                    >
                      <MaterialIcon name="arrow_forward" size={16} />
                      Reel Detail
                    </a>
                    <button
                      type="button"
                      onClick={() => setPicking(true)}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#BDBDBB]"
                    >
                      <MaterialIcon name="swap_horiz" size={16} />
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => onPick(null, null)}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#BDBDBB]"
                    >
                      <MaterialIcon name="close" size={16} />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="max-h-[260px] overflow-y-auto rounded-md bg-[#FBFBFA] px-3.5 py-3 text-[13.5px] leading-[1.6] font-medium whitespace-pre-wrap">
                  {[pick.hookText, pick.bodyText, pick.ctaText].filter(Boolean).join("\n\n")}
                </div>
              </>
            )
          )}
        </div>
      )}
    </Card>
  );
}
