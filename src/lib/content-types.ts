// Content types: tags you create to say what kind of content a reel (or an idea) is.
export type ContentType = { id: string; name: string; color: string; position: number };

export const TYPE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pink: { bg: "#FFE3F0", fg: "#D10A6E", label: "Pink" },
  lime: { bg: "#EAF8D8", fg: "#3a8a00", label: "Green" },
  blue: { bg: "#E3ECFF", fg: "#2F6BFF", label: "Blue" },
  orange: { bg: "#FFE8D6", fg: "#c25a00", label: "Orange" },
  purple: { bg: "#EFE3FF", fg: "#7a3fd1", label: "Purple" },
  teal: { bg: "#D9F5F0", fg: "#0b8a78", label: "Teal" },
  yellow: { bg: "#FFF6C2", fg: "#8a7000", label: "Yellow" },
  red: { bg: "#FFE0E0", fg: "#c0262b", label: "Red" },
  gray: { bg: "#F0F0F1", fg: "#4a4a48", label: "Gray" },
};
export const typeColor = (key: string) => TYPE_COLORS[key] ?? TYPE_COLORS.gray;
