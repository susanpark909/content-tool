import { getAllIdeas } from "@/app/journal/actions";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const ideas = await getAllIdeas();
  return <CalendarView initial={ideas} />;
}
