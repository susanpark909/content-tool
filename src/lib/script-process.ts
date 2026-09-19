import { createClient } from "@/lib/supabase/server";
import type { ScriptProcessSettings } from "@/app/create/process-actions";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function getScriptProcessSettings(): Promise<ScriptProcessSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_script_process_settings")
    .select(
      "angle_instructions, hook_instructions, framework_instructions, questions_instructions, script_instructions",
    )
    .eq("id", SETTINGS_ID)
    .single();

  if (error) throw new Error(error.message);

  return {
    angleInstructions: data.angle_instructions ?? "",
    hookInstructions: data.hook_instructions ?? "",
    frameworkInstructions: data.framework_instructions ?? "",
    questionsInstructions: data.questions_instructions ?? "",
    scriptInstructions: data.script_instructions ?? "",
  };
}
