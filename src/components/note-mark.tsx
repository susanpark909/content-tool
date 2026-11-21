import { MaterialIcon } from "@/components/ui/material-icon";

// Shows whether a reel has a "Why I Saved It" note: a filled circle with the note icon when it does (hover for the note),
// an empty dashed circle when it doesn't. The note itself is read and edited on the reel page.
export function NoteMark({ note }: { note: string | null }) {
  return note ? (
    <span title={note} aria-label={`Note: ${note}`} className="flex size-7 items-center justify-center rounded-full bg-[#F0F0F1] text-[#0D0D0D]">
      <MaterialIcon name="edit_note" size={18} weight={500} />
    </span>
  ) : (
    <span aria-label="No note" className="flex size-7 items-center justify-center rounded-full border border-dashed border-[#E4E4E2] text-[#C9C9C7]">
      <MaterialIcon name="edit_note" size={16} />
    </span>
  );
}
