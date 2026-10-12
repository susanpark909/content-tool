// Models the Script Lab can use, with their price per million tokens (from Anthropic's pricing page).
export type LabModel = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5" | "claude-fable-5-1";

export const LAB_MODELS: { id: LabModel; label: string; inPerM: number; outPerM: number }[] = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5 (cheapest)", inPerM: 0.1, outPerM: 0.5 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", inPerM: 2, outPerM: 10 },
  { id: "claude-opus-5-5", label: "Opus 5.5", inPerM: 4, outPerM: 20 },
  { id: "claude-fable-5-1", label: "Fable 5.1 (best)", inPerM: 10, outPerM: 50 },
];

export type LabGoal = "views" | "comments";

export const DEFAULT_RULES = `Write like a real person talking out loud to one friend. Short sentences. Everyday words. First person. Contractions are good; fragments are fine.
No hashtags, no emojis, no stage directions, no "Hey guys".
Open with the hook in the first two seconds: a specific claim, a tension or a surprising detail. Never open with a greeting or a stack of questions.
Never use these or anything like them: game-changer, unlock, dive in, in today's world, let that sink in, here's the thing, it's not about X it's about Y, imagine this, buckle up, "and that's okay", lists of three adjectives, motivational closers.
Only use specific details (numbers, names, moments) that appear in the material I give you. When a specific is missing, write [YOUR DETAIL: what goes here] instead of inventing one.
Copy the reference's structure (type of hook, the beats, their order, the pacing, the length), never its words or its examples.
About 150 to 165 words for a 60-second reel unless I say otherwise.`;

export const GOAL_GUIDE: Record<LabGoal, string> = {
  views: "The goal is VIEWS: a hook that earns the next three seconds, one clear idea, no filler, a payoff people want to watch to the end, and a short close that makes the video feel complete (so people rewatch or send it).",
  comments: "The goal is COMMENTS: a hook that takes a side or names a belief people will want to answer, a body that makes them feel something specific, and a close that asks for one easy reply (a single word or a quick opinion), tied to the topic.",
};
