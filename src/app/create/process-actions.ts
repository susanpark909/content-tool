"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export type ScriptProcessSettings = {
  angleInstructions: string;
  frameworkInstructions: string;
  questionsInstructions: string;
  scriptInstructions: string;
  hookInstructions: string;
};

export async function saveScriptProcessSettings(
  fields: ScriptProcessSettings,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_script_process_settings")
    .update({
      angle_instructions: fields.angleInstructions || null,
      framework_instructions: fields.frameworkInstructions || null,
      questions_instructions: fields.questionsInstructions || null,
      script_instructions: fields.scriptInstructions || null,
      hook_instructions: fields.hookInstructions || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", SETTINGS_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/create/process");
}
