import { getScriptProcessSettings } from "@/lib/script-process";
import { ProcessForm } from "./process-form";

export const dynamic = "force-dynamic";

export default async function ScriptProcessPage() {
  const settings = await getScriptProcessSettings();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">How Scripts Get Written</h1>
        <p className="text-sm text-muted-foreground">
          This is the exact process AI follows every time it writes you a
          script — pick a hook, pick a framework, ask questions, then write.
          Edit the instructions below and every future script will follow the
          updated version.
        </p>
      </div>

      <ProcessForm key={JSON.stringify(settings)} initial={settings} />
    </div>
  );
}
