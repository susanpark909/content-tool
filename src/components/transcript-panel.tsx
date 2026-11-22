import { toParagraphs } from "@/lib/transcript-paragraphs";

// The full transcript, opened under a row. `text` is undefined while it loads and null when the post has none.
export function TranscriptPanel({ text }: { text: string | null | undefined }) {
  return (
    <div className="max-h-[340px] overflow-y-auto rounded-md border border-[#E4E4E2] bg-[#FBFBFA] px-3.5 py-3 text-[13px] leading-[1.55] font-normal text-[#0D0D0D]">
      {text === undefined ? (
        <span className="font-medium text-[#6b6b69]">Loading transcript…</span>
      ) : text === null ? (
        <span className="font-medium text-[#6b6b69]">No transcript for this post.</span>
      ) : (
        toParagraphs(text).map((p, i) => (
          <p key={i} className={i > 0 ? "mt-2.5" : ""}>
            {p}
          </p>
        ))
      )}
    </div>
  );
}

export function ExpandButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? "Hide transcript" : "Show transcript"}
      aria-label={open ? "Hide transcript" : "Show transcript"}
      aria-expanded={open}
      className="flex size-6 flex-none items-center justify-center rounded-full text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#FF1F8F]"
    >
      <span className="msym select-none" style={{ fontSize: 20, fontVariationSettings: "'wght' 500" }}>
        {open ? "expand_less" : "expand_more"}
      </span>
    </button>
  );
}
