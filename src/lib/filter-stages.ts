// Views, Engagement rate and Outlier score filters: four ready-made stages plus a custom range.
// The Library and every creator page use these, so the filters match everywhere.
export type StageKey = "all" | "s1" | "s2" | "s3" | "s4" | "custom";
type Range = [number, number];

export const VIEW_STAGES: Record<string, Range> = { s1: [0, 10_000], s2: [10_000, 100_000], s3: [100_000, 1_000_000], s4: [1_000_000, Infinity] };
export const VIEW_STAGE_OPTIONS = [
  { value: "all", label: "Any views", short: "Any" },
  { value: "s1", label: "Under 10k", short: "Under 10k" },
  { value: "s2", label: "10k to 100k", short: "10k to 100k" },
  { value: "s3", label: "100k to 1M", short: "100k to 1M" },
  { value: "s4", label: "Over 1M", short: "Over 1M" },
  { value: "custom", label: "Custom" },
];

// Engagement rate as a fraction (0.001 is 0.1%)
export const RATE_STAGES: Record<string, Range> = { s1: [0, 0.001], s2: [0.001, 0.003], s3: [0.003, 0.01], s4: [0.01, Infinity] };
export const RATE_STAGE_OPTIONS = [
  { value: "all", label: "Any rate", short: "Any" },
  { value: "s1", label: "Under 0.1%", short: "Under 0.1%" },
  { value: "s2", label: "0.1% to 0.3%", short: "0.1% to 0.3%" },
  { value: "s3", label: "0.3% to 1%", short: "0.3% to 1%" },
  { value: "s4", label: "Over 1%", short: "Over 1%" },
  { value: "custom", label: "Custom" },
];

// Outlier score: 1.0x is that creator's average
export const OUTLIER_STAGES: Record<string, Range> = { s1: [0, 1], s2: [1, 2], s3: [2, 5], s4: [5, Infinity] };
export const OUTLIER_STAGE_OPTIONS = [
  { value: "all", label: "Any score", short: "Any" },
  { value: "s1", label: "Below average (under 1x)", short: "Under 1x" },
  { value: "s2", label: "1x to 2x", short: "1x to 2x" },
  { value: "s3", label: "2x to 5x", short: "2x to 5x" },
  { value: "s4", label: "Over 5x", short: "Over 5x" },
  { value: "custom", label: "Custom" },
];

// "10k", "1.5m" and "250000" all work
export function parseCount(text: string): number | null {
  const m = text.trim().toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([km]?)$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
}
export function parsePercent(text: string): number | null {
  const n = Number(text.trim().replace(/%/g, ""));
  return text.trim() && Number.isFinite(n) ? n / 100 : null;
}
export function parseTimes(text: string): number | null {
  const n = Number(text.trim().toLowerCase().replace(/x$/, ""));
  return text.trim() && Number.isFinite(n) ? n : null;
}

// Custom only counts once you've typed a number in; an empty Custom filters nothing.
export function stageActive(stage: StageKey, min: number | null, max: number | null) {
  return stage !== "all" && (stage !== "custom" || min != null || max != null);
}

// The [from, up to] range this filter means, or null when it is off.
export function stageBounds(stage: StageKey, table: Record<string, Range>, min: number | null, max: number | null): Range | null {
  if (!stageActive(stage, min, max)) return null;
  return stage === "custom" ? [min ?? 0, max ?? Infinity] : table[stage];
}
