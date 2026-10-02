"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { runProfileResearch, analyzeSingleReel, checkExistingReelUrls } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const CARD =
  "flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-5.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]";
const CARD_TITLE = "text-[26px] font-black tracking-[-0.02em]";
const FIELD_LABEL = "text-xs font-bold text-[#4a4a48]";
const HELPER_TEXT = "text-[13px] font-medium text-[#4a4a48] text-pretty";
const PRIMARY_BUTTON =
  "flex h-[46px] items-center justify-center gap-2 rounded-md bg-[#FF1F8F] px-5 text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:cursor-not-allowed disabled:hover:bg-[#FF1F8F] disabled:hover:text-[#0D0D0D]";
const SELECT_CLASS =
  "h-[46px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-sm font-semibold text-[#0D0D0D] outline-none";
const DATE_INPUT_CLASS =
  "h-9 rounded-md border border-[#E4E4E2] bg-white px-2.5 text-[13px] font-semibold text-[#0D0D0D] outline-none";

// Apify's free-tier rate for the instagram-reel-scraper actor ($2.60 per
// 1,000 results). Paid plans are cheaper; this is the conservative upper
// bound so the estimate never undersells the real cost.
const APIFY_FREE_TIER_COST_PER_REEL = 2.6 / 1000;
const MAX_RESULTS_LIMIT = 500;

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Detection =
  | { type: "empty" }
  | { type: "invalid" }
  | { type: "profile"; handle: string | null }
  | { type: "reel"; handle: string | null };

