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
