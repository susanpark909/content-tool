import { getAllIdeas } from "@/app/idea/actions";
import { PageShell } from "@/components/ui/page-shell";
import { ScriptsListClient } from "./scripts-list-client";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const ideas = await getAllIdeas();
  return (
    <PageShell>
      <ScriptsListClient initial={ideas} />
    </PageShell>
  );
}
