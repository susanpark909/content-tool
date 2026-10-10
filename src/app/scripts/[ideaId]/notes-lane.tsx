"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { DropLine } from "@/components/drop-line";
import { saveIdeaNotes } from "@/app/idea/actions";

type Note = { id: string; text: string; done: boolean };

const uid = () => Math.random().toString(36).slice(2, 10);

function parse(raw: string): Note[] {
  if (!raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v.map((n) => ({ id: String(n?.id ?? uid()), text: String(n?.text ?? ""), done: Boolean(n?.done) }));
    }
  } catch {}
  // Older plain-text notes become one card.
  return [{ id: uid(), text: raw, done: false }];
}

// Notes that live next to the script: small cards for things that don't belong in it
// (how to shoot it, props, reminders). Tap + to add one, tick it when it's done.
export function NotesLane({ ideaId, initial, onSaved }: { ideaId: string; initial: string; onSaved?: () => void }) {
  const [notes, setNotes] = useState<Note[]>(() => parse(initial));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // phone: collapsed until you tap it
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(notes);
  latest.current = notes;

  function persist(next: Note[], now = false) {
    if (timer.current) clearTimeout(timer.current);
    const run = () => {
      startTransition(async () => {
        await saveIdeaNotes(ideaId, JSON.stringify(next.filter((n) => n.text.trim())));
        onSaved?.();
      });
    };
    if (now) run();
    else timer.current = setTimeout(run, 700);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function update(next: Note[], now = false) {
    setNotes(next);
    persist(next, now);
  }
  function add() {
    const n: Note = { id: uid(), text: "", done: false };
    setOpen(true);
    setFocusId(n.id);
    setNotes((prev) => [n, ...prev]);
  }
  function drop(index: number) {
    if (!dragId) return;
    const from = notes.findIndex((n) => n.id === dragId);
    if (from < 0) return;
    let at = index;
    if (from < at) at -= 1;
    const next = notes.filter((n) => n.id !== dragId);
    next.splice(at, 0, notes[from]);
    update(next, true);
  }

  const count = notes.filter((n) => n.text.trim() && !n.done).length;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:sticky md:top-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left md:cursor-default">
          <MaterialIcon name="sticky_note_2" size={18} className="text-[#4a4a48]" />
          <span className="text-[14px] font-extrabold">Notes</span>
          {count > 0 && <span className="rounded-full bg-[#E6FF00] px-2 text-[11.5px] font-extrabold text-[#0D0D0D]">{count}</span>}
          <MaterialIcon name={open ? "expand_less" : "expand_more"} size={18} className="ml-auto text-[#9a9a98] md:hidden" />
        </button>
        <button
          type="button"
          onClick={add}
          title="Add a note"
          aria-label="Add a note"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-[#FF1F8F] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] md:size-8"
        >
          <MaterialIcon name="add" size={21} weight={500} />
        </button>
      </div>

      <div
        className={`${open ? "flex" : "max-md:hidden md:flex"} flex-col gap-2`}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-note]"));
          let idx = cards.length;
          for (let k = 0; k < cards.length; k++) {
            const r = cards[k].getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) {
              idx = k;
              break;
            }
          }
          setDropIndex((cur) => (cur === idx ? cur : idx));
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIndex(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dropIndex != null) drop(dropIndex);
          setDragId(null);
          setDropIndex(null);
        }}
      >
        {notes.length === 0 && (
          <button
            type="button"
            onClick={add}
            className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[#BDBDBB] px-3 py-6 text-center text-[12.5px] font-semibold text-[#6b6b69] hover:border-[#0D0D0D]"
          >
            <MaterialIcon name="add" size={20} />
            Tap + to jot a note. Shoot ideas, props, reminders.
          </button>
        )}
        {notes.map((n, i) => (
          <div key={n.id} className="flex flex-col gap-2">
            {dragId && dropIndex === i && <DropLine />}
            <div
              data-note
              className="group relative flex items-start gap-2 rounded-lg border border-[#F0F0F1] bg-[#FDFFE8] py-2 pr-1.5 pl-3 shadow-[0_2px_8px_rgba(13,13,13,0.05)]"
              style={{ opacity: dragId === n.id ? 0.4 : n.done ? 0.65 : 1 }}
            >
              <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[#E6FF00]" />
              <button
                type="button"
                onClick={() => update(notes.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)), true)}
                aria-label={n.done ? "Mark as not done" : "Mark as done"}
                title={n.done ? "Mark as not done" : "Mark as done"}
                className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border-[1.5px]"
                style={{ background: n.done ? "#0D0D0D" : "#fff", borderColor: n.done ? "#0D0D0D" : "#BDBDBB" }}
              >
                {n.done && <MaterialIcon name="check" size={13} className="text-white" />}
              </button>
              <AutoTextarea
                autoFocus={focusId === n.id}
                value={n.text}
                onChange={(v) => update(notes.map((x) => (x.id === n.id ? { ...x, text: v } : x)))}
                onBlur={() => persist(latest.current, true)}
                minRows={1}
                placeholder="Write a note…"
                wrapperClassName="flex-1"
                className={`w-full border-0 bg-transparent text-[14px] leading-[1.45] font-medium outline-none placeholder:text-[#9a9a98] ${n.done ? "line-through" : ""}`}
              />
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  try {
                    e.dataTransfer.setData("text/plain", n.id);
                  } catch {}
                  setDragId(n.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropIndex(null);
                }}
                title="Drag to reorder"
                className="mt-0.5 flex size-6 flex-none cursor-grab items-center justify-center rounded text-[#BDBDBB] hover:text-[#4a4a48] max-md:hidden"
              >
                <MaterialIcon name="drag_indicator" size={18} />
              </span>
              <button
                type="button"
                onClick={() => update(notes.filter((x) => x.id !== n.id), true)}
                aria-label="Delete note"
                title="Delete note"
                className="mt-px flex size-7 flex-none items-center justify-center rounded-md text-[#9a9a98] hover:bg-white hover:text-[#D10A6E]"
              >
                <MaterialIcon name="close" size={16} />
              </button>
            </div>
          </div>
        ))}
        {dragId && dropIndex != null && dropIndex >= notes.length && notes.length > 0 && <DropLine />}
      </div>
    </div>
  );
}
