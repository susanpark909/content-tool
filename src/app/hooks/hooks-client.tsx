"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { OutlierBadge } from "@/components/outlier-filter";
import { OUTLIER_COLUMN_TIP, outlierNeedsTip } from "@/lib/outlier";
import { fmtRate } from "@/lib/rates";
import { fmtN } from "@/lib/format";
import { matchesSearch } from "@/lib/search-match";

export type HookRow = {
  id: string;
  hook: string;
  owner: string | null;
  postType: string;
  views: number;
  comments: number;
  shares: number | null;
  outlier: number | null;
};

type SortKey = "views" | "comments" | "shares" | "rate" | "outlier";
const COLS = "28px minmax(260px,1fr) 150px 64px 80px 64px 100px 80px";
const PER_PAGE = 50;

const rateOf = (r: HookRow) => (r.postType !== "carousel" && r.views > 0 ? r.comments / r.views : null);

function TypeIcon({ postType }: { postType: string }) {
  const reel = postType === "reel";
  return (
    <span title={reel ? "Reel" : "Carousel"} className="flex items-center justify-center">
      {reel ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
        </svg>
      ) : (
        <MaterialIcon name="collections" size={19} className="text-[#2F6BFF]" />
      )}
    </span>
  );
}

export function HooksClient({ rows }: { rows: HookRow[] }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const list = rows.filter((r) => !q.trim() || matchesSearch(`${r.hook} ${r.owner ?? ""}`, q));
    const val = (r: HookRow) => (sortKey === "rate" ? rateOf(r) : sortKey === "outlier" ? r.outlier : sortKey === "shares" ? r.shares : sortKey === "comments" ? r.comments : r.views) ?? -Infinity;
    return list.sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
  }, [rows, q, sortKey, desc]);

  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = shown.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE);

  function sortBy(k: SortKey) {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(true);
    }
    setPage(0);
  }

  const heads: { key: SortKey; label: string; tip?: string }[] = [
    { key: "views", label: "Views" },
    { key: "comments", label: "Comments" },
    { key: "shares", label: "Shares" },
    { key: "rate", label: "Engagement", tip: "Engagement rate (comments ÷ views)" },
    { key: "outlier", label: "Outlier", tip: OUTLIER_COLUMN_TIP },
  ];

  const creator = (r: HookRow) =>
    r.owner ? (
      <a href={`https://www.instagram.com/${r.owner}/`} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-semibold text-[#4a4a48] hover:text-[#FF1F8F] hover:underline">
        @{r.owner}
      </a>
    ) : (
      <span className="text-xs font-semibold text-[#4a4a48]">—</span>
    );

  const outlier = (r: HookRow) =>
    r.outlier == null ? <span title={outlierNeedsTip(r.postType)} className="text-[#9a9a98]">—</span> : <OutlierBadge value={r.outlier} metric="views" postType={r.postType} />;

  return (
    <div className="overflow-hidden rounded-lg border border-[#E4E4E2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 md:px-6">
        <div className="relative w-full md:w-[320px]">
          <MaterialIcon name="search" size={18} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search hooks or creators"
            className="h-9 w-full rounded-md border border-[#E4E4E2] bg-white pr-3 pl-9 text-[13.5px] font-medium outline-none focus:border-[#0D0D0D]"
          />
        </div>
        <span className="text-[12.5px] font-semibold text-[#4a4a48]">{shown.length.toLocaleString("en-US")} hooks</span>
      </div>

      {/* phone: one card per hook */}
      <div className="md:hidden">
        {pageRows.map((r) => (
          <Link key={r.id} href={`/analyze-reel/reel/${r.id}`} prefetch={false} className="flex flex-col gap-1.5 border-t border-[#F0F0F1] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="pt-0.5">
                <TypeIcon postType={r.postType} />
              </span>
              <span className="text-sm font-medium text-[#0D0D0D]">{r.hook}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs font-semibold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
              <span>{r.owner ? `@${r.owner}` : "—"}</span>
              <span>{fmtN(r.views)} views</span>
              <span>{fmtN(r.comments)} comments</span>
              <span>{r.shares == null ? "—" : fmtN(r.shares)} shares</span>
              <span>{fmtRate(rateOf(r))}</span>
              {outlier(r)}
            </div>
          </Link>
        ))}
      </div>

      {/* desktop: table */}
      <div className="overflow-x-auto max-md:hidden">
        <div style={{ minWidth: 860 }}>
          <div className="grid items-center gap-2 border-y border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]" style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>Hook</span>
            <span>Creator</span>
            {heads.map((h) => (
              <button key={h.key} type="button" onClick={() => sortBy(h.key)} title={h.tip ?? h.label} className="flex items-center justify-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
                {h.label}
                {sortKey === h.key && <MaterialIcon name={desc ? "arrow_downward" : "arrow_upward"} size={13} />}
              </button>
            ))}
          </div>
          {pageRows.map((r) => (
            <div key={r.id} className="grid items-center gap-2 border-b border-[#F0F0F1] px-6 py-2.5 text-[13px] text-[#0D0D0D] [font-variant-numeric:tabular-nums] hover:bg-[#FBFBFA]" style={{ gridTemplateColumns: COLS }}>
              <TypeIcon postType={r.postType} />
              <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false} className="text-sm font-medium text-[#0D0D0D] hover:text-[#FF1F8F] hover:underline">
                {r.hook}
              </Link>
              <div className="flex min-w-0">{creator(r)}</div>
              <span className="text-center">{fmtN(r.views)}</span>
              <span className="text-center">{fmtN(r.comments)}</span>
              <span className="text-center">{r.shares == null ? "—" : fmtN(r.shares)}</span>
              <span className="text-center font-semibold">{fmtRate(rateOf(r))}</span>
              <span className="flex justify-center">{outlier(r)}</span>
            </div>
          ))}
        </div>
      </div>

      {shown.length === 0 && <p className="px-6 py-8 text-center text-sm font-medium text-[#4a4a48]">No hooks found.</p>}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 px-3 py-3 text-[12.5px] font-semibold text-[#4a4a48] md:px-6">
          <span>
            {cur * PER_PAGE + 1}–{Math.min(shown.length, cur * PER_PAGE + PER_PAGE)} of {shown.length.toLocaleString("en-US")}
          </span>
          <div className="flex gap-1.5">
            <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="flex h-8 items-center rounded-md border border-[#E4E4E2] px-3 disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="flex h-8 items-center rounded-md border border-[#E4E4E2] px-3 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
