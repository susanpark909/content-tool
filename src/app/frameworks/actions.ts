"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createFramework(name: string, description: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_frameworks")
    .insert({ name, description });

  if (error) throw new Error(error.message);
  revalidatePath("/frameworks");
}

export async function updateFramework(
  frameworkId: string,
  name: string,
  description: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_frameworks")
    .update({ name, description })
    .eq("id", frameworkId);

  if (error) throw new Error(error.message);
  revalidatePath("/frameworks");
}

export async function deleteFramework(frameworkId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_frameworks")
    .delete()
    .eq("id", frameworkId);

  if (error) throw new Error(error.message);
  revalidatePath("/frameworks");
}

export async function deleteFrameworkExample(exampleId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_framework_examples")
    .delete()
    .eq("id", exampleId);

  if (error) throw new Error(error.message);
  revalidatePath("/frameworks");
}
