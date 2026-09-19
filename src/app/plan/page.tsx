import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { PlanCard } from "./plan-card";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonthParam(month: string | undefined): { year: number; monthIndex: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function isoDate(year: number, monthIndex: number, day: number) {
  const d = new Date(year, monthIndex, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthQuery } = await searchParams;
  const { year, monthIndex } = parseMonthParam(monthQuery);

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const monthStart = isoDate(year, monthIndex, 1);
  const monthEnd = isoDate(year, monthIndex, daysInMonth);

  const prev = monthIndex === 0 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: monthIndex - 1 };
  const next = monthIndex === 11 ? { year: year + 1, monthIndex: 0 } : { year, monthIndex: monthIndex + 1 };

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select("id, content, scheduled_date, posted, ready_to_record, recorded")
    .gte("scheduled_date", monthStart)
    .lte("scheduled_date", monthEnd)
    .order("scheduled_date");

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">Couldn&apos;t load the plan: {error.message}</p>
      </div>
    );
  }

  const ideaIds = (entries ?? []).map((e) => e.id);
  const hookByIdeaId = new Map<string, string>();

  if (ideaIds.length > 0) {
    const { data: scripts } = await supabase
      .from("ct_scripts")
      .select("idea_id, created_at, ct_hook_patterns(name)")
      .in("idea_id", ideaIds)
      .order("created_at", { ascending: false });

    for (const s of scripts ?? []) {
      if (!s.idea_id || hookByIdeaId.has(s.idea_id)) continue;
      const pattern = Array.isArray(s.ct_hook_patterns) ? s.ct_hook_patterns[0] : s.ct_hook_patterns;
      if (pattern?.name) hookByIdeaId.set(s.idea_id, pattern.name);
    }
  }

  const entriesByDate = new Map<string, typeof entries>();
  for (const e of entries ?? []) {
    if (!e.scheduled_date) continue;
    const list = entriesByDate.get(e.scheduled_date) ?? [];
    list.push(e);
    entriesByDate.set(e.scheduled_date, list);
  }

  const cells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: isoDate(year, monthIndex, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });

  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const todayIso = isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plan</h1>
          <p className="text-sm text-muted-foreground">Your scheduled ideas, by day.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/plan?month=${monthParam(prev.year, prev.monthIndex)}`}
            aria-label="Previous month"
            className={buttonVariants({ size: "icon-sm", variant: "outline" })}
          >
            <ChevronLeftIcon />
          </Link>
          <span className="w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Link
            href={`/plan?month=${monthParam(next.year, next.monthIndex)}`}
            aria-label="Next month"
            className={buttonVariants({ size: "icon-sm", variant: "outline" })}
          >
            <ChevronRightIcon />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`flex min-h-28 flex-col gap-1 bg-background p-1.5 ${cell.date === todayIso ? "bg-primary/5" : ""}`}
          >
            {cell.day && (
              <>
                <span className="text-[11px] text-muted-foreground">{cell.day}</span>
                <div className="flex flex-col gap-1">
                  {(entriesByDate.get(cell.date!) ?? []).map((entry) => (
                    <PlanCard
                      key={entry.id}
                      ideaId={entry.id}
                      content={entry.content}
                      hookName={hookByIdeaId.get(entry.id) ?? null}
                      readyToRecord={entry.ready_to_record}
                      recorded={entry.recorded}
                      posted={entry.posted}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
