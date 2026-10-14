"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "Remake This Winner": starts a new script idea from the reel's opening, ready to open in the script writer.
export async function remakeWinner(caption: string | null): Promise<{ id: string }> {
  const flat = (caption ?? "").replace(/\s+/g, " ").trim();
  const first = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat.slice(0, 140);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_journal_entries")
    .insert({ content: `Remake: ${first || "my top reel"}`.slice(0, 200), is_draft: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/scripts", "layout");
  revalidatePath("/calendar");
  return { id: data.id as string };
}
