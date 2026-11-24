// The goal of a piece of content, picked once here and used by every screen (script page, ideas, scripts list, calendar).
export type IdeaGoal = "attract" | "nurture" | "sell";

export const IDEA_GOALS: { key: IdeaGoal; label: string; icon: string }[] = [
  { key: "attract", label: "Attract & Grow", icon: "trending_up" },
  { key: "nurture", label: "Nurture", icon: "favorite" },
  { key: "sell", label: "Sell", icon: "sell" },
];

export const GOAL_META: Record<IdeaGoal, { label: string; icon: string }> = {
  attract: { label: "Attract & Grow", icon: "trending_up" },
  nurture: { label: "Nurture", icon: "favorite" },
  sell: { label: "Sell", icon: "sell" },
};
