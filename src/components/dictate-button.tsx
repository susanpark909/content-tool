"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

// Minimal shape of the browser's speech-recognition object (not in TypeScript's
// default DOM types). Safari/iPhone and Chrome on computers have it; Chrome on
// iPhone and Firefox don't.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

// A small microphone button: tap it, speak, and your words are added to the
// end of the box it sits in. Tap again to stop.
export function DictateButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => () => recRef.current?.stop(), []);

  function say(message: string) {
    setNote(message);
    setTimeout(() => setNote((n) => (n === message ? null : n)), 6000);
  }

  function toggle() {
    if (listening) {
      const current = recRef.current as (Recognition & { abort?: () => void }) | null;
      setListening(false);
      try {
        current?.stop();
      } catch {}
      setTimeout(() => {
        try {
          current?.abort?.();
        } catch {}
      }, 400);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      say("This browser can't do voice typing. Try Safari, or tap the microphone on your keyboard.");
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) said += e.results[i][0].transcript;
      }
      if (said.trim()) onTextRef.current(said.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        say("Microphone is blocked. Allow it for this site in your browser settings.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        say("Couldn't hear that. Try again.");
      }
    };
    rec.onend = () => {
      if (recRef.current === rec) setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      say("Couldn't start the microphone.");
    }
  }

  return (
    <span className={className}>
      <button
        type="button"
        onClick={toggle}
        // keep focus where it is so the box doesn't jump on tap
        onMouseDown={(e) => e.preventDefault()}
        aria-label={listening ? "Stop voice typing" : "Voice typing"}
        title={listening ? "Stop" : "Speak instead of typing"}
        className={`flex size-8 items-center justify-center rounded-full border transition-colors ${
          listening
            ? "animate-pulse border-[#FF1F8F] bg-[#FF1F8F] text-white"
            : "border-[#E4E4E2] bg-white text-[#4a4a48] hover:border-[#0D0D0D] hover:text-[#0D0D0D]"
        }`}
      >
        <MaterialIcon name={listening ? "stop" : "mic"} size={18} />
      </button>
      {note && (
        <span className="absolute top-9 right-0 z-20 w-56 rounded-md bg-[#0D0D0D] px-2.5 py-2 text-xs leading-[1.35] font-semibold text-white">
          {note}
        </span>
      )}
    </span>
  );
}
