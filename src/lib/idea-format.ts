// The formats an idea can have. One list for every page that shows or sets it.
export type IdeaFormat = "reel" | "carousel" | "broll" | "text";

export const IDEA_FORMATS: { key: IdeaFormat; label: string; icon: string }[] = [
  { key: "reel", label: "Reel", icon: "smart_display" },
  { key: "carousel", label: "Carousel", icon: "collections" },
  { key: "broll", label: "B-Roll + Text", icon: "movie" },
  { key: "text", label: "Text", icon: "text_fields" },
];

export function asIdeaFormat(v: string | null | undefined): IdeaFormat {
  return IDEA_FORMATS.some((f) => f.key === v) ? (v as IdeaFormat) : "reel";
}
export const formatLabel = (v: string | null | undefined) => IDEA_FORMATS.find((f) => f.key === v)?.label ?? "Reel";
export const formatIcon = (v: string | null | undefined) => IDEA_FORMATS.find((f) => f.key === v)?.icon ?? "smart_display";
