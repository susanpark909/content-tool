"use client";

import { useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { ActionDialog } from "@/components/action-dialog";
import { deleteInstruction, saveInstruction } from "./instructions-actions";

type Row = InstructionRow & { k: string };

export type InstructionRow = {
  id: string;
  title: string;
  usedFor: string;
  body: string;
};

const inputClass =
  "w-full rounded-md border border-[#E4E4E2] bg-white px-3 text-[15px] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";

export function InstructionsTab({ initial }: { initial: InstructionRow[] }) {
  const [items, setItems] = useState<Row[]>(initial.map((r) => ({ ...r, k: r.id })));
  const [openId, setOpenId] = useState<string | null>(null);

  function addNew() {
    const tempId = `new-${Date.now()}`;
    setItems((prev) => [{ id: tempId, k: tempId, title: "", usedFor: "other", body: "" }, ...prev]);
    setOpenId(tempId);
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xl font-black tracking-[-0.02em]">Instructions</span>
            <span className="max-w-[60ch] text-[13px] font-semibold text-[#4a4a48]">
              Write down how you want things made: how to write your hooks, your reel scripts, how to turn an idea into
              a script. The AI in Viral Heist will read these when it creates things for you.
            </span>
          </div>
          <button
            type="button"
            onClick={addNew}
            className="flex h-10 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
          >
            <MaterialIcon name="add" size={18} weight={500} />
            Add Instructions
          </button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#BDBDBB] px-5 py-8 text-center text-sm font-semibold text-[#4a4a48]">
            Nothing here yet. Click &quot;Add Instructions&quot; to write your first set.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <InstructionCard
                key={item.k}
                item={item}
                open={openId === item.k}
                onToggle={() => setOpenId((cur) => (cur === item.k ? null : item.k))}
                onSaved={(saved) => setItems((prev) => prev.map((x) => (x.k === item.k ? { ...saved, k: item.k } : x)))}
                onRemoved={() => {
                  setItems((prev) => prev.filter((x) => x.id !== item.id));
                  setOpenId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InstructionCard({
  item,
  open,
  onToggle,
  onSaved,
  onRemoved,
}: {
  item: InstructionRow;
  open: boolean;
  onToggle: () => void;
  onSaved: (row: InstructionRow) => void;
  onRemoved: () => void;
}) {
  const isNew = item.id.startsWith("new-");
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave() {
    setError("");
    setSaved(false);
    startSaving(async () => {
      try {
        const id = await saveInstruction({ id: isNew ? null : item.id, title, usedFor: item.usedFor, body });
        onSaved({ id, title: title.trim(), usedFor: item.usedFor, body });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Couldn't save.");
      }
    });
  }

  function handleDelete() {
    setConfirmingDelete(false);
    if (isNew) {
      onRemoved();
      return;
    }
    deleteInstruction(item.id)
      .then(onRemoved)
      .catch(() => setError("Couldn't delete."));
  }

  const preview = item.body.trim().replace(/\s+/g, " ");

  return (
    <div className="overflow-hidden rounded-lg border border-[#F0F0F1]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FBFBFA]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{item.title || "Untitled instructions"}</span>
          <span className="truncate text-[12.5px] font-medium text-[#4a4a48]">
            {preview || "Nothing written yet"}
          </span>
        </span>
        <MaterialIcon name={open ? "expand_less" : "expand_more"} size={22} />
      </button>

      {open && (
        <div className="flex flex-col gap-3.5 border-t border-[#F0F0F1] bg-[#FBFBFA] p-4">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
            Title
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              placeholder="Like “How I write hooks”"
              className={`${inputClass} h-[46px]`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
            Your instructions
            <AutoTextarea
              value={body}
              onChange={(v) => {
                setBody(v);
                setSaved(false);
              }}
              minRows={4}
              placeholder="Write it the way you'd explain it to someone you're training. Rules, examples, what to do, what to avoid."
              className={`${inputClass} py-2.5 leading-[1.55]`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex h-10 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-5 text-[13.5px] font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => (isNew && !title && !body ? onRemoved() : setConfirmingDelete(true))}
              className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D]"
            >
              <MaterialIcon name="delete" size={17} />
              Delete
            </button>
            {saved && <span className="text-sm font-semibold text-[#2f7a00]">Saved</span>}
            {error && <span className="text-sm font-semibold text-[#D10A6E]">{error}</span>}
          </div>
        </div>
      )}

      {confirmingDelete && (
        <ActionDialog
          title="Delete These Instructions?"
          onClose={() => setConfirmingDelete(false)}
          confirmLabel="Delete"
          onConfirm={handleDelete}
        >
          <div className="px-6 py-4 text-sm font-medium text-[#4a4a48]">
            &quot;{item.title || "Untitled instructions"}&quot; will be removed for good.
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
