import { createClient } from "@/lib/supabase/server";
import { setErrorResolved } from "./actions";

export const dynamic = "force-dynamic";

const when = (v: string) => new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Internal only: not linked anywhere. The error log and data-source health, for fixing things before anyone reports them.
export default async function InternalPage() {
  const supabase = await createClient();
  const [{ data: errors }, { data: events }] = await Promise.all([
    supabase.from("ct_error_reports").select("id, created_at, source, path, message, digest, resolved").order("resolved").order("created_at", { ascending: false }).limit(60),
    supabase.from("ct_scraper_events").select("id, created_at, operation, provider, ok, fallback, ms, error").order("created_at", { ascending: false }).limit(40),
  ]);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-6 md:px-8">
      <h1 className="text-[34px] leading-none font-black tracking-[-0.04em] md:text-[48px]">Internal</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Errors</h2>
        {(errors ?? []).length === 0 && <p className="text-sm font-medium text-[#4a4a48]">No errors logged.</p>}
        {(errors ?? []).map((e) => (
          <div key={e.id as string} className={`flex flex-col gap-1 rounded-lg border p-3 text-[13px] ${e.resolved ? "border-[#F0F0F1] bg-[#FBFBFA] text-[#6b6b69]" : "border-[#FFC2E0] bg-[#FFF0F7]"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold">
              <span>{when(e.created_at as string)}</span>
              <span>{e.source as string}</span>
              {e.path ? <span className="font-medium">{e.path as string}</span> : null}
              <form action={setErrorResolved.bind(null, e.id as string, !(e.resolved as boolean))} className="ml-auto">
                <button type="submit" className="rounded-md border border-[#E4E4E2] bg-white px-2.5 py-1 text-xs font-extrabold text-[#0D0D0D]">
                  {e.resolved ? "Reopen" : "Mark Fixed"}
                </button>
              </form>
            </div>
            <span className="font-medium break-words whitespace-pre-wrap">{e.message as string}</span>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-black">Data Source Attempts</h2>
        {(events ?? []).map((e) => (
          <div key={e.id as string} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[#F0F0F1] py-1.5 text-[13px]">
            <span className="font-bold">{when(e.created_at as string)}</span>
            <span>{e.operation as string}</span>
            <span>{e.provider as string}{e.fallback ? " (backup)" : ""}</span>
            <span className={e.ok ? "font-bold text-[#2f8f1f]" : "font-bold text-[#D10A6E]"}>{e.ok ? "worked" : "failed"}</span>
            <span className="text-[#6b6b69]">{e.ms as number} ms</span>
            {e.error ? <span className="w-full text-[12px] break-words text-[#6b6b69]">{e.error as string}</span> : null}
          </div>
        ))}
      </section>
    </div>
  );
}
