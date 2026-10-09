import { getAllIdeas } from "@/app/idea/actions";
import { PageShell } from "@/components/ui/page-shell";
import { ScriptsListClient } from "./scripts-list-client";
import { listBoardColumns } from "./actions";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const [ideas, columns] = await Promise.all([getAllIdeas(), listBoardColumns()]);
  return (
    <PageShell>
      <ScriptsListClient initial={ideas} initialColumns={columns} />
    </PageShell>
  );
}
