// The one list of analysis states, with their icon, colors and plain-English message.
// The Library and every creator page use it, so a post looks and reads the same wherever you see it.
export type TsMeta = { label: string; bg: string; fg: string; icon: string; rank: number };

export const TS_META: Record<string, TsMeta> = {
  ready: { label: "Analyzed", bg: "#C6FF3D", fg: "#0D0D0D", icon: "check", rank: 2 },
  processing: { label: "Analyzing", bg: "#FFD9EB", fg: "#FF1F8F", icon: "graphic_eq", rank: 1 },
  error: { label: "Couldn't analyze this reel", bg: "#F0F0F1", fg: "#6b6b69", icon: "block", rank: 1 },
};
export const TS_NONE: TsMeta = { label: "Not analyzed yet", bg: "#F0F0F1", fg: "#9a9a98", icon: "remove", rank: 0 };
// A reel with no spoken words isn't an error - it just has nothing to transcribe.
export const TS_NO_AUDIO: TsMeta = { label: "No audio to analyze", bg: "#F0F0F1", fg: "#6b6b69", icon: "volume_off", rank: 0 };

export function tsMeta(status: string | null): TsMeta {
  return (status && TS_META[status]) || TS_NONE;
}

export function tsMetaFor(r: { transcriptionStatus: string | null; noAudio: boolean }): TsMeta {
  return r.noAudio ? TS_NO_AUDIO : tsMeta(r.transcriptionStatus);
}
