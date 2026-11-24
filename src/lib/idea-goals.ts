// The goal of a piece of content, picked once here and used by every screen (script page, ideas, scripts list, calendar).
export type IdeaGoal = "attract" | "nurture" | "sell";

export const IDEA_GOALS: { key: IdeaGoal; label: string; icon: string; meaning: string }[] = [
  { key: "attract", label: "Attract & Grow", icon: "trending_up", meaning: "Broad topics meant to get eyeballs. These are posts people share, so they bring in views and new followers." },
  { key: "nurture", label: "Nurture", icon: "favorite", meaning: "Posts that educate and get saved. People watch and think, I love what she's talking about, and they save it to come back to." },
  { key: "sell", label: "Sell", icon: "sell", meaning: "Posts built for comments. You ask them to comment a keyword or DM you, so they take the next step to buy from you." },
];

export const GOAL_META: Record<IdeaGoal, { label: string; icon: string }> = {
  attract: { label: "Attract & Grow", icon: "trending_up" },
  nurture: { label: "Nurture", icon: "favorite" },
  sell: { label: "Sell", icon: "sell" },
};
