import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: ideas, error } = await supabase
    .from("ct_journal_entries")
    .select("id, content, created_at")
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
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

      <div className="flex flex-col gap-2">
        {ideas?.map((idea) => (
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
    </div>
  );
}
