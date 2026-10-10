// Custom line icons for the All Reels selection bar (same 2px rounded stroke
// style as the Material icons used elsewhere).

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function AddToBoardIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <defs>
        <mask id="add-board-cut">
          <rect width="24" height="24" fill="white" />
          <rect x="13" y="13" width="11" height="11" fill="black" />
        </mask>
      </defs>
      <g mask="url(#add-board-cut)">
        <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
        <path d="M3 8.5h18" />
        <path d="M9 8.5v12" />
      </g>
      <path d="M18.5 14v7M15 17.5h7" />
    </svg>
  );
}

export function GoalIcon({ size }: { size?: number }) {
  return (
    <svg {...base} {...(size ? { width: size, height: size } : {})} aria-hidden="true">
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="4" />
      <path d="M11 13 20.5 3.5" />
      <path d="M16.5 3.5h4v4" />
    </svg>
  );
}
