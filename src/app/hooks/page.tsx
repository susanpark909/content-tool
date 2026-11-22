import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { loadOutlierScorer } from "@/lib/creator-typicals";
import { PageShell } from "@/components/ui/page-shell";
import { HooksClient, type HookRow } from "./hooks-client";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const supabase = await createClient();
  const scoreOf = await loadOutlierScorer(supabase);
  const { data, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("id, hook_text, owner_username, owner_avatar_url, post_type, views, likes, comments_count, shares_count")
      .eq("scan_only", false)
      .not("hook_text", "is", null)
      .neq("hook_text", "")
      .order("id")
      .range(from, to),
  );

  const rows: HookRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    hook: ((r.hook_text as string) ?? "").replace(/\s+/g, " ").trim(),
    owner: (r.owner_username as string | null) ?? null,
    postType: (r.post_type as string) ?? "reel",
    views: (r.views as number | null) ?? 0,
    comments: (r.comments_count as number | null) ?? 0,
    shares: (r.shares_count as number | null) ?? null,
    outlier: scoreOf(r.owner_username as string | null, { postType: r.post_type as string | null, views: r.views as number | null, comments: r.comments_count as number | null, shares: r.shares_count as number | null }).views ?? null,
  }));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em] capitalize">
          Hooks
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">The opening line of every post you've analyzed.</p>
      </div>
      {error && <p className="text-sm text-destructive">Couldn&apos;t load hooks: {error.message}</p>}
      <HooksClient rows={rows} />
    </PageShell>
  );
}
