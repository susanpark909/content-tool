import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { ScriptWizard } from "./script-wizard";

export const dynamic = "force-dynamic";

export default async function CreateIdeaPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const { ideaId } = await params;
  const supabase = await createClient();
  const { data: idea, error } = await supabase
    .from("ct_journal_entries")
    .select("id, content")
    .eq("id", ideaId)
    .single();

  if (error || !idea) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load that idea: {error?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <BackLink fallbackHref="/create" />
      <div>
        <h1 className="text-lg font-medium">{idea.content}</h1>
      </div>
      <ScriptWizard ideaId={idea.id} />
    </div>
  );
}
