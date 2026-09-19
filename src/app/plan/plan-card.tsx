import Link from "next/link";
import { CircleIcon, VideoIcon, CircleCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanCard({
  ideaId,
  content,
  hookName,
  readyToRecord,
  recorded,
  posted,
}: {
  ideaId: string;
  content: string;
  hookName: string | null;
  readyToRecord: boolean;
  recorded: boolean;
  posted: boolean;
}) {
  return (
    <Link
      href={`/plan/${ideaId}`}
      className="flex flex-col gap-0.5 rounded border bg-card px-1.5 py-1 text-[11px] hover:bg-muted"
    >
      <span className="line-clamp-2 leading-tight font-medium">
        {content || "(no text)"}
      </span>
      {hookName && (
        <span className="truncate text-muted-foreground">{hookName}</span>
      )}
      <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
        <CircleIcon
          className={cn("size-2.5", readyToRecord && "fill-primary text-primary")}
        />
        <VideoIcon className={cn("size-2.5", recorded && "text-primary")} />
        <CircleCheckIcon className={cn("size-2.5", posted && "text-primary")} />
      </div>
    </Link>
  );
}
