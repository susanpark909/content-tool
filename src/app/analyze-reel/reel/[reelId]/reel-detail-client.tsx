"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { setReelGoal, updateReelStats, type ReelGoal } from "@/app/reels/actions";
import { transcribeSelectedReels, refreshTranscriptionStatus } from "@/app/analyze-reel/[batchId]/actions";
import { updateReelContent } from "./content-actions";

export type ReelDetail = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  durationSeconds: number | null;
  transcript: string | null;
  transcriptionStatus: string | null;
  transcriptionError: string | null;
  hookText: string | null;
  bodyText: string | null;
  ctaText: string | null;
  goal: ReelGoal | null;
};

type Avg = { views: number; likes: number; comments: number; shares: number | null } | null;

const GOAL_OPTS: { key: ReelGoal; label: string; icon: string }[] = [
  { key: "views", label: "Views", icon: "visibility" },
  { key: "shares", label: "Shares", icon: "send" },
  { key: "comments", label: "Comments", icon: "chat_bubble" },
];
const STANDOUT_AT = 2;

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}
function pct(v: number) {
  return (v * 100).toFixed(2) + "%";
}
function fmtLen(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Without a transcript there's no real hook yet - showing the raw
// Instagram caption (which can run many sentences, hashtags and all) as a
// big bold title looks like a wall of text, so just take its first
// sentence/line as a stand-in.
function titleFallback(caption: string | null) {
  if (!caption) return "(no caption)";
  const firstLine = caption.split("\n")[0].trim();
  const match = firstLine.match(/^.{1,140}?[.!?](?:\s|$)/);
  const sentence = match ? match[0].trim() : firstLine;
  return sentence.length > 140 ? sentence.slice(0, 140).trim() + "…" : sentence;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] ${className}`}>
      {children}
    </div>
  );
}

export function ReelDetailClient({ reel: initial, avg }: { reel: ReelDetail; avg: Avg }) {
  const router = useRouter();
  const [reel, setReel] = useState(initial);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 2200);
  }

  function handleGoal(goal: ReelGoal | null) {
    setReel((r) => ({ ...r, goal }));
    startTransition(async () => {
      await setReelGoal(reel.id, goal);
    });
  }

  const commentRate = reel.views > 0 ? reel.commentsCount / reel.views : 0;
  const shareRate = reel.views > 0 && reel.sharesCount != null ? reel.sharesCount / reel.views : null;

  return (
    <>
      {!reel.goal && reel.transcriptionStatus === "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#F0F0F1] bg-white p-4.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-[#FFE3F0] text-[#FF1F8F]">
              <MaterialIcon name="flag" size={20} weight={500} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold">What Was This Reel Going For?</span>
              <span className="text-[13px] font-medium text-[#4a4a48]">
                Transcript&apos;s ready. Pick the goal so you can compare reels by what they were built to do.
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {GOAL_OPTS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => handleGoal(g.key)}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[#E4E4E2] bg-white px-3.5 text-[13.5px] font-bold hover:border-[#FF1F8F] hover:bg-[#FF1F8F] hover:text-white"
              >
                <MaterialIcon name={g.icon} size={17} weight={500} />
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-stretch gap-5">
        <Card className="flex min-w-[440px] flex-1 items-center gap-5.5 p-4.5">
          <a
            href={reel.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on Instagram"
            className="flex-none cursor-pointer"
          >
            <Thumb url={reel.thumbnailUrl} durationSeconds={reel.durationSeconds} />
          </a>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
            <span className="text-[18px] leading-[1.3] font-black tracking-[-0.01em] text-balance">
              {reel.hookText || titleFallback(reel.caption)}
            </span>
            <div className="flex items-center gap-2.5">
              <Avatar reel={reel} />
              <div className="flex min-w-0 flex-col gap-px">
                {reel.ownerUsername ? (
                  <a
                    href={`https://www.instagram.com/${reel.ownerUsername}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[15px] font-bold hover:text-[#FF1F8F] hover:underline"
                  >
                    @{reel.ownerUsername}
                  </a>
                ) : (
                  <span className="text-[15px] font-bold text-[#9a9a98]">—</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#4a4a48]">
                <MaterialIcon name="schedule" size={21} className="text-[#0D0D0D]" />
                {fmtLen(reel.durationSeconds)}
                {reel.durationSeconds != null ? ` (${Math.round(reel.durationSeconds)} seconds)` : ""}
              </div>
              <div className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#4a4a48]">
                <MaterialIcon name="calendar_today" size={21} className="text-[#0D0D0D]" />
                Posted {fmtDate(reel.postedAt)}
              </div>
              <div className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#4a4a48]">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
                </svg>
                <span>Source</span>
                <a
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#0D0D0D] hover:text-[#FF1F8F] hover:underline"
                >
                  Instagram (Reel)
                </a>
              </div>
              <div className="flex min-h-7 items-center gap-2.5 text-[13.5px] font-medium text-[#4a4a48]">
                <MaterialIcon name="flag" size={21} className="text-[#0D0D0D]" />
                <span>Goal</span>
                {reel.goal ? (
                  <>
                    <span className="flex items-center gap-1.5 rounded-xl bg-[#FFE3F0] px-2.5 py-0.5 text-[13.5px] font-bold text-[#FF1F8F]">
                      <MaterialIcon
                        name={GOAL_OPTS.find((g) => g.key === reel.goal)!.icon}
                        size={15}
                        weight={500}
                      />
                      {GOAL_OPTS.find((g) => g.key === reel.goal)!.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleGoal(null)}
                      className="text-[13px] font-semibold text-[#4a4a48] underline decoration-2 underline-offset-[3px] hover:text-[#0D0D0D]"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <span className="font-semibold text-[#9a9a98]">Not set</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <PerformanceCard reel={reel} avg={avg} commentRate={commentRate} shareRate={shareRate} onSaved={setReel} />
      </div>

      <ContentBreakdownCard reel={reel} onSaved={setReel} flash={flash} />

      <TranscriptCard
        reel={reel}
        isBusy={isBusy}
        onBusyChange={setIsBusy}
        onRefreshed={() => router.refresh()}
        flash={flash}
      />

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-md bg-[#0D0D0D] px-4.5 py-3 text-sm font-bold text-[#FBFBFA]">
          <span className="size-2 rounded-full bg-[#C6FF3D]" />
          {toast}
        </div>
      )}
    </>
  );
}

