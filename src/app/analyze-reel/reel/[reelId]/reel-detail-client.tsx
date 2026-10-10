"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { toParagraphs } from "@/lib/transcript-paragraphs";
import { setReelGoals, updateReelStats, type ReelGoal } from "@/app/reels/actions";
import { transcribeSelectedReels, refreshTranscriptionStatus } from "@/app/analyze-reel/[batchId]/actions";
import { updateReelContent } from "./content-actions";
import { useReelInNewIdea as createIdeaFromReel } from "@/app/library/actions";
import Link from "next/link";
import { ActionDialog, DialogOption } from "@/components/action-dialog";
import { SuggestDialog, TypeChips, TypePicker, useTypes } from "@/components/types-ui";
import { addTypesToReels, setReelTypes } from "@/app/types/actions";
import type { ContentType } from "@/lib/content-types";
import { addReelsToBoard, removeFromBoard, setFavorite } from "@/app/reels/boards-actions";

export type ReelDetail = {
  id: string;
  postType?: string;
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
  repostsCount: number | null;
  savesCount: number | null;
  durationSeconds: number | null;
  transcript: string | null;
  transcriptionStatus: string | null;
  transcriptionError: string | null;
  noAudio: boolean;
  hookText: string | null;
  bodyText: string | null;
  ctaText: string | null;
  goals: ReelGoal[];
};

type Avg = {
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
} | null;

