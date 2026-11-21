import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AnalyzeForm } from "./research-forms";
import { AnalysisStatus, type AnalysisLinkRow } from "./analysis-status";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 300;

export default async function ResearchPage() {
  const supabase = await createClient();

  // Reels shared from the phone are analyzed straight away, so there is no Queue: this page shows the paste box
  // and the status of links that are working, failed (kept until dismissed), or just finished.
  const { data: linkRows } = await supabase
    .from("ct_analysis_links")
    .select("id, url, status, note, finished_at")
    .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(40);
  const recentCutoff = Date.now() - 3 * 60 * 1000;
  const analysisRows: AnalysisLinkRow[] = (linkRows ?? [])
    .filter((r) => r.status !== "done" || (r.finished_at != null && new Date(r.finished_at as string).getTime() > recentCutoff))
    .map((r) => ({ id: r.id as string, url: r.url as string, status: r.status as AnalysisLinkRow["status"], note: (r.note as string | null) ?? null }));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Analyze
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
          See what&apos;s actually working.
        </p>
      </div>

      <AnalyzeForm />

      <AnalysisStatus rows={analysisRows} />
    </PageShell>
  );
}
