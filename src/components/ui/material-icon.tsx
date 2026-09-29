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
