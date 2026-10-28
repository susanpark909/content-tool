// How long a script takes to say out loud. One rule for every page that shows it.
// Calibrated on Susan's own delivery (120 words took 47 seconds, 250 words took 80 seconds: about 175 words a minute across both, pauses included).
export const WORDS_PER_MINUTE = 175;

export function narrationSeconds(words: number): number {
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}