const GOAL_OPTS: { key: ReelGoal; label: string; icon: string }[] = [
  { key: "views", label: "Views", icon: "visibility" },
  { key: "shares", label: "Shares", icon: "send" },
  { key: "comments", label: "Comments", icon: "comment" },
  { key: "saves", label: "Saves", icon: "bookmark" },
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

export type DetailBoard = { id: string; name: string; isFavorites: boolean; has: boolean };

export function ReelDetailClient({ reel: initial, avg, boards: initialBoards, types: initialTypes, typeIds: initialTypeIds }: { reel: ReelDetail; avg: Avg; boards: DetailBoard[]; types: ContentType[]; typeIds: string[] }) {
  const router = useRouter();
  const { types: typeList, setTypes: setTypeList } = useTypes(initialTypes);
  const [typeIds, setTypeIds] = useState(initialTypeIds);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reel, setReel] = useState(initial);
  // Pick up fresh data after a router.refresh() (transcript finished, hook
  // extracted, ...) instead of keeping the first copy forever.
  useEffect(() => setReel(initial), [initial]);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 2200);
  }

  // Goal card: opens by itself when the transcript is ready and no goal is set,
  // stays open while you pick (as many as you like), and the X puts it away.
  // The X is remembered on this device so it doesn't keep coming back.
  const [goalCardOverride, setGoalCardOverride] = useState<boolean | null>(null);
  const [goalDismissed, setGoalDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(`vh-goal-dismissed-${initial.id}`) === "1") setGoalDismissed(true);
    } catch {}
  }, [initial.id]);
  // Goals are picked right on the Goal line now, never in a card on top.
  const showGoalCard = false;
  const [editingGoal, setEditingGoal] = useState(false);

  const goalCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleGoal(g: ReelGoal) {
    const next = reel.goals.includes(g) ? reel.goals.filter((x) => x !== g) : [...reel.goals, g];
    setReel((r) => ({ ...r, goals: next }));
    startTransition(async () => {
      await setReelGoals(reel.id, next);
    });
  }

  function closeGoalCard() {
    setGoalCardOverride(false);
    try {
      localStorage.setItem(`vh-goal-dismissed-${reel.id}`, "1");
    } catch {}
  }

  const [boards, setBoards] = useState(initialBoards);
  const [pickingBoards, setPickingBoards] = useState(false);
  const [pickedBoards, setPickedBoards] = useState<Set<string>>(new Set());
  const inBoards = boards.filter((b) => b.has);

  function confirmBoards() {
    const ids = [...pickedBoards];
    setPickingBoards(false);
    if (ids.length === 0) return;
    setBoards((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, has: true } : b)));
    Promise.all(
      ids.map((id) => {
        const b = boards.find((x) => x.id === id);
        return b?.isFavorites ? setFavorite([reel.id], true) : addReelsToBoard(id, [reel.id]);
      }),
    )
      .then(() => flash(ids.length === 1 ? "Added to board" : `Added to ${ids.length} boards`))
      .catch(() => {
        flash("Couldn't add to the board");
        router.refresh();
      });
  }

  function leaveBoard(b: DetailBoard) {
    setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, has: false } : x)));
    (b.isFavorites ? setFavorite([reel.id], false) : removeFromBoard(b.id, reel.id)).catch(() => {
      flash("Couldn't remove it from the board");
      router.refresh();
    });
  }

  const [makingIdea, setMakingIdea] = useState(false);
  function handleUseInIdea() {
    if (makingIdea) return;
    setMakingIdea(true);
    const text = (reel.hookText || titleFallback(reel.caption)).trim();
    createIdeaFromReel(reel.id, text)
      .then((res) => {
        // straight to the writing page, with this reel already picked
        router.push(`/scripts/${res.id}`);
      })
      .catch(() => {
        setMakingIdea(false);
        flash("Couldn't start the idea. Try again.");
      });
  }

  const commentRate = reel.views > 0 ? reel.commentsCount / reel.views : 0;
  const shareRate = reel.views > 0 && reel.sharesCount != null ? reel.sharesCount / reel.views : null;

  return (
    <>
      {suggestOpen && (
        <SuggestDialog
          reels={[{ id: reel.id, caption: reel.caption, thumbnailUrl: reel.thumbnailUrl }]}
          types={typeList}
          onTypesChange={setTypeList}
          onClose={() => setSuggestOpen(false)}
          onApply={(picks) => {
            const add = picks[reel.id] ?? [];
            setTypeIds((cur) => [...new Set([...cur, ...add])]);
            addTypesToReels([reel.id], add).catch(() => {});
            setSuggestOpen(false);
            flash("Tags added");
          }}
        />
      )}
      {showGoalCard && (
        <div className="relative flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:gap-2.5 md:flex-nowrap md:p-4.5">
          <button
            type="button"
            onClick={closeGoalCard}
            aria-label="Close"
            title="Close"
            className="flex size-8 flex-none items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D] max-md:absolute max-md:top-2 max-md:right-2 md:order-last"
          >
            <MaterialIcon name="close" size={20} />
          </button>
          <div className="flex min-w-0 items-center gap-3 max-md:pr-8">
            <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-[#FFE3F0] text-[#FF1F8F] max-md:size-8">
              <MaterialIcon name="target" size={20} weight={500} className="max-md:text-[17px]!" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold max-md:text-[13.5px]">What Was This Reel Going For?</span>
              <span className="text-[13px] font-medium text-[#4a4a48] max-md:text-[12px] max-md:leading-[1.35]">
                Pick as many as you like, so you can compare reels by what they were built to do. Not sure yet? Just close
                this.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-1.5">
            {GOAL_OPTS.map((g) => {
              const on = reel.goals.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => toggleGoal(g.key)}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-bold max-md:h-8 max-md:min-w-0 max-md:flex-1 max-md:justify-center max-md:gap-1 max-md:px-1.5 max-md:text-[12.5px] ${
                    on ? "border-[#0D0D0D] bg-[#F0F0F1]" : "border-[#E4E4E2] bg-white hover:border-[#BDBDBB]"
                  }`}
                >
                  <MaterialIcon name={on ? "check" : g.icon} size={17} weight={500} className="max-md:text-[15px]!" />
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-stretch gap-3.5 md:gap-5">
        <Card className="flex min-w-0 flex-1 items-center gap-3 p-3 max-md:basis-full md:min-w-[440px] md:gap-5.5 md:p-4.5">
          <a
            href={reel.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on Instagram"
            className="flex-none cursor-pointer"
          >
            <Thumb url={reel.thumbnailUrl} durationSeconds={reel.durationSeconds} />
          </a>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 md:gap-4">
            <span className="text-[15px] leading-[1.3] font-black tracking-[-0.01em] text-balance md:text-[18px]">
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
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#4a4a48] md:gap-2.5 md:text-[13.5px]">
                <MaterialIcon name="av_timer" size={21} className="text-[#0D0D0D] max-md:text-[17px]!" />
                {fmtLen(reel.durationSeconds)}
                {reel.durationSeconds != null ? ` (${Math.round(reel.durationSeconds)} seconds)` : ""}
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#4a4a48] md:gap-2.5 md:text-[13.5px]">
                <MaterialIcon name="calendar_today" size={21} className="text-[#0D0D0D] max-md:text-[17px]!" />
                Posted {fmtDate(reel.postedAt)}
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#4a4a48] md:gap-2.5 md:text-[13.5px]">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2" className="max-md:size-4">
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-[#4a4a48] md:gap-x-2.5 md:text-[13.5px]">
                <MaterialIcon name="target" size={21} className="text-[#0D0D0D] max-md:text-[17px]!" />
                <span>Goal</span>
                {editingGoal ? (
                  <>
                    {GOAL_OPTS.map((g) => {
                      const on = reel.goals.includes(g.key);
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => toggleGoal(g.key)}
                          className="flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[12px] font-bold"
                          style={{ background: on ? "#FFE3F0" : "#FFFFFF", color: on ? "#FF1F8F" : "#4a4a48", borderColor: on ? "#FFC2E0" : "#E4E4E2" }}
                        >
                          <MaterialIcon name={on ? "check" : g.icon} size={15} weight={500} />
                          {g.label}
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => setEditingGoal(false)} className="text-xs font-semibold text-[#7a7a78] hover:text-[#0D0D0D] hover:underline">
                      Done
                    </button>
                  </>
                ) : reel.goals.length > 0 ? (
                  <>
                    {reel.goals.map((gk) => {
                      const o = GOAL_OPTS.find((g) => g.key === gk)!;
                      return (
                        <span
                          key={gk}
                          className="flex items-center gap-1 rounded-xl bg-[#FFE3F0] px-2 py-0.5 text-[12px] font-bold text-[#FF1F8F]"
                        >
                          <MaterialIcon name={o.icon} size={15} weight={500} />
                          {o.label}
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setEditingGoal(true)}
                      className="text-xs font-semibold text-[#7a7a78] hover:text-[#0D0D0D] hover:underline"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-[#9a9a98]">Not set</span>
                    <button
                      type="button"
                      onClick={() => setEditingGoal(true)}
                      className="text-xs font-semibold text-[#7a7a78] hover:text-[#0D0D0D] hover:underline"
                    >
                      Set
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-[#4a4a48] md:gap-x-2.5 md:text-[13.5px]">
                <MaterialIcon name="sell" size={21} className="text-[#0D0D0D] max-md:text-[17px]!" />
                <span>Content Type</span>
                {typeIds.length === 0 && <span className="font-semibold text-[#9a9a98]">Not tagged</span>}
                <TypeChips types={typeList} ids={typeIds} max={8} small={false} />
                <TypePicker
                  types={typeList}
                  value={typeIds}
                  onChange={(v) => {
                    setTypeIds(v);
                    setReelTypes(reel.id, v).catch(() => {});
                  }}
                  onTypesChange={setTypeList}
                  className="text-xs font-semibold text-[#7a7a78] hover:text-[#0D0D0D] hover:underline"
                >
                  {typeIds.length > 0 ? "Change" : "Add"}
                </TypePicker>
                <button
                  type="button"
                  onClick={() => setSuggestOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-[#FFF0F7] px-2.5 py-0.5 text-[12px] font-bold text-[#D10A6E] hover:bg-[#FFE3F0]"
                >
                  <MaterialIcon name="auto_awesome" size={14} /> Suggest
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-[#4a4a48] md:gap-x-2.5 md:text-[13.5px]">
                <MaterialIcon name="folder" size={21} className="text-[#0D0D0D] max-md:text-[17px]!" />
                <span>Boards</span>
                {inBoards.length === 0 && <span className="font-semibold text-[#9a9a98]">Not in any board</span>}
                {inBoards.map((b) => (
                  <span key={b.id} className="flex items-center gap-0.5 rounded-xl bg-[#F0F0F1] py-0.5 pr-1 pl-2 text-[12px] font-bold text-[#0D0D0D]">
                    <Link href={`/boards/${b.id}`} className="hover:text-[#FF1F8F]">
                      {b.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => leaveBoard(b)}
                      title="Remove from this board"
                      aria-label={`Remove from ${b.name}`}
                      className="flex size-5 items-center justify-center rounded-full text-[#4a4a48] hover:bg-white hover:text-[#0D0D0D]"
                    >
                      <MaterialIcon name="close" size={13} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPickedBoards(new Set());
                    setPickingBoards(true);
                  }}
                  className="text-xs font-semibold text-[#7a7a78] hover:text-[#0D0D0D] hover:underline"
                >
                  Add to board
                </button>
              </div>
              <button
                type="button"
                disabled={makingIdea}
                onClick={handleUseInIdea}
                className="mt-1 flex h-10 w-fit items-center gap-2 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-70 max-md:h-9 max-md:text-[12.5px]"
              >
                {makingIdea ? <EqualizerIcon size={15} /> : <MaterialIcon name="lightbulb" size={18} weight={500} />}
                {makingIdea ? "Starting…" : "Use In New Idea"}
              </button>
            </div>
          </div>
        </Card>

        <PerformanceCard reel={reel} avg={avg} commentRate={commentRate} shareRate={shareRate} onSaved={setReel} />
      </div>

      <ContentBreakdownCard
        reel={reel}
        onSaved={setReel}
        onHookLive={(v) => setReel((r) => ({ ...r, hookText: v || null }))}
        flash={flash}
      />

      <TranscriptCard
        reel={reel}
        isBusy={isBusy}
        onBusyChange={setIsBusy}
        onRefreshed={() => router.refresh()}
        flash={flash}
      />

      {pickingBoards && (
        <ActionDialog
          title="Add to a board"
          onClose={() => setPickingBoards(false)}
          confirmLabel="Add"
          confirmDisabled={pickedBoards.size === 0}
          onConfirm={confirmBoards}
        >
          {boards.filter((b) => !b.has).length === 0 ? (
            <div className="px-6 py-4 text-sm font-medium text-[#4a4a48]">This reel is already in every board.</div>
          ) : (
            boards
              .filter((b) => !b.has)
              .map((b) => (
                <DialogOption
                  key={b.id}
                  icon={b.isFavorites ? "favorite" : "folder"}
                  filled
                  label={b.name}
                  selected={pickedBoards.has(b.id)}
                  onSelect={() =>
                    setPickedBoards((prev) => {
                      const next = new Set(prev);
                      if (next.has(b.id)) next.delete(b.id);
                      else next.add(b.id);
                      return next;
                    })
                  }
                />
              ))
          )}
        </ActionDialog>
      )}

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
    <span className="relative flex h-[128px] w-[96px] flex-none md:h-[228px] md:w-[170px] items-center justify-center overflow-hidden rounded-md bg-[#5a4a52] text-white">
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      )}
      <MaterialIcon name="play_arrow" size={38} weight={500} className="relative max-md:text-[26px]!" />
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
  const [draftReposts, setDraftReposts] = useState(reel.repostsCount != null ? String(reel.repostsCount) : "");
  const [draftSaves, setDraftSaves] = useState(reel.savesCount != null ? String(reel.savesCount) : "");

  function startEditing() {
    setDraftViews(String(reel.views));
    setDraftLikes(String(reel.likes));
    setDraftComments(String(reel.commentsCount));
    setDraftShares(reel.sharesCount != null ? String(reel.sharesCount) : "");
    setDraftReposts(reel.repostsCount != null ? String(reel.repostsCount) : "");
    setDraftSaves(reel.savesCount != null ? String(reel.savesCount) : "");
    setEditing(true);
  }

  function save() {
    const next = {
      views: Math.max(0, Number(draftViews) || 0),
      likes: Math.max(0, Number(draftLikes) || 0),
      commentsCount: Math.max(0, Number(draftComments) || 0),
      sharesCount: draftShares.trim() === "" ? null : Math.max(0, Number(draftShares) || 0),
      repostsCount: draftReposts.trim() === "" ? null : Math.max(0, Number(draftReposts) || 0),
      savesCount: draftSaves.trim() === "" ? null : Math.max(0, Number(draftSaves) || 0),
    };
    startSaving(async () => {
      await updateReelStats(reel.id, next);
      onSaved({ ...reel, ...next });
      setEditing(false);
    });
  }

  const avgCommentRate = avg && avg.views > 0 ? avg.comments / avg.views : 0;
  const avgShareRate = avg && avg.views > 0 && avg.shares != null ? avg.shares / avg.views : null;

  const saveRate = reel.savesCount != null && reel.views > 0 ? reel.savesCount / reel.views : null;
  const avgSaveRate = avg && avg.views > 0 && avg.saves != null ? avg.saves / avg.views : null;

  const cells = [
    { icon: "visibility", label: "Views", value: fmtN(reel.views), x: avg && avg.views > 0 ? reel.views / avg.views : null },
    { icon: "favorite", label: "Likes", value: fmtN(reel.likes), x: avg && avg.likes > 0 ? reel.likes / avg.likes : null },
    {
      icon: "comment",
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
      icon: "repeat",
      label: "Reposts",
      value: reel.repostsCount == null ? "—" : fmtN(reel.repostsCount),
      x: avg && avg.reposts != null && avg.reposts > 0 && reel.repostsCount != null ? reel.repostsCount / avg.reposts : null,
      title: reel.repostsCount == null ? "Not pulled yet for this reel. Re-pull it to get it." : "",
    },
    {
      icon: "bookmark",
      label: "Saves",
      value: reel.savesCount == null ? "—" : fmtN(reel.savesCount),
      x: avg && avg.saves != null && avg.saves > 0 && reel.savesCount != null ? reel.savesCount / avg.saves : null,
      title: reel.savesCount == null ? "Not pulled yet for this reel. Re-pull it to get it." : "",
    },
    {
      icon: "comment",
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
    {
      icon: "bookmarks",
      label: "Save %",
      value: saveRate == null ? "—" : pct(saveRate),
      x: avgSaveRate != null && avgSaveRate > 0 && saveRate != null ? saveRate / avgSaveRate : null,
      title: saveRate == null ? "Not pulled yet for this reel. Re-pull it to get it." : "",
    },
  ];

  return (
    <Card className="flex min-w-0 flex-[1.3] flex-col gap-2.5 p-3.5 max-md:basis-full md:min-w-[400px] md:gap-3.5 md:p-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0 max-md:-mb-1 md:gap-3">
        <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em] max-md:leading-none">Performance</span>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Views", draftViews, setDraftViews],
              ["Likes", draftLikes, setDraftLikes],
              ["Comments", draftComments, setDraftComments],
              ["Shares", draftShares, setDraftShares],
              ["Reposts", draftReposts, setDraftReposts],
              ["Saves", draftSaves, setDraftSaves],
            ].map(([label, value, setter]) => (
              <label key={label as string} className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#4a4a48]">{label as string}</span>
                <input
                  type="number"
                  min={0}
                  value={value as string}
                  placeholder={label === "Shares" || label === "Reposts" || label === "Saves" ? "—" : undefined}
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
        <div className="grid flex-1 grid-cols-3 gap-2 md:gap-2.5 sm:grid-cols-3">
          {cells.map((c) => (
            <div key={c.label} title={c.title} className="flex min-w-0 flex-col gap-1 rounded-lg border border-[#F0F0F1] p-2 md:gap-2 md:p-3.5">
              <div className="flex items-center gap-1 text-[11.5px] font-bold md:gap-2.5 md:text-[13.5px]">
                <span className="flex size-auto flex-none items-center justify-center rounded-lg bg-transparent text-[#FF1F8F] md:size-[34px] md:bg-[#FFF0F7]">
                  <MaterialIcon name={c.icon} size={20} weight={500} className="max-md:text-[14px]!" />
                </span>
                {c.label}
              </div>
              <span className="text-[19px] leading-none font-black tracking-[-0.02em] [font-variant-numeric:tabular-nums] md:text-[26px]">
                {c.value}
              </span>
              {c.x == null ? (
                <span className="text-[11px] font-bold text-[#9a9a98] md:text-xs">Not available</span>
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
  collapsible,
}: {
  icon: string;
  label: string;
  value: string;
  editing: boolean;
  placeholder: string;
  rows: number;
  onChange: (v: string) => void;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const long = !!collapsible && value.length > 220;
  return (
    <div className="flex flex-1 items-start gap-4 rounded-lg border border-[#F0F0F1] p-3 md:p-4.5">
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F] max-md:hidden">
        <MaterialIcon name={icon} size={21} weight={500} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-2.5">
        <span className="flex items-center gap-2 text-[15px] font-black tracking-[-0.01em] md:text-[19px]">
          <span className="flex size-7 flex-none items-center justify-center rounded-md bg-[#FFF0F7] text-[#FF1F8F] md:hidden">
            <MaterialIcon name={icon} size={16} weight={500} />
          </span>
          {label}
        </span>
        {editing ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full resize-y rounded-md border border-[#E4E4E2] bg-[#FBFBFA] px-3 py-2.5 text-[15px] leading-[1.6] text-[#0D0D0D] outline-none"
          />
        ) : value.trim() ? (
          <span
            className={`text-[14px] leading-[1.55] text-pretty md:text-[16px] md:leading-[1.65] ${long && !open ? "line-clamp-4 md:line-clamp-none" : ""}`}
          >
            {value}
          </span>
        ) : (
          <span className="text-[14px] font-medium text-[#9a9a98] md:text-[15px]">{placeholder}</span>
        )}
        {long && !editing && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-fit text-[12.5px] font-bold underline decoration-2 underline-offset-[3px] md:hidden"
          >
            {open ? "Show Less" : "Show More"}
          </button>
        )}
      </div>
    </div>
  );
}

function ContentBreakdownCard({
  reel,
  onSaved,
  onHookLive,
  flash,
}: {
  reel: ReelDetail;
  onSaved: (r: ReelDetail) => void;
  onHookLive: (v: string) => void;
  flash: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [hook, setHook] = useState(reel.hookText ?? "");
  const [caption, setCaption] = useState(reel.caption ?? "");
  const [cta, setCta] = useState(reel.ctaText ?? "");

  function toggle() {
    if (editing) {
      startSaving(async () => {
        await updateReelContent(reel.id, { hookText: hook, ctaText: cta, caption });
        onSaved({ ...reel, hookText: hook || null, ctaText: cta || null, caption: caption || null });
        flash("Changes saved");
        setEditing(false);
      });
    } else {
      setHook(reel.hookText ?? "");
      setCaption(reel.caption ?? "");
      setCta(reel.ctaText ?? "");
      setEditing(true);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-3.5 md:gap-4 md:p-5.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em]">Content Breakdown</span>
        <button
          type="button"
          disabled={isSaving}
          onClick={toggle}
          className="flex h-9 items-center gap-1.5 rounded-md border px-3.5 text-[13px] font-bold disabled:opacity-60"
          style={{ background: editing ? "#FF1F8F" : "#FFFFFF", borderColor: editing ? "#FF1F8F" : "#E4E4E2" }}
        >
          <MaterialIcon name={editing ? "save" : "edit"} size={17} />
          {isSaving ? "Saving…" : editing ? "Save" : "Edit"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5 md:gap-3">
          <BreakdownBlock
            icon="bolt"
            label="Hook"
            value={hook}
            editing={editing}
            placeholder="No hook yet"
            rows={2}
            onChange={(v) => {
              setHook(v);
              onHookLive(v);
            }}
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
        <div className="flex flex-col gap-3">
          <BreakdownBlock
            icon="description"
            label="Caption"
            value={caption}
            editing={editing}
            placeholder="No caption"
            collapsible
            rows={8}
            onChange={setCaption}
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
    const check = () =>
      refreshTranscriptionStatus(reel.id)
        .catch(() => null)
        .finally(onRefreshed);
    // check right away (a phone that slept stops its timers), then every 10 seconds,
    // and again the moment you come back to this tab
    check();
    const t = setInterval(check, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, reel.id, onRefreshed]);

  if (reel.postType && reel.postType !== "reel") {
    return (
      <Card className="flex flex-col gap-2 p-3.5 md:p-5.5">
        <span className="flex items-center gap-2 text-[20px] md:text-[26px] font-black tracking-[-0.02em]">
          <MaterialIcon name="collections" size={26} className="text-[#2F6BFF]" /> This Is A Carousel
        </span>
        <span className="text-[15px] font-medium text-[#4a4a48]">It has no video, so there's nothing to transcribe. The numbers above are all there is.</span>
      </Card>
    );
  }

  if (status !== "ready") {
    return (
      <Card className="flex flex-col gap-3 p-3.5 md:p-5.5">
        <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em]">Full Transcript</span>
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
        {status === "error" && reel.noAudio && (
          <>
            <span className="flex items-start gap-2.5 text-[14.5px] leading-[1.5] font-medium text-[#4a4a48]">
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-[#F0F0F1] text-[#4a4a48]">
                <MaterialIcon name="volume_off" size={18} />
              </span>
              <span>
                <span className="font-extrabold text-[#0D0D0D]">No audio to transcribe.</span> We tried, and this reel has no
                spoken words (most likely just text on screen).
              </span>
            </span>
          </>
        )}
        {status === "error" && !reel.noAudio && (
          <>
            <span className="text-[15px] font-medium text-[#D10A6E]">
              {/yt-dlp|download|command failed/i.test(reel.transcriptionError ?? "")
                ? "Couldn't download this video, so it can't be transcribed. It may be private, removed or blocked."
                : reel.transcriptionError || "Transcription failed."}
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
  const paragraphs = toParagraphs(transcript);

  return (
    <Card className="flex flex-col gap-3 p-3.5 md:gap-4 md:p-5.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em]">Full Transcript</span>
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
          <MaterialIcon name="copy_all" size={16} />
          Copy
        </button>
      </div>
      <div className="flex max-w-[80ch] flex-col gap-3.5">
        {paragraphs.length === 0 ? (
          <span className="text-[15px] font-medium text-[#9a9a98]">(empty transcript)</span>
        ) : (
          paragraphs.map((p, i) => (
            <span key={i} className="text-[15px] leading-[1.65] text-pretty md:text-[16.5px] md:leading-[1.7]">
              {p}
            </span>
          ))
        )}
      </div>
    </Card>
  );
}
