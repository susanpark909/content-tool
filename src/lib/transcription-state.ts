// The transcription service reports a reel with no spoken words (text on
// screen only, music only, ...) as an error like "Couldn't get any transcript
// from this video." That isn't really a failure - there's just nothing to
// transcribe - so the app shows it as "No audio to transcribe" instead.
export function isNoAudioError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /couldn.?t get any transcript|no (audio|speech|spoken|words)|nothing to transcribe/i.test(error);
}
