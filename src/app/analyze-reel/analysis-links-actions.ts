"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A single link that failed from the Analyze box: show it in the status list so it can be copied and tried again.
export async function recordFailedLink(url: string, note: string) {
  const supabase = await createClient();
  await supabase.from("ct_analysis_links").insert({ url, status: "error", note: note.slice(0, 300), finished_at: new Date().toISOString() });
  revalidatePath("/analyze-reel");
}

export async function dismissAnalysisLinks(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  await supabase.from("ct_analysis_links").delete().in("id", ids);
  revalidatePath("/analyze-reel");
}
