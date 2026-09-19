import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ScheduleInline } from "./schedule-inline";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: ideas, error } = await supabase
    .from("ct_journal_entries")
    .select("id, content, scheduled_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load your ideas: {error.message}
        </p>
      </div>
    );
  }

  const ideaIds = (ideas ?? []).map((i) => i.id);
  const scriptByIdeaId = new Map<
    string,
    { id: string; angle: string | null; hookName: string | null }
  >();

  if (ideaIds.length > 0) {
    const { data: scripts } = await supabase
      .from("ct_scripts")
      .select("id, idea_id, angle, created_at, ct_hook_patterns(name)")
      .in("idea_id", ideaIds)
      .order("created_at", { ascending: false });

    for (const s of scripts ?? []) {
      if (!s.idea_id || scriptByIdeaId.has(s.idea_id)) continue;
      const pattern = Array.isArray(s.ct_hook_patterns) ? s.ct_hook_patterns[0] : s.ct_hook_patterns;
      scriptByIdeaId.set(s.idea_id, { id: s.id, angle: s.angle, hookName: pattern?.name ?? null });
    }
  }

  const unscripted = (ideas ?? []).filter((i) => !scriptByIdeaId.has(i.id));
  const scripted = (ideas ?? []).filter((i) => scriptByIdeaId.has(i.id));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Create</h1>
        <p className="text-sm text-muted-foreground">
          Pick an idea to turn into a script.
        </p>
      </div>

      {(!ideas || ideas.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No ideas yet — capture one on the{" "}
          <Link href="/journal" className="underline">
            Idea
          </Link>{" "}
          page first.
        </p>
      )}

      {unscripted.length > 0 && (
        <div className="flex flex-col gap-2">
          {scripted.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground">Not yet scripted</h2>
          )}
          {unscripted.map((idea) => (
            <Link
              key={idea.id}
              href={`/create/${idea.id}`}
              className="flex h-11 items-center rounded-md border px-3 text-sm hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate">
                {idea.content || <span className="text-muted-foreground">(no text)</span>}
              </span>
            </Link>
          ))}
        </div>
      )}

      {scripted.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Already scripted</h2>
          {scripted.map((idea) => {
            const script = scriptByIdeaId.get(idea.id)!;
            return (
              <Link
                key={idea.id}
                href={`/plan/${idea.id}`}
                className="flex flex-col gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="truncate">
                  {idea.content || <span className="text-muted-foreground">(no text)</span>}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {script.angle && (
                      <Badge variant="secondary" className="text-[10px]">
                        {script.angle}
                      </Badge>
                    )}
                    {script.hookName && (
                      <Badge variant="outline" className="text-[10px]">
                        {script.hookName}
                      </Badge>
                    )}
                  </div>
                  <ScheduleInline ideaId={idea.id} initialDate={idea.scheduled_date} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
