import { getAllIdeas } from "@/app/idea/actions";
import { PageShell } from "@/components/ui/page-shell";
import { ScriptsListClient } from "./scripts-list-client";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const ideas = await getAllIdeas();
  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Scripts
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">
          Every idea you capture lands here. Open one to write it.
        </p>
      </div>
      <ScriptsListClient initial={ideas} />
    </PageShell>
  );
}
