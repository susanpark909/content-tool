import { createClient } from "@/lib/supabase/client";

export type UploadedAttachment = {
  url: string;
  type: string;
  name: string;
};

export async function uploadJournalAttachment(
  file: File,
): Promise<UploadedAttachment> {
  const supabase = createClient();
  const path = `${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage
    .from("idea-journal-attachments")
    .upload(path, file, { contentType: file.type || undefined });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("idea-journal-attachments").getPublicUrl(path);

  return { url: publicUrl, type: file.type || "application/octet-stream", name: file.name };
}
