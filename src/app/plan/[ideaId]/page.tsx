import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusToggles } from "./status-toggles";
import { ScriptEditor } from "./script-editor";
import { ManualScriptForm } from "./manual-script-form";

export const dynamic = "force-dynamic";

export default async function PlanIdeaPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const { ideaId } = await params;
  const supabase = await createClient();

  const [{ data: idea, error }, { data: script }] = await Promise.all([
    supabase
      .from("ct_journal_entries")
      .select("id, content, scheduled_date, ready_to_record, recorded, posted")
      .eq("id", ideaId)
      .single(),
    supabase
      .from("ct_scripts")
      .select(
        "id, content, angle, overall_score, ct_hook_patterns(name), ct_frameworks(name)",
      )
      .eq("idea_id", ideaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !idea) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load that post: {error?.message}
        </p>
      </div>
    );
  }

  const hookPattern = script
    ? Array.isArray(script.ct_hook_patterns)
      ? script.ct_hook_patterns[0]
      : script.ct_hook_patterns
    : null;
  const framework = script
    ? Array.isArray(script.ct_frameworks)
      ? script.ct_frameworks[0]
      : script.ct_frameworks
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <BackLink fallbackHref="/plan" />

      <div>
        <h1 className="text-lg font-medium">{idea.content || "(no text)"}</h1>
        {idea.scheduled_date && (
          <p className="text-sm text-muted-foreground">
            Scheduled for{" "}
            {new Date(`${idea.scheduled_date}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      <StatusToggles
        ideaId={idea.id}
        readyToRecord={idea.ready_to_record}
        recorded={idea.recorded}
        posted={idea.posted}
      />

      {script ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {script.angle && <Badge variant="secondary">{script.angle}</Badge>}
              {hookPattern?.name && <Badge variant="outline">{hookPattern.name}</Badge>}
              {framework?.name && <Badge variant="outline">{framework.name}</Badge>}
              {script.overall_score != null && (
                <Badge variant="outline">Grade: {Number(script.overall_score).toFixed(1)}/10</Badge>
              )}
            </div>
            <ScriptEditor scriptId={script.id} initialContent={script.content} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">No script yet — paste or write it in.</p>
            <ManualScriptForm ideaId={idea.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
