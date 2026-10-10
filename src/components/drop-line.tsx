// The neon-yellow line that shows where a dragged card or note will land.
export function DropLine() {
  return (
    <div className="pointer-events-none relative -my-1.5 flex items-center" aria-hidden="true">
      <span className="size-2 flex-none rounded-full bg-[#E6FF00] shadow-[0_0_0_1px_rgba(13,13,13,0.18),0_0_8px_rgba(230,255,0,0.9)]" />
      <span className="h-[2px] flex-1 rounded-full bg-[#E6FF00] shadow-[0_0_0_0.5px_rgba(13,13,13,0.18),0_0_8px_rgba(230,255,0,0.8)]" />
      <span className="size-2 flex-none rounded-full bg-[#E6FF00] shadow-[0_0_0_1px_rgba(13,13,13,0.18),0_0_8px_rgba(230,255,0,0.9)]" />
    </div>
  );
}
