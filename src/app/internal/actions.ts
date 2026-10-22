"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setErrorResolved(id: string, resolved: boolean) {
  const supabase = await createClient();
  await supabase.from("ct_error_reports").update({ resolved }).eq("id", id);
  revalidatePath("/internal");
}
