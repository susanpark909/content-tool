"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { AddToQueue, QueueClient, type QueueRow } from "./queue-client";

export type PulledReel = {
  id: string;
  caption: string | null;
  views: number;
  commentsCount: number;
  sharesCount: number | null;
};

export function ResearchResults({ queueRows }: { queueRows: QueueRow[] }) {
  return (
    <>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="min-w-0 flex-1 max-md:basis-full rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:min-w-[420px] md:p-5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5 md:mb-3.5">
            <span className="text-xl font-black tracking-[-0.02em] md:text-2xl">Queue</span>
            <span className="flex size-[26px] items-center justify-center rounded-full bg-[#0D0D0D] text-[12.5px] font-extrabold text-[#E6FF00]">
              {queueRows.length}
            </span>
            <span className="text-xs font-medium text-[#4a4a48]">Shared from your phone or added here</span>
          </div>
          <AddToQueue />
          {queueRows.length === 0 ? (
            <div className="flex items-center gap-2.5 py-1.5 text-[13px] font-medium text-[#4a4a48] md:py-2.5 md:text-[13.5px]">
              <MaterialIcon name="inbox" size={22} />
              Nothing waiting. Reels you share from Instagram land here.
            </div>
          ) : (
            <QueueClient key={queueRows.map((r) => r.id).join(",")} rows={queueRows} />
          )}
        </div>

      </div>
    </>
  );
}
