import { getAllIdeas } from "./actions";
import { IdeaTable } from "./idea-table";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const ideas = await getAllIdeas();
  return <IdeaTable initial={ideas} />;
}
