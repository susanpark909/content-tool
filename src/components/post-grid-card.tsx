import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { fmtLen, fmtN } from "@/lib/format";

// The one grid card for a post, used by the Library and by every creator's page, so both look exactly the same:
// cover, views and comments on the picture, length in the corner (or the carousel icon), a checkbox, and the creator below.
export function PostGridCard({
  href,
  thumbnailUrl,
  postType,
  views,
  comments,
  durationSeconds,
  creator,
  selected,
  onToggle,
  analyzing = false,
}: {
  href: string;
  thumbnailUrl: string | null;
  postType: string;
  views: number;
  comments: number;
  durationSeconds: number | null;
  creator: string | null;
  selected: boolean;
  onToggle: () => void;
  analyzing?: boolean;
}) {
  const carousel = postType === "carousel";
  return (
    <div className="relative flex flex-col gap-2">
      <Link href={href} prefetch={false} className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-[#2b2b29]">
        <ReelCover url={thumbnailUrl} iconSize={34} showPlay={!carousel} />
        <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md bg-black/65 px-2 py-1 text-[13px] font-bold text-white">
          {!carousel && (
            <span className="flex items-center gap-1" title="Views">
              <MaterialIcon name="visibility" size={16} weight={500} />
              {fmtN(views)}
            </span>
          )}
          <span className="flex items-center gap-1" title="Comments">
            <MaterialIcon name="comment" size={16} weight={500} />
            {fmtN(comments)}
          </span>
        </span>
        {carousel ? (
          <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md bg-black/65 text-white">
            <MaterialIcon name="collections" size={18} weight={500} />
          </span>
        ) : durationSeconds ? (
          <span className="absolute top-2 right-2 flex h-8 items-center rounded-md bg-black/65 px-2 text-[13px] font-bold text-white">{fmtLen(durationSeconds)}</span>
        ) : null}
        {analyzing && (
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 text-[12.5px] font-extrabold text-[#FF1F8F]">
            <EqualizerIcon size={26} /> Analyzing
          </span>
        )}
      </Link>
      <button type="button" onClick={onToggle} aria-label="Select post" className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-md bg-white/90">
        <span className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: selected ? "#0D0D0D" : "#FFFFFF", borderColor: selected ? "#0D0D0D" : "#BDBDBB" }}>
          {selected && <MaterialIcon name="check" size={12} className="text-white" />}
        </span>
      </button>
      <div className="flex flex-col gap-0.5 text-[14px] leading-snug">
        <span className="font-extrabold break-words">{creator ? "@" + creator : "Unknown"}</span>
      </div>
    </div>
  );
}
