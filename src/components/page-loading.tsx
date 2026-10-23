import { PageShell } from "@/components/ui/page-shell";

// Shown the instant you tap a link, while the next page is fetched, so the app responds right away instead of looking frozen.
export function PageLoading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading">
        <div className="h-9 w-1/2 rounded bg-[#E4E4E2] md:h-14 md:w-1/3" />
        <div className="h-4 w-2/3 rounded bg-[#EDEDEB] md:w-1/3" />
        <div className="mt-2 h-24 rounded-lg bg-[#EDEDEB]" />
        <div className="h-14 rounded-lg bg-[#EDEDEB]" />
        <div className="flex flex-col gap-2">
          <div className="h-20 rounded-lg bg-[#F1F1EF]" />
          <div className="h-20 rounded-lg bg-[#F1F1EF]" />
          <div className="h-20 rounded-lg bg-[#F1F1EF]" />
          <div className="h-20 rounded-lg bg-[#F1F1EF]" />
        </div>
      </div>
    </PageShell>
  );
}
