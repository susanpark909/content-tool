"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";

// Longest recording, so a forgotten microphone doesn't run on forever (and the upload stays small).
const MAX_SECONDS = 180;

// The recording format this browser can make: Safari/iPhone makes mp4, Chrome and others make webm.
function pickType(): string {
  const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

// A small microphone button, like the one in Claude and ChatGPT: tap it and talk, tap again to stop. The recording
// is turned into text by a real transcription service (much better than the browser's built-in voice typing), and
// the words are added to the end of the box it sits in.
export function DictateButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  // leaving the page lets go of the microphone
  useEffect(
    () => () => {
      const r = recorder.current;
      if (r) {
        r.onstop = null;
        try {
          if (r.state !== "inactive") r.stop();
        } catch {}
      }
      release();
    },
    [],
  );

  function say(message: string) {
    setNote(message);
    setTimeout(() => setNote((n) => (n === message ? null : n)), 6000);
  }

  async function send(blob: Blob) {
    setState("working");
    try {
      const res = await fetch("/api/dictate", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: blob });
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(j.error || "Couldn't turn that into text. Try again.");
      if (j.text) onTextRef.current(j.text);
      else say("Didn't catch any words. Try again.");
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't turn that into text. Try again.");
    }
    setState("idle");
  }

  function stop() {
    const r = recorder.current;
    // let go of the microphone right away, then send what was recorded
    release();
    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        setState("idle");
      }
    } else setState("idle");
  }

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      say("This browser can't record. Try Safari or Chrome.");
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      say("Microphone is blocked. Allow it for this site in your browser settings.");
      return;
    }
    const type = pickType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(media, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    } catch {
      media.getTracks().forEach((t) => t.stop());
      say("Couldn't start the microphone.");
      return;
    }
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || type || "audio/webm" });
      chunks.current = [];
      send(blob);
    };
    recorder.current = rec;
    stream.current = media;
    rec.start(1000);
    setSeconds(0);
    setState("recording");
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop();
    }, 1000);
  }

  function toggle() {
    if (state === "recording") stop();
    else if (state === "idle") start();
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <span className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={state === "working"}
        // keep focus where it is so the box doesn't jump on tap
        onMouseDown={(e) => e.preventDefault()}
        aria-label={state === "recording" ? "Stop recording" : state === "working" ? "Turning your voice into text" : "Voice typing"}
        title={state === "recording" ? "Stop" : state === "working" ? "Turning your voice into text" : "Speak instead of typing"}
        className={`flex items-center justify-center rounded-full border transition-colors ${state === "recording" ? "h-8 gap-1.5 border-[#FF1F8F] bg-[#FF1F8F] px-3 text-white" : "size-8"} ${
          state === "recording"
            ? ""
            : "border-[#E4E4E2] bg-white text-[#4a4a48] hover:border-[#0D0D0D] hover:text-[#0D0D0D]"
        }`}
      >
        {state === "working" ? <EqualizerIcon size={16} /> : <MaterialIcon name={state === "recording" ? "stop" : "mic"} size={18} />}
        {state === "recording" && <span className="text-xs font-bold [font-variant-numeric:tabular-nums]">{mmss}</span>}
      </button>
      {note && (
        <span className="absolute top-9 right-0 z-20 w-56 rounded-md bg-[#0D0D0D] px-2.5 py-2 text-xs leading-[1.35] font-semibold text-white">
          {note}
        </span>
      )}
    </span>
  );
}
