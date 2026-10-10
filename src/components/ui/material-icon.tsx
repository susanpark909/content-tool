import { cn } from "@/lib/utils";

export function MaterialIcon({
  name,
  size = 20,
  weight = 300,
  className,
}: {
  name: string;
  size?: number;
  weight?: 300 | 400 | 500;
  className?: string;
}) {
  // Every "goal" icon in the app is the bullseye with the arrow shooting up.
  if (name === "target") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={weight >= 500 ? 2.2 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("inline-block flex-none select-none", className)}
        aria-hidden="true"
      >
        <circle cx="11" cy="13" r="8" />
        <circle cx="11" cy="13" r="4" />
        <path d="M11 13 20.5 3.5" />
        <path d="M16.5 3.5h4v4" />
      </svg>
    );
  }
  return (
    <span
      className={cn("msym select-none", className)}
      style={{ fontSize: size, fontVariationSettings: `'wght' ${weight}` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
