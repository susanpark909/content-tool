"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runProfileResearch, analyzeSingleReel } from "./actions";

// Apify's free-tier rate for the instagram-reel-scraper actor ($2.60 per
// 1,000 results). Paid plans are cheaper; this is the conservative upper
// bound so the estimate never undersells the real cost.
const APIFY_FREE_TIER_COST_PER_REEL = 2.6 / 1000;
const MAX_RESULTS_LIMIT = 100;

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 2 weeks", days: 14 },
  { label: "Last 30 days", days: 30 },
];

export function ProfileResearchForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultsLimitInput, setResultsLimitInput] = useState("30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const resultsLimit = Number(resultsLimitInput) || 0;
  const hasDateRange = Boolean(dateFrom || dateTo);
  const effectiveFetch = hasDateRange ? MAX_RESULTS_LIMIT : resultsLimit;
  const estimatedCost = (effectiveFetch * APIFY_FREE_TIER_COST_PER_REEL).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analyze a creator</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              try {
                await runProfileResearch(formData);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profileUrl">Instagram profile URL or username</Label>
            <Input
              id="profileUrl"
              name="profileUrl"
              placeholder="https://instagram.com/username"
              required
              disabled={isPending}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setDateFrom(isoDateDaysAgo(preset.days));
                  setDateTo(isoDateDaysAgo(0));
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                name="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                name="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-64">
            <Label htmlFor="resultsLimit">
              {hasDateRange ? "Top reels to keep (by views)" : "Reels to pull"}
            </Label>
            <Input
              id="resultsLimit"
              name="resultsLimit"
              type="number"
              min={1}
              max={100}
              value={resultsLimitInput}
              onChange={(e) => {
                // Strip leading zeros (e.g. "010") so the digit can't get
                // stuck - React won't re-render a number input's text when
                // the parsed value doesn't change, so "010" stays on screen
                // unless we normalize the string ourselves.
                const next = e.target.value.replace(/^0+(?=\d)/, "");
                setResultsLimitInput(next);
              }}
              disabled={isPending}
            />
            {hasDateRange ? (
              <p className="text-xs text-muted-foreground">
                We search up to {MAX_RESULTS_LIMIT} recent reels to cover
                your whole window, then keep only the top {resultsLimit} by
                views. Estimated cost: ~${estimatedCost} (worst case,
                free-tier rate; less on a paid Apify plan).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                How many of the creator&apos;s most recent reels to pull.
                Estimated cost: ~${estimatedCost} (worst case, free-tier
                rate; less on a paid Apify plan).
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? "Pulling reels..." : "Run analysis"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SingleReelForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analyze a single reel</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              try {
                await analyzeSingleReel(formData);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reelUrl">Reel URL</Label>
            <Input
              id="reelUrl"
              name="reelUrl"
              placeholder="https://instagram.com/reel/..."
              required
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? "Pulling reel..." : "Analyze reel"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
