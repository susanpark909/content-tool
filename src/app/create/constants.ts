export const ANGLES = [
  "Contrarian",
  "Personal story",
  "Educational",
  "Mistake",
  "Myth",
  "Step-by-step",
  "Relatable rant",
  "Aspirational",
  "Hot take",
] as const;

export type Angle = (typeof ANGLES)[number];

// From the Master Plan's Post Grader spec — checked on every generated post.
export const UNIVERSAL_VOICE_RULES = [
  "Contractions always (\"don't\" not \"do not\")",
  "Active voice, short sentences",
  "Numbers as digits (\"3 tips\" not \"three tips\")",
  "No em dashes",
  "No filler words (really, very, just, basically, literally, actually)",
  "No filler openers (\"in today's world,\" \"let me tell you\")",
  "One concrete idea per post",
] as const;

export const GRADE_PASS_BAR = 7;
export const MAX_AUTO_REVISIONS = 2;
export const TARGET_PLATFORM = "Instagram";
