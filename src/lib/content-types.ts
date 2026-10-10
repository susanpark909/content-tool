// Content types: tags you create to say what kind of content a reel (or an idea) is.
export type ContentType = { id: string; name: string; color: string; position: number };

// Colors to pick from (and you can choose any color you like).
export const SWATCHES = [
  "#FF8A3D", "#FF5CA8", "#4C8DFF", "#FF5A5F", "#19B3A6",
  "#5CC83A", "#9B6CFF", "#E8B800", "#6B7A99", "#A8D800",
  "#00B8D9", "#D96FF8", "#8A5A3C", "#2E2E2C", "#BDBDBB",
];

// Older tags saved a color name. These still work.
const LEGACY: Record<string, string> = {
  pink: "#FF5CA8", lime: "#5CC83A", blue: "#4C8DFF", orange: "#FF8A3D", purple: "#9B6CFF", teal: "#19B3A6", yellow: "#E8B800", red: "#FF5A5F", gray: "#6B7A99",
};

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [107, 122, 153] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, to: [number, number, number], t: number) {
  const c = rgb(hex);
  const m = c.map((v, i) => Math.round(v * (1 - t) + to[i] * t));
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Any color becomes a soft tinted chip with readable text.
export function typeColor(color: string): { bg: string; fg: string } {
  const base = color.startsWith("#") ? color : (LEGACY[color] ?? "#6B7A99");
  return { bg: mix(base, [255, 255, 255], 0.84), fg: mix(base, [0, 0, 0], 0.4) };
}
