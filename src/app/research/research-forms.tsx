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

export function ProfileResearchForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultsLimit, setResultsLimit] = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasDateRange = Boolean(dateFrom || dateTo);
  const effectiveFetch = hasDateRange ? MAX_RESULTS_LIMIT : resultsLimit;
  const estimatedCost = (effectiveFetch * APIFY_FREE_TIER_COST_PER_REEL).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Research a creator</CardTitle>
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
              {hasDateRange ? "Reels to pull (no date range)" : "Reels to pull"}
            </Label>
            <Input
              id="resultsLimit"
              name="resultsLimit"
              type="number"
              min={1}
              max={100}
              value={resultsLimit}
              onChange={(e) => setResultsLimit(Number(e.target.value) || 0)}
              disabled={isPending || hasDateRange}
            />
            {hasDateRange ? (
              <p className="text-xs text-muted-foreground">
                A date range is set, so this is ignored — we always search
                up to {MAX_RESULTS_LIMIT} of the creator&apos;s most recent
                reels to make sure your whole window gets covered, then show
                everything that falls inside it (sort the results to find
                the top performers). Estimated cost: ~${estimatedCost}{" "}
                (worst case, free-tier rate; less on a paid Apify plan).
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
            {isPending ? "Pulling reels..." : "Run research"}
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
