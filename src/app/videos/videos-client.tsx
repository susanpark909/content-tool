"use client";

import { useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/ui/material-icon";
import { fmtShortDate } from "@/lib/format";

export type VideoRow = { id: string; name: string; path: string; size: number; createdAt: string };

function fmtSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// Large files go up in 6 MB pieces that can resume if the connection drops, straight to storage, untouched.
function storageEndpoint() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.replace(/^(https:\/\/[a-z0-9]+)\.supabase\.co/, "$1.storage.supabase.co") + "/storage/v1/upload/resumable";
}

export function VideosClient({ initial }: { initial: VideoRow[] }) {
  const [videos, setVideos] = useState(initial);
  const [progress, setProgress] = useState<{ name: string; pct: number; left: number } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File, left: number) {
    const supabase = createClient();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("You're signed out. Sign in again and retry.");
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "mov";
    const path = `${crypto.randomUUID()}.${ext}`;
    await new Promise<void>((resolve, reject) => {
      const up = new Upload(file, {
        endpoint: storageEndpoint(),
        retryDelays: [0, 2000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: { bucketName: "videos", objectName: path, contentType: file.type || "video/quicktime", cacheControl: "3600" },
        chunkSize: 6 * 1024 * 1024,
        onError: (e) => reject(new Error(/exceeded|too large|413/i.test(String(e)) ? "That file is bigger than the upload limit set in Supabase. Raise it in Storage settings." : String(e.message || e))),
        onProgress: (sent, total) => setProgress({ name: file.name, pct: Math.round((sent / total) * 100), left }),
        onSuccess: () => resolve(),
      });
      up.findPreviousUploads().then((prev) => {
        if (prev.length) up.resumeFromPreviousUpload(prev[0]);
        up.start();
      });
    });
    const { data, error: e } = await supabase.from("ct_videos").insert({ name: file.name, path, size_bytes: file.size, mime_type: file.type || null }).select("id, name, path, size_bytes, created_at").single();
    if (e || !data) throw new Error(e?.message ?? "Uploaded, but couldn't save it to the list.");
    setVideos((v) => [{ id: data.id, name: data.name, path: data.path, size: Number(data.size_bytes), createdAt: data.created_at }, ...v]);
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const list = Array.from(files);
    try {
      for (let i = 0; i < list.length; i++) await uploadOne(list[i], list.length - i - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(v: VideoRow) {
    setBusyId(v.id);
    setError("");
    const { data, error: e } = await createClient().storage.from("videos").createSignedUrl(v.path, 3600, { download: v.name });
    setBusyId(null);
    if (e || !data) return setError(e?.message ?? "Couldn't make a download link.");
    window.location.href = data.signedUrl;
  }

  async function remove(v: VideoRow) {
    if (!window.confirm(`Delete "${v.name}" for good? This can't be undone.`)) return;
    setBusyId(v.id);
    setError("");
    const supabase = createClient();
    const { error: e1 } = await supabase.storage.from("videos").remove([v.path]);
    const { error: e2 } = e1 ? { error: null } : await supabase.from("ct_videos").delete().eq("id", v.id);
    setBusyId(null);
    if (e1 || e2) return setError((e1 ?? e2)!.message);
    setVideos((list) => list.filter((x) => x.id !== v.id));
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept="video/*,.mov,.mp4,.m4v" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
      <button
        type="button"
        disabled={!!progress}
        onClick={() => inputRef.current?.click()}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#FF1F8F] px-5 text-[15px] font-extrabold text-white disabled:opacity-60 md:w-fit"
      >
        <MaterialIcon name="upload" size={20} />
        Upload Video
      </button>
      {progress && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[#E4E4E2] bg-white p-3">
          <span className="text-[13.5px] font-bold break-words">
            Uploading {progress.name} ({progress.pct}%)
            {progress.left > 0 ? `, ${progress.left} more waiting` : ""}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-[#F0F0F1]">
            <div className="h-full bg-[#FF1F8F] transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="text-[12px] font-medium text-[#6b6b69]">Keep this page open until it finishes.</span>
        </div>
      )}
      {error && <p className="rounded-lg bg-[#FDECEC] p-3 text-[13.5px] font-semibold text-[#B3261E] break-words">{error}</p>}
      {videos.length === 0 && !progress && <p className="px-1 py-6 text-center text-[14px] font-medium text-[#4a4a48]">No videos yet. Tap Upload Video to add one.</p>}
      {videos.map((v) => (
        <div key={v.id} className="flex flex-col gap-2 rounded-lg border border-[#E4E4E2] bg-white p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <MaterialIcon name="movie" size={22} className="mt-0.5 flex-none text-[#6b6b69]" />
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold break-words">{v.name}</p>
              <p className="text-[12.5px] font-medium text-[#6b6b69]">
                {fmtSize(v.size)} · Uploaded {fmtShortDate(v.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-none gap-2">
            <button type="button" disabled={busyId === v.id} onClick={() => download(v)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#0D0D0D] px-4 text-[13.5px] font-extrabold hover:bg-[#F0F0F1] disabled:opacity-60 md:flex-none">
              <MaterialIcon name="download" size={18} />
              Download Original
            </button>
            <button type="button" disabled={busyId === v.id} onClick={() => remove(v)} aria-label="Delete video" title="Delete video" className="flex size-10 flex-none items-center justify-center rounded-md border border-[#E4E4E2] text-[#6b6b69] hover:border-[#B3261E] hover:text-[#B3261E] disabled:opacity-60">
              <MaterialIcon name="delete" size={19} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
