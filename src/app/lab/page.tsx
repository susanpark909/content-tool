import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { LabClient, type LabReel } from "./lab-client";

export const dynamic = "force-dynamic";

// A private test bench for the AI script writing. Not in the menu: open it at /lab.
export default async function LabPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ct_reels")
    .select("id, owner_username, views, comments_count, hook_text, caption")
    .eq("scan_only", false)
    .not("transcript", "is", null)
    .order("views", { ascending: false })
    .limit(300);
  const { data: saved } = await supabase.from("ct_lab_settings").select("key, value");
  const setting = (k: string) => (saved ?? []).find((s) => s.key === k)?.value as string | undefined;
  const reels: LabReel[] = (data ?? []).map((r) => ({
    id: r.id as string,
    owner: (r.owner_username as string | null) ?? null,
    views: (r.views as number) ?? 0,
    comments: (r.comments_count as number) ?? 0,
    hook: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim().slice(0, 70),
  }));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Script Lab
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
      </div>
      <LabClient reels={reels} initialRules={setting("rules") ?? ""} initialVoice={setting("voice") ?? ""} />
    </PageShell>
  );
}
