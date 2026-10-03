import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "./goals-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: goals, error } = await supabase
    .from("ct_goals")
    .select(
      "progress_reset_at, follower_goal, revenue_goal, posting_goal, goal_date, ideal_client, ideal_client_name, ideal_client_tags, current_followers, current_revenue, ideal_client_pain_points, ideal_client_desires, ideal_client_topics",
    )
    .single();

  // Posts count toward the goal only if posted after the last progress reset.
  let postsQuery = supabase
    .from("ct_journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("posted", true);
  if (goals?.progress_reset_at) postsQuery = postsQuery.gte("posted_at", goals.progress_reset_at);
  const { count: postsCount } = await postsQuery;

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
        idealClientPainPoints: goals.ideal_client_pain_points ?? [],
        idealClientDesires: goals.ideal_client_desires ?? [],
        idealClientTopics: goals.ideal_client_topics ?? [],
      }}
      postsMade={postsCount ?? 0}
    />
  );
}
