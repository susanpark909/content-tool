"use server";

import { createClient } from "@/lib/supabase/server";

// The Script Lab's saved bits (your writing rules and voice samples), kept in the database so they follow
// you from your phone to your computer and survive clearing the browser.
export async function saveLabSetting(key: "rules" | "voice", value: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_lab_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
