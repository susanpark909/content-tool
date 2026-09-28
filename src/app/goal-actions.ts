"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const GOALS_ID = "00000000-0000-0000-0000-000000000001";

export type GoalFields = {
  followerGoal: number | null;
  revenueGoal: number | null;
  postingGoal: number | null;
  goalDate: string | null;
  idealClient: string;
  currentFollowers: number | null;
  currentRevenue: number | null;
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
      ideal_client: fields.idealClient || null,
      current_followers: fields.currentFollowers,
      current_revenue: fields.currentRevenue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", GOALS_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/");
}
