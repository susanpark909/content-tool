import { PageShell } from "@/components/ui/page-shell";

// Shown instantly while the script page loads, so opening an idea feels immediate.
export default function Loading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-4 w-28 rounded bg-[#E4E4E2]" />
        <div className="h-9 w-2/3 rounded bg-[#E4E4E2]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)] md:gap-6">
          <div className="h-[340px] rounded-lg bg-[#EDEDEB]" />
          <div className="flex flex-col gap-3.5">
            <div className="h-12 rounded-lg bg-[#EDEDEB]" />
            <div className="h-[360px] rounded-lg bg-[#EDEDEB]" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