function Thumb({ url, durationSeconds }: { url: string | null; durationSeconds: number | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="relative flex h-[228px] w-[170px] flex-none items-center justify-center overflow-hidden rounded-md bg-[#5a4a52] text-white">
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      )}
      <MaterialIcon name="play_arrow" size={38} weight={500} className="relative" />
      <span className="absolute right-2.5 bottom-2.5 left-2.5 flex items-center gap-2 text-[11.5px] font-bold">
        <span className="h-[3px] flex-1 rounded-full bg-white/35" />
        <span>{fmtLen(durationSeconds)}</span>
      </span>
    </span>
  );
}

function Avatar({ reel }: { reel: ReelDetail }) {
  const [broken, setBroken] = useState(false);
  const initials = (reel.ownerUsername ?? "??").slice(0, 2).toUpperCase();
  return (
    <span className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-full bg-[#8a3a62] text-[13px] font-extrabold text-white">
      {reel.ownerAvatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reel.ownerAvatarUrl}
          alt=""
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

function PerformanceCard({
  reel,
  avg,
  commentRate,
  shareRate,
  onSaved,
}: {
  reel: ReelDetail;
  avg: Avg;
  commentRate: number;
  shareRate: number | null;
  onSaved: (r: ReelDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [draftViews, setDraftViews] = useState(String(reel.views));
  const [draftLikes, setDraftLikes] = useState(String(reel.likes));
  const [draftComments, setDraftComments] = useState(String(reel.commentsCount));
  const [draftShares, setDraftShares] = useState(reel.sharesCount != null ? String(reel.sharesCount) : "");

  function startEditing() {
    setDraftViews(String(reel.views));
    setDraftLikes(String(reel.likes));
    setDraftComments(String(reel.commentsCount));
    setDraftShares(reel.sharesCount != null ? String(reel.sharesCount) : "");
    setEditing(true);
  }

  function save() {
    const next = {
      views: Math.max(0, Number(draftViews) || 0),
      likes: Math.max(0, Number(draftLikes) || 0),
      commentsCount: Math.max(0, Number(draftComments) || 0),
      sharesCount: draftShares.trim() === "" ? null : Math.max(0, Number(draftShares) || 0),
    };
    startSaving(async () => {
      await updateReelStats(reel.id, next);
      onSaved({ ...reel, ...next });
      setEditing(false);
    });
  }

  const avgCommentRate = avg && avg.views > 0 ? avg.comments / avg.views : 0;
  const avgShareRate = avg && avg.views > 0 && avg.shares != null ? avg.shares / avg.views : null;

  const cells = [
    { icon: "visibility", label: "Views", value: fmtN(reel.views), x: avg && avg.views > 0 ? reel.views / avg.views : null },
    { icon: "favorite", label: "Likes", value: fmtN(reel.likes), x: avg && avg.likes > 0 ? reel.likes / avg.likes : null },
    {
      icon: "chat_bubble",
      label: "Comments",
      value: fmtN(reel.commentsCount),
      x: avg && avg.comments > 0 ? reel.commentsCount / avg.comments : null,
    },
    {
      icon: "send",
      label: "Shares",
      value: reel.sharesCount == null ? "—" : fmtN(reel.sharesCount),
      x: avg && avg.shares != null && avg.shares > 0 && reel.sharesCount != null ? reel.sharesCount / avg.shares : null,
      title: reel.sharesCount == null ? "Instagram hides shares on this reel" : "",
    },
    {
      icon: "forum",
      label: "Comment %",
      value: pct(commentRate),
      x: avgCommentRate > 0 ? commentRate / avgCommentRate : null,
    },
    {
      icon: "trending_up",
      label: "Share %",
      value: shareRate == null ? "—" : pct(shareRate),
      x: avgShareRate != null && avgShareRate > 0 && shareRate != null ? shareRate / avgShareRate : null,
      title: shareRate == null ? "Instagram hides shares on this reel" : "",
    },
  ];

  return (
    <Card className="flex min-w-[400px] flex-[1.3] flex-col gap-3.5 p-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[26px] font-black tracking-[-0.02em]">Performance</span>
        <div className="flex items-center gap-2.5">
          {reel.ownerUsername && (
            <span className="text-[12.5px] font-semibold text-[#4a4a48]">
              vs. @{reel.ownerUsername}&apos;s last 30 reels
            </span>
          )}
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              title="Edit stats"
              className="flex size-7 items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
            >
              <MaterialIcon name="edit" size={16} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Views", draftViews, setDraftViews],
              ["Likes", draftLikes, setDraftLikes],
              ["Comments", draftComments, setDraftComments],
              ["Shares", draftShares, setDraftShares],
            ].map(([label, value, setter]) => (
              <label key={label as string} className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#4a4a48]">{label as string}</span>
                <input
                  type="number"
                  min={0}
                  value={value as string}
                  placeholder={label === "Shares" ? "—" : undefined}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className="h-9 rounded-md border border-[#E4E4E2] px-2.5 text-sm font-semibold outline-none"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={save}
              className="flex h-9 items-center rounded-md bg-[#FF1F8F] px-4 text-[13px] font-extrabold hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setEditing(false)}
              className="flex h-9 items-center rounded-md border border-[#E4E4E2] px-4 text-[13px] font-bold hover:border-[#0D0D0D]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
          {cells.map((c) => (
            <div key={c.label} title={c.title} className="flex min-w-0 flex-col gap-2 rounded-lg border border-[#F0F0F1] p-3.5">
              <div className="flex items-center gap-2.5 text-[13.5px] font-bold">
                <span className="flex size-[34px] flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
                  <MaterialIcon name={c.icon} size={20} weight={500} />
                </span>
                {c.label}
              </div>
              <span className="text-[26px] leading-none font-black tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
                {c.value}
              </span>
              {c.x == null ? (
                <span className="text-xs font-bold text-[#9a9a98]">Not available</span>
              ) : c.x >= STANDOUT_AT ? (
                <span className="flex w-fit items-center gap-1 rounded-xl bg-[#C6FF3D] py-0.5 pr-2 pl-1.5 text-xs font-extrabold">
                  <MaterialIcon name="bolt" size={14} weight={500} />
                  {c.x.toFixed(1)}x
                </span>
              ) : (
                <span className="text-xs font-bold" style={{ color: c.x >= 1 ? "#0D0D0D" : "#8a8a88" }}>
                  {c.x.toFixed(1)}x avg
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {avg && (
        <span className="text-xs font-medium text-[#9a9a98]">
          Her average: {fmtN(avg.views)} views · {fmtN(avg.likes)} likes · {fmtN(avg.comments)} comments. Standout
          = {STANDOUT_AT}x or more.
        </span>
      )}
    </Card>
  );
}

function BreakdownBlock({
  icon,
  label,
  value,
  editing,
  placeholder,
  rows,
  onChange,
}: {
  icon: string;
  label: string;
  value: string;
  editing: boolean;
  placeholder: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-1 items-start gap-4 rounded-lg border border-[#F0F0F1] p-4.5">
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={21} weight={500} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-[19px] font-black tracking-[-0.01em]">{label}</span>
        {editing ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full resize-y rounded-md border border-[#E4E4E2] bg-[#FBFBFA] px-3 py-2.5 text-[15px] leading-[1.6] text-[#0D0D0D] outline-none"
          />
        ) : value.trim() ? (
          <span className="text-[16px] leading-[1.65] text-pretty">{value}</span>
        ) : (
          <span className="text-[15px] font-medium text-[#9a9a98]">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

function ContentBreakdownCard({
  reel,
  onSaved,
  flash,
}: {
  reel: ReelDetail;
  onSaved: (r: ReelDetail) => void;
  flash: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [hook, setHook] = useState(reel.hookText ?? "");
  const [body, setBody] = useState(reel.bodyText ?? "");
  const [caption, setCaption] = useState(reel.caption ?? "");
  const [cta, setCta] = useState(reel.ctaText ?? "");

  function toggle() {
    if (editing) {
      startSaving(async () => {
        await updateReelContent(reel.id, { hookText: hook, bodyText: body, ctaText: cta, caption });
        onSaved({ ...reel, hookText: hook || null, bodyText: body || null, ctaText: cta || null, caption: caption || null });
        flash("Changes saved");
        setEditing(false);
      });
    } else {
      setHook(reel.hookText ?? "");
      setBody(reel.bodyText ?? "");
      setCaption(reel.caption ?? "");
      setCta(reel.ctaText ?? "");
      setEditing(true);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[26px] font-black tracking-[-0.02em]">Content Breakdown</span>
        <button
          type="button"
          disabled={isSaving}
          onClick={toggle}
          className="flex h-9 items-center gap-1.5 rounded-md border px-3.5 text-[13px] font-bold disabled:opacity-60"
          style={{ background: editing ? "#FF1F8F" : "#FFFFFF", borderColor: editing ? "#FF1F8F" : "#E4E4E2" }}
        >
          <MaterialIcon name={editing ? "check" : "edit"} size={17} />
          {isSaving ? "Saving…" : editing ? "Done" : "Edit"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <BreakdownBlock
            icon="bolt"
            label="Hook"
            value={hook}
            editing={editing}
            placeholder="No hook yet"
            rows={2}
            onChange={setHook}
          />
          <BreakdownBlock
            icon="notes"
            label="Body"
            value={body}
            editing={editing}
            placeholder="No body yet"
            rows={10}
            onChange={setBody}
          />
        </div>
        <div className="flex flex-col gap-3">
          <BreakdownBlock
            icon="description"
            label="Caption"
            value={caption}
            editing={editing}
            placeholder="No caption"
            rows={5}
            onChange={setCaption}
          />
          <BreakdownBlock
            icon="ads_click"
            label="CTA"
            value={cta}
            editing={editing}
            placeholder="No CTA in this reel."
            rows={3}
            onChange={setCta}
          />
        </div>
      </div>
    </Card>
  );
}

function TranscriptCard({
  reel,
  isBusy,
  onBusyChange,
  onRefreshed,
  flash,
}: {
  reel: ReelDetail;
  isBusy: boolean;
  onBusyChange: (v: boolean) => void;
  onRefreshed: () => void;
  flash: (m: string) => void;
}) {
  const status = reel.transcriptionStatus;

  // Check on a running transcription every 10 seconds so this flips to the
  // finished transcript by itself.
  useEffect(() => {
    if (status !== "processing") return;
    const t = setInterval(() => {
      refreshTranscriptionStatus(reel.id)
        .catch(() => null)
        .finally(onRefreshed);
    }, 10000);
    return () => clearInterval(t);
  }, [status, reel.id, onRefreshed]);

  if (status !== "ready") {
    return (
      <Card className="flex flex-col gap-3 p-5.5">
        <span className="text-[26px] font-black tracking-[-0.02em]">Full Transcript</span>
        {!status && (
          <>
            <span className="text-[15px] font-medium text-[#4a4a48]">Not transcribed yet.</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                onBusyChange(true);
                transcribeSelectedReels([reel.id])
                  .then(() => flash("Sent to transcription"))
                  .finally(() => {
                    onBusyChange(false);
                    onRefreshed();
                  });
              }}
              className="flex h-10 w-fit items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
            >
              <MaterialIcon name="graphic_eq" size={18} weight={500} />
              {isBusy ? "Starting…" : "Transcribe this reel"}
            </button>
          </>
        )}
        {status === "processing" && (
          <>
            <span className="flex items-center gap-2.5 text-[15px] font-medium text-[#4a4a48]">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#FFD9EB] text-[#FF1F8F]">
                <EqualizerIcon size={16} />
              </span>
              Transcribing — this can take up to a minute or two. It updates on its own.
            </span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                onBusyChange(true);
                refreshTranscriptionStatus(reel.id).finally(() => {
                  onBusyChange(false);
                  onRefreshed();
                });
              }}
              className="flex h-10 w-fit items-center gap-1.5 rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D] disabled:opacity-60"
            >
              <MaterialIcon name="refresh" size={17} />
              {isBusy ? "Checking…" : "Check status"}
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <span className="text-[15px] font-medium text-[#D10A6E]">
              {reel.transcriptionError || "Transcription failed."}
            </span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                onBusyChange(true);
                transcribeSelectedReels([reel.id]).finally(() => {
                  onBusyChange(false);
                  onRefreshed();
                });
              }}
              className="flex h-10 w-fit items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
            >
              <MaterialIcon name="refresh" size={18} />
              {isBusy ? "Retrying…" : "Retry"}
            </button>
          </>
        )}
      </Card>
    );
  }

  const transcript = reel.transcript || "";
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  // Split into readable paragraphs - the transcription API returns plain
  // text with no per-sentence timestamps, so (unlike the design mock) there
  // are no real timestamp chips to show per segment.
  const sentences = transcript.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? (transcript ? [transcript] : []);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join("").trim());
  }

  return (
    <Card className="flex flex-col gap-4 p-5.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[26px] font-black tracking-[-0.02em]">Full Transcript</span>
          <span className="text-[13px] font-semibold text-[#9a9a98]">{words} words</span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(transcript).catch(() => {});
            flash("Transcript copied");
          }}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#0D0D0D]"
        >
          <MaterialIcon name="content_copy" size={16} />
          Copy
        </button>
      </div>
      <div className="flex max-w-[80ch] flex-col gap-3.5">
        {paragraphs.length === 0 ? (
          <span className="text-[15px] font-medium text-[#9a9a98]">(empty transcript)</span>
        ) : (
          paragraphs.map((p, i) => (
            <span key={i} className="text-[16.5px] leading-[1.7] text-pretty">
              {p}
            </span>
          ))
        )}
      </div>
    </Card>
  );
}
