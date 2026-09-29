import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "./goals-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: goals, error }, { count: postsCount }] = await Promise.all([
    supabase
      .from("ct_goals")
      .select(
        "follower_goal, revenue_goal, posting_goal, goal_date, ideal_client, ideal_client_name, ideal_client_tags, current_followers, current_revenue",
      )
      .single(),
    supabase
      .from("ct_journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("posted", true),
  ]);

  if (error || !goals) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load your goals: {error?.message}
        </p>
      </div>
    );
  }

  return (
    <GoalsView
      initial={{
        followerGoal: goals.follower_goal,
        revenueGoal: goals.revenue_goal,
        postingGoal: goals.posting_goal,
        goalDate: goals.goal_date,
        currentFollowers: goals.current_followers,
        currentRevenue: goals.current_revenue,
        idealClientName: goals.ideal_client_name ?? "",
        idealClientTags: goals.ideal_client_tags ?? "",
        idealClientAbout: goals.ideal_client ?? "",
      }}
      postsMade={postsCount ?? 0}
    />
  );
}
