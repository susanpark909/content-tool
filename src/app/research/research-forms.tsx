"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runProfileResearch, analyzeSingleReel } from "./actions";

export function ProfileResearchForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sortMetric">Sort metric</Label>
              <Select name="sortMetric" defaultValue="views">
                <SelectTrigger id="sortMetric" disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">Views</SelectItem>
                  <SelectItem value="likes">Likes</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                name="dateFrom"
                type="date"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateTo">To</Label>
              <Input id="dateTo" name="dateTo" type="date" disabled={isPending} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-48">
            <Label htmlFor="resultsLimit">Number of posts</Label>
            <Input
              id="resultsLimit"
              name="resultsLimit"
              type="number"
              min={1}
              max={50}
              defaultValue={12}
              disabled={isPending}
            />
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
