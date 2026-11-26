import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { VideosClient, type VideoRow } from "./videos-client";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("ct_videos").select("id, name, path, size_bytes, created_at").order("created_at", { ascending: false });
  const videos: VideoRow[] = (data ?? []).map((v) => ({ id: v.id as string, name: v.name as string, path: v.path as string, size: Number(v.size_bytes), createdAt: v.created_at as string }));
  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Videos
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Upload a video from your phone and download it back exactly as it was, with no quality lost.</p>
      </div>
      <VideosClient initial={videos} />
    </PageShell>
  );
}
