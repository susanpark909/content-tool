import Link from "next/link";
import { getAllIdeas } from "@/app/idea/actions";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";

export const dynamic = "force-dynamic";

function narration(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (!words) return null;
  const sec = Math.round((words / 220) * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default async function ScriptsPage() {
  const ideas = await getAllIdeas();
  const list = ideas
    .map((i) => ({ ...i, script: [i.hook, i.body, i.cta].filter((t) => t.trim()).join("\n\n") }))
    .filter((i) => i.script.trim())
    .sort((a, b) => ((b.scriptUpdatedAt ?? "") > (a.scriptUpdatedAt ?? "") ? 1 : -1));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Scripts
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Everything you&apos;ve written, in one place.</p>
      </div>
      <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        {list.length === 0 && <div className="px-5 py-10 text-center text-sm font-medium text-[#4a4a48]">No scripts yet. Open an idea to start writing.</div>}
        {list.map((i) => (
          <Link key={i.id} href={`/scripts/${i.id}`} className="flex items-center gap-3 border-b border-[#F0F0F1] px-4 py-3 last:border-b-0 hover:bg-[#FBFBFA] md:px-5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14.5px] font-bold">{i.text || "(no text)"}</span>
              <span className="line-clamp-1 text-[12.5px] font-medium text-[#4a4a48]">{i.script}</span>
            </div>
            {narration(i.script) && (
              <span className="flex flex-none items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11.5px] font-bold">
                <MaterialIcon name="schedule" size={12} /> {narration(i.script)}
              </span>
            )}
            <MaterialIcon name="chevron_right" size={20} className="flex-none text-[#4a4a48]" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
