"use client";

import { useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/ui/material-icon";
import { fmtShortDate } from "@/lib/format";

type Quality = { width: number | null; height: number | null; fps: number | null; duration: number | null };
export type VideoRow = Quality & { id: string; name: string; path: string; size: number; createdAt: string };

function fmtSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// The quality line: resolution, frame rate, length, how much data per second, and file size.
function qualityText(q: Quality, size: number) {
  const parts: string[] = [];
  if (q.width && q.height) parts.push(`${q.width}×${q.height}`);
  if (q.fps) parts.push(`${Math.round(q.fps)} fps`);
  if (q.duration) {
    parts.push(`${Math.floor(q.duration / 60)}:${String(Math.round(q.duration % 60)).padStart(2, "0")}`);
    parts.push(`${((size * 8) / q.duration / 1e6).toFixed(1)} Mbps`);
  }
  parts.push(fmtSize(size));
  return parts.join(" · ");
}

type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => void };

// Reads the picture size, length and frame rate from the file on this device, before anything is uploaded.
async function readQuality(file: File): Promise<Quality> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video") as FrameVideo;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error("unreadable"));
      setTimeout(() => rej(new Error("timeout")), 8000);
    });
    const q: Quality = { width: v.videoWidth || null, height: v.videoHeight || null, fps: null, duration: Number.isFinite(v.duration) ? v.duration : null };
    const rvfc = v.requestVideoFrameCallback;
    if (rvfc) {
      const times: number[] = [];
      await new Promise<void>((res) => {
        const tick = (_: number, meta: { mediaTime: number }) => {
          times.push(meta.mediaTime);
          if (times.length >= 15) res();
          else rvfc.call(v, tick);
        };
        rvfc.call(v, tick);
        v.play().catch(() => res());
        setTimeout(res, 2500);
      });
      v.pause();
      if (times.length >= 5) {
        const gaps = times
          .slice(1)
          .map((t, i) => t - times[i])
          .filter((g) => g > 0)
          .sort((a, b) => a - b);
        if (gaps.length) q.fps = 1 / gaps[Math.floor(gaps.length / 2)];
      }
    }
    return q;
  } catch {
    return { width: null, height: null, fps: null, duration: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Large files go up in 6 MB pieces that can resume if the connection drops, straight to storage, untouched.
function storageEndpoint() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.replace(/^(https:\/\/[a-z0-9]+)\.supabase\.co/, "$1.storage.supabase.co") + "/storage/v1/upload/resumable";
}

async function storedSizeOf(path: string): Promise<number> {
  const { data } = await createClient().storage.from("videos").list("", { search: path });
  return Number(data?.find((o) => o.name === path)?.metadata?.size);
}

export function VideosClient({ initial }: { initial: VideoRow[] }) {
  const [videos, setVideos] = useState(initial);
  const [progress, setProgress] = useState<{ name: string; pct: number; left: number } | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File, left: number) {
    const supabase = createClient();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    setProgress({ name: file.name, pct: 0, left });
    const quality = await readQuality(file);
    setIncoming(qualityText(quality, file.size));
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
    const { data, error: e } = await supabase
      .from("ct_videos")
      .insert({ name: file.name, path, size_bytes: file.size, mime_type: file.type || null, width: quality.width, height: quality.height, fps: quality.fps, duration_seconds: quality.duration })
      .select("id, name, path, size_bytes, created_at")
      .single();
    if (e || !data) throw new Error(e?.message ?? "Uploaded, but couldn't save it to the list.");
    setVideos((v) => [{ id: data.id, name: data.name, path: data.path, size: Number(data.size_bytes), createdAt: data.created_at, ...quality }, ...v]);
    // check that what is stored is exactly the size of the file that was picked
    const stored = await storedSizeOf(path);
    setNote(
      stored === file.size
        ? `Saved at full quality: ${qualityText(quality, stored)}. Stored size matches the file you picked.`
        : `Saved, but the stored size (${Number.isFinite(stored) ? fmtSize(stored) : "unknown"}) differs from the file you picked (${fmtSize(file.size)}).`,
    );
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setNote("");
    const list = Array.from(files);
    try {
      for (let i = 0; i < list.length; i++) await uploadOne(list[i], list.length - i - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
      setIncoming(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(v: VideoRow) {
    setBusyId(v.id);
    setError("");
    setNote("");
    const { data, error: e } = await createClient().storage.from("videos").createSignedUrl(v.path, 3600, { download: v.name });
    const stored = await storedSizeOf(v.path);
    setBusyId(null);
    if (e || !data) return setError(e?.message ?? "Couldn't make a download link.");
    const size = Number.isFinite(stored) ? stored : v.size;
    setNote(`Exporting the original: ${qualityText(v, size)}${size === v.size ? ". Identical to what you uploaded." : "."}`);
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
          <span className="text-[12.5px] font-bold break-words">{incoming ? `Quality: ${incoming}` : "Reading the video's quality…"}</span>
          <span className="text-[12px] font-medium text-[#6b6b69]">Keep this page open until it finishes.</span>
        </div>
      )}
      {note && <p className="rounded-lg bg-[#EAF8D8] p-3 text-[13.5px] font-semibold text-[#2F6B00] break-words">{note}</p>}
      {error && <p className="rounded-lg bg-[#FDECEC] p-3 text-[13.5px] font-semibold text-[#B3261E] break-words">{error}</p>}
      {videos.length === 0 && !progress && <p className="px-1 py-6 text-center text-[14px] font-medium text-[#4a4a48]">No videos yet. Tap Upload Video to add one.</p>}
      {videos.map((v) => (
        <div key={v.id} className="flex flex-col gap-2 rounded-lg border border-[#E4E4E2] bg-white p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <MaterialIcon name="movie" size={22} className="mt-0.5 flex-none text-[#6b6b69]" />
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold break-words">{v.name}</p>
              <p className="text-[12.5px] font-medium text-[#6b6b69] break-words">
                {qualityText(v, v.size)} · Uploaded {fmtShortDate(v.createdAt)}
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
