// Models the Script Lab can use, with their price per million tokens (from Anthropic's pricing page).
export type LabModel = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5" | "claude-fable-5-1";

export const LAB_MODELS: { id: LabModel; label: string; inPerM: number; outPerM: number }[] = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5 (cheapest)", inPerM: 0.1, outPerM: 0.5 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", inPerM: 2, outPerM: 10 },
  { id: "claude-opus-5-5", label: "Opus 5.5", inPerM: 4, outPerM: 20 },
  { id: "claude-fable-5-1", label: "Fable 5.1 (best)", inPerM: 10, outPerM: 50 },
];

export type LabGoal = "views" | "comments";

// The standing instructions the chat follows for everything it says and writes. The chat itself can sharpen
// these when you give it feedback ("you're over explaining"), and they are saved.
export const DEFAULT_RULES = `HOW TO TALK TO ME
Be brief and plain. Say each thing once. No filler, no recap, no restating what I just said, no long lead-ins. Never explain something I would already know.

HOW TO ANALYZE A REEL
Look at it as a viral creator through a psychological lens. Only say what most people miss. Never give a generic reason (good hook, relatable, valuable, storytelling, "it asked for comments"). Name the real mechanism and tie it to the exact words.
For comments: never credit the call to action. Find what in the post made people feel "I need to say something": the thing they saw themselves in, a belief they had to defend or correct, something they were dying to confess or add.

HOW TO WRITE THE SCRIPT
Write like a real person talking out loud to one friend. Short sentences. Everyday words. First person. Contractions are good; fragments are fine.
No hashtags, no emojis, no stage directions, no "Hey guys".
Open with the hook in the first two seconds: a specific claim, a tension or a surprising detail. Never open with a greeting or a stack of questions.
Never use these or anything like them: game-changer, unlock, dive in, in today's world, let that sink in, here's the thing, it's not about X it's about Y, imagine this, buckle up, "and that's okay", lists of three adjectives, motivational closers.
Only use specific details (numbers, names, moments) that I gave you. When one is missing, write [YOUR DETAIL: what goes here] instead of inventing it.
Mirror the reference script closely: the same beats in the same order, the same rhythm and sentence shapes, the same length. Replace its content with my story and details.
Match the reference reel's length: within about 15 seconds either way, never a different size.`;

export const GOAL_GUIDE: Record<LabGoal, string> = {
  views: "The goal is VIEWS: a hook that earns the next three seconds, one clear idea, no filler, a payoff people want to watch to the end, and a close that makes the video feel complete (so people rewatch or send it).",
  comments: "The goal is COMMENTS: a hook that takes a side or names a belief people will want to answer, a body that makes them feel something specific, and a close tied to the topic that makes replying feel easy. The comments come from what in the post made people need to respond, not from the closing ask.",
};
