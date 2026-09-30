"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const GOALS_ID = "00000000-0000-0000-0000-000000000001";

export type GoalFields = {
  followerGoal: number | null;
  revenueGoal: number | null;
  postingGoal: number | null;
  goalDate: string | null;
  currentFollowers: number | null;
  currentRevenue: number | null;
  idealClientName: string;
  idealClientTags: string;
  idealClientAbout: string;
  idealClientPainPoints: string[];
  idealClientDesires: string[];
  idealClientTopics: string[];
};

export async function saveGoals(fields: GoalFields) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_goals")
    .update({
      follower_goal: fields.followerGoal,
      revenue_goal: fields.revenueGoal,
      posting_goal: fields.postingGoal,
      goal_date: fields.goalDate,
      current_followers: fields.currentFollowers,
      current_revenue: fields.currentRevenue,
      ideal_client_name: fields.idealClientName || null,
      ideal_client_tags: fields.idealClientTags || null,
      ideal_client: fields.idealClientAbout || null,
      ideal_client_pain_points: fields.idealClientPainPoints.filter(Boolean),
      ideal_client_desires: fields.idealClientDesires.filter(Boolean),
      ideal_client_topics: fields.idealClientTopics.filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq("id", GOALS_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/");
}
