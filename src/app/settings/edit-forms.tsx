"use client";

import { useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { saveBrandEdits, saveIdealClientEdits, type BrandProfile, type IdealClient } from "./actions";

const darkField =
  "w-full rounded-md border border-[#4a4a48] bg-[#1a1a1a] px-3 py-2.5 text-sm font-medium text-[#FBFBFA] outline-none placeholder:text-[#7a7a78] focus:border-[#C6FF3D]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-[#D4D4D2]">
      {label}
      {children}
    </label>
  );
}

function ListInputs({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const values = [0, 1, 2].map((i) => items[i] ?? "");
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-[#D4D4D2]">
      <span>{label}</span>
      {values.map((v, i) => (
        <input
          key={i}
          value={v}
          onChange={(e) => {
            const next = [...values];
            next[i] = e.target.value;
            onChange(next);
          }}
          className={darkField}
        />
      ))}
    </div>
  );
}

function Actions({
  saving,
  error,
  onSave,
  onCancel,
}: {
  saving: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="flex h-10 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-5 text-[13.5px] font-extrabold text-white hover:bg-[#C6FF3D] hover:text-[#0D0D0D] disabled:opacity-60"
      >
        <MaterialIcon name="check" size={17} />
        {saving ? "Saving…" : "Done"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-md px-3 text-[13.5px] font-bold text-[#D4D4D2] hover:bg-[#262626]"
      >
        Cancel
      </button>
      {error && <span className="text-sm font-semibold text-[#FF9CCB]">{error}</span>}
    </div>
  );
}

export function BrandEditForm({
  brand,
  onSaved,
  onCancel,
}: {
  brand: BrandProfile;
  onSaved: (b: BrandProfile) => void;
  onCancel: () => void;
}) {
  const [headline, setHeadline] = useState(brand.headline);
  const [about, setAbout] = useState(brand.about);
  const [voice, setVoice] = useState(brand.voice.join(", "));
  const [knownFor, setKnownFor] = useState(brand.knownFor);
  const [storyBeats, setStoryBeats] = useState(brand.storyBeats);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");

  function save() {
    setError("");
    startSaving(async () => {
      try {
        const updated = await saveBrandEdits({
          headline,
          about,
          voice: voice.split(",").map((v) => v.trim()).filter(Boolean),
          knownFor,
          storyBeats,
        });
        onSaved({ ...brand, ...updated });
      } catch {
        setError("Couldn't save.");
      }
    });
  }

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-4">
      <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#C6FF3D]">YOUR BRAND</span>
      <Field label="Headline">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={darkField} />
      </Field>
      <Field label="About">
        <AutoTextarea value={about} onChange={setAbout} minRows={2} className={darkField} />
      </Field>
      <Field label="Voice (separate with commas)">
        <input value={voice} onChange={(e) => setVoice(e.target.value)} className={darkField} />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ListInputs label="What I'm Known For" items={knownFor} onChange={setKnownFor} />
        <ListInputs label="My Story Beats" items={storyBeats} onChange={setStoryBeats} />
      </div>
      <Actions saving={saving} error={error} onSave={save} onCancel={onCancel} />
    </div>
  );
}

export function ClientEditForm({
  client,
  onSaved,
  onCancel,
}: {
  client: IdealClient;
  onSaved: (c: IdealClient) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [about, setAbout] = useState(client.about);
  const [tags, setTags] = useState(client.tags.join(", "));
  const [painPoints, setPainPoints] = useState(client.painPoints);
  const [desires, setDesires] = useState(client.desires);
  const [topics, setTopics] = useState(client.topics);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");

  function save() {
    setError("");
    startSaving(async () => {
      try {
        const updated = await saveIdealClientEdits({
          name,
          about,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          painPoints,
          desires,
          topics,
        });
        onSaved({ ...client, ...updated });
      } catch {
        setError("Couldn't save.");
      }
    });
  }

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-4">
      <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#C6FF3D]">YOUR IDEAL CLIENT</span>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={darkField} />
      </Field>
      <Field label="About">
        <AutoTextarea value={about} onChange={setAbout} minRows={2} className={darkField} />
      </Field>
      <Field label="Tags (separate with commas)">
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={darkField} />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ListInputs label="Their Pain Points" items={painPoints} onChange={setPainPoints} />
        <ListInputs label="What They Want" items={desires} onChange={setDesires} />
        <ListInputs label="My Content Topics" items={topics} onChange={setTopics} />
      </div>
      <Actions saving={saving} error={error} onSave={save} onCancel={onCancel} />
    </div>
  );
}