function detect(raw: string): Detection {
  const s = raw.trim();
  if (!s) return { type: "empty" };
  const reelMatch = s.match(/instagram\.com\/(?:([A-Za-z0-9._]+)\/)?(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  if (reelMatch) return { type: "reel", handle: reelMatch[1] ? `@${reelMatch[1]}` : null };
  const profileMatch = s.match(/instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i);
  if (profileMatch && !["reel", "reels", "p", "explore", "stories"].includes(profileMatch[1].toLowerCase())) {
    return { type: "profile", handle: `@${profileMatch[1]}` };
  }
  const handleOnly = s.match(/^@?([A-Za-z0-9._]+)$/);
  if (handleOnly) return { type: "profile", handle: `@${handleOnly[1]}` };
  return { type: "invalid" };
}

// The single combined "paste a link" input - auto-detects whether it's a
// creator profile or one reel link and shows the matching fields/copy,
// per the design. Delegates to the same runProfileResearch /
// analyzeSingleReel actions the two separate forms always used.
export function AnalyzeForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [range, setRange] = useState("30");
  const [count, setCount] = useState("30");
  const [dateFrom, setDateFrom] = useState(isoDateDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDateDaysAgo(0));
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateShortCode, setDuplicateShortCode] = useState<string | null>(null);
  const [pendingReelUrl, setPendingReelUrl] = useState<string | null>(null);

  const det = useMemo(() => detect(url), [url]);
  const isProfile = det.type === "profile";
  const isReel = det.type === "reel";
  // Date range / # of posts only apply to a profile pull - dim them once a
  // single reel link is specifically detected, but otherwise (including the
  // empty starting state) leave them fully enabled.
  const fieldsEnabled = !isReel;

  const effectiveFetch =
    range === "custom" ? MAX_RESULTS_LIMIT : Number(count) || 30;
  const estimatedCost = (effectiveFetch * APIFY_FREE_TIER_COST_PER_REEL).toFixed(2);

  const helper = (() => {
    if (det.type === "invalid") return "That doesn't look like an Instagram profile or reel link.";
    if (det.type === "reel")
      return "A single reel is compared against that creator's recent reels once pulled. Date range and # of posts don't apply.";
    if (det.type === "profile")
      return `Pulls up to ${count || 30} reels${range === "custom" ? " from your date range" : ` from the last ${range} days`}. Estimated cost: ~$${estimatedCost} (worst case, free-tier rate; less on a paid Apify plan).`;
    return "Paste a creator profile to pull their recent reels, or a single reel link to analyze just that one.";
  })();

  function runProfile() {
    setError(null);
    const formData = new FormData();
    formData.set("profileUrl", url.trim());
    formData.set("resultsLimit", count.trim());
    if (range === "custom") {
      formData.set("dateFrom", dateFrom);
      formData.set("dateTo", dateTo);
    }
    startTransition(async () => {
      try {
        await runProfileResearch(formData);
        setUrl("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function runReel(reelUrl: string) {
    setError(null);
    const formData = new FormData();
    formData.set("reelUrl", reelUrl);
    startTransition(async () => {
      try {
        await analyzeSingleReel(formData);
        setUrl("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  async function handleRun() {
    if (isProfile) {
      runProfile();
      return;
    }
    if (isReel) {
      const reelUrl = url.trim();
      setIsChecking(true);
      setError(null);
      try {
        const duplicates = await checkExistingReelUrls([reelUrl]);
        if (duplicates.length > 0) {
          setDuplicateShortCode(duplicates[0].shortCode);
          setPendingReelUrl(reelUrl);
        } else {
          runReel(reelUrl);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setIsChecking(false);
      }
    }
  }

  function confirmUpdateDuplicate() {
    if (pendingReelUrl) runReel(pendingReelUrl);
    setDuplicateShortCode(null);
    setPendingReelUrl(null);
  }

  const busy = isPending || isChecking;

  return (
    <div className={CARD}>
      <span className={CARD_TITLE}>Analyze</span>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>Profile or reel link</span>
          <div className="flex h-[46px] items-center gap-2.5 rounded-md border border-[#E4E4E2] bg-white px-3 focus-within:border-[#0D0D0D]">
            <MaterialIcon name="link" size={20} className="text-[#4a4a48]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRun();
              }}
              placeholder="Paste an Instagram profile or reel link…"
              disabled={busy}
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-[#0D0D0D] outline-none"
            />
            {(isProfile || isReel) && (
              <span
                className="flex flex-none items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                style={{
                  background: isProfile ? "#0D0D0D" : "#FFD9EB",
                  color: isProfile ? "#F6F6F5" : "#0D0D0D",
                }}
              >
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: isProfile ? "#C6FF3D" : "#FF1F8F" }}
                />
                {isProfile ? "Profile" : "Single reel"}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex w-[170px] flex-none flex-col gap-1.5"
          style={{ opacity: fieldsEnabled ? 1 : 0.4 }}
        >
          <span className={FIELD_LABEL}>Date range</span>
          <div className="relative">
            <select
              value={range}
              disabled={!fieldsEnabled || busy}
              onChange={(e) => setRange(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 2 weeks</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
            <MaterialIcon
              name="expand_more"
              size={20}
              className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48]"
            />
          </div>
        </div>

        <div
          className="flex w-[110px] flex-none flex-col gap-1.5"
          style={{ opacity: fieldsEnabled ? 1 : 0.4 }}
        >
          <span className={FIELD_LABEL}># of posts</span>
          <input
            type="number"
            min={1}
            max={MAX_RESULTS_LIMIT}
            value={count}
            disabled={!fieldsEnabled || busy}
            onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="20"
            className="h-[46px] w-full rounded-md border border-[#E4E4E2] bg-white px-3 text-sm font-semibold text-[#0D0D0D] outline-none [font-variant-numeric:tabular-nums]"
          />
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={busy || (!isProfile && !isReel)}
          className={PRIMARY_BUTTON}
        >
          {busy ? (
            <MaterialIcon name="progress_activity" size={19} weight={500} className="animate-spin" />
          ) : (
            <MaterialIcon name="bolt" size={19} weight={500} />
          )}
          {isPending ? "Pulling reels…" : isChecking ? "Checking…" : "Run analysis"}
        </button>
      </div>

      {fieldsEnabled && range === "custom" && (
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#4a4a48]">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </div>
      )}

      {error && <p className="text-sm font-semibold text-[#D10A6E]">{error}</p>}
      {busy ? (
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#0D0D0D]">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#FF1F8F] opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[#FF1F8F]" />
          </span>
          Pulling from Instagram… this can take up to a minute. No need to click again.
        </span>
      ) : (
        <span className={HELPER_TEXT}>{helper}</span>
      )}

      <Dialog
        open={duplicateShortCode != null}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateShortCode(null);
            setPendingReelUrl(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This reel is already saved</DialogTitle>
            <DialogDescription>
              This reel has already been analyzed. Update it with current
              data? Views, likes, comments, shares, and length will be
              refreshed — any saved hook or body example stays put.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setDuplicateShortCode(null);
                setPendingReelUrl(null);
              }}
              className="rounded-md border border-[#E4E4E2] px-4 py-2 text-sm font-bold hover:border-[#0D0D0D]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmUpdateDuplicate}
              className="rounded-md bg-[#FF1F8F] px-4 py-2 text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
            >
              Update with current data
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
