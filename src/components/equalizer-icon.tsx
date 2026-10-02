// Moving sound-bars icon: shows that a transcription is running.
export function EqualizerIcon({ size = 16 }: { size?: number }) {
  const delays = [0, 0.25, 0.1, 0.4, 0.15];
  return (
    <span className="flex items-center justify-center gap-[2px]" style={{ height: size, width: size + 2 }} aria-label="Transcribing">
      {delays.map((d, i) => (
        <span
          key={i}
          className="h-full w-[2px] origin-center rounded-full bg-current"
          style={{ animation: `vh-eq 0.9s ease-in-out ${d}s infinite` }}
        />
      ))}
    </span>
  );
}
