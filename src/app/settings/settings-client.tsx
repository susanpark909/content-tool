"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { BrandEditForm, ClientEditForm } from "./edit-forms";
import {
  generateIdealClient,
  saveIdealClientText,
  applyBrandProfileNote,
  dismissBrandProfileNote,
  type BrandProfile,
  type IdealClient,
  type PendingBrandNote,
} from "./actions";

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
        <span className="text-xl md:text-2xl font-black tracking-[-0.025em]">{title}</span>
      </div>
      <p className="max-w-[70ch] text-sm font-medium text-[#4a4a48] text-pretty">{subtitle}</p>
    </div>
  );
}

function numbered(items: string[]) {
  return items.filter(Boolean).map((t, i) => ({ n: i + 1, t }));
}

export function SettingsClient({
  pendingNotes,
  brand: initialBrand,
  idealClient: initialIdealClient,
}: {
  pendingNotes: PendingBrandNote[];
  brand: BrandProfile;
  idealClient: IdealClient;
}) {
  const [notes, setNotes] = useState(pendingNotes);
  const [editingBrand, setEditingBrand] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [brand, setBrand] = useState(initialBrand);
  useEffect(() => {
    setBrand(initialBrand);
    setBrandText(initialBrand.rawText);
  }, [initialBrand]);
  const [brandText, setBrandText] = useState(initialBrand.rawText);
  const [brandLoading, startBrand] = useTransition();
  const [brandError, setBrandError] = useState("");
  const [brandSaved, setBrandSaved] = useState(false);

  const [client, setClient] = useState(initialIdealClient);
  const [clientText, setClientText] = useState(initialIdealClient.rawText);
  const [clientLoading, startClient] = useTransition();
  const [clientError, setClientError] = useState("");
  const [clientSaved, setClientSaved] = useState(false);

  function runGenerateIdealClient(text: string) {
    if (!text.trim() || clientLoading) return;
    setClientError("");
    startClient(async () => {
      try {
        const updated = await generateIdealClient(text);
        setClient(updated);
        setClientText(updated.rawText);
        setClientSaved(true);
      } catch (e) {
        setClientError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {notes.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold">Waiting for review</span>
            <span className="rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11px] font-extrabold">{notes.length}</span>
          </div>
          <p className="text-xs font-medium text-[#4a4a48]">
            Sent over from Idea. Edit if you want, then add — nothing touches your Brand Profile until you say so.
          </p>
          <div className="flex flex-col gap-2.5">
            {notes.map((note) => (
              <PendingNoteRow
                key={note.id}
                note={note}
                brandText={brandText}
                onApplied={(updated) => {
                  setBrand(updated);
                  setBrandText(updated.rawText);
                  setNotes((prev) => prev.filter((n) => n.id !== note.id));
                }}
                onDismissed={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
              />
            ))}
          </div>
        </div>
      )}

      {brandError && (
        <div className="rounded-md bg-[#FFD9EB] px-3.5 py-2.5 text-[13px] font-semibold">{brandError}</div>
      )}

      <div
        className="relative grid min-w-0 grid-cols-1 gap-4 rounded-lg bg-[#0D0D0D] p-4 text-[#FBFBFA] transition-opacity md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] md:gap-6 md:p-6"
        style={{ opacity: brandLoading ? 0.45 : 1 }}
      >
        {!editingBrand && (
          <button
            type="button"
            onClick={() => setEditingBrand(true)}
            title="Edit"
            aria-label="Edit"
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-md text-[#D4D4D2] hover:bg-[#262626] hover:text-white"
          >
            <MaterialIcon name="edit" size={17} />
          </button>
        )}
        {editingBrand ? (
          <BrandEditForm
            brand={brand}
            onSaved={(b) => {
              setBrand(b);
              setEditingBrand(false);
            }}
            onCancel={() => setEditingBrand(false)}
          />
        ) : (
          <>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-5 max-md:gap-x-3 max-md:gap-y-2.5">
          <div className="flex size-[72px] flex-none items-center justify-center rounded-lg bg-[#FF1F8F] text-2xl font-black text-[#0D0D0D] max-md:row-span-2 max-md:size-12 max-md:text-lg">
            SP
          </div>
          <div className="flex min-w-0 flex-col gap-2.5 max-md:contents">
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#C6FF3D] max-md:col-start-2 max-md:row-start-1 max-md:self-end">YOUR BRAND</span>
            <span className="text-[28px] leading-[1.05] font-black tracking-[-0.025em] text-pretty max-md:col-start-2 max-md:row-start-2 max-md:text-[21px]">
              {brand.headline || "Generate your profile to see it here"}
            </span>
            {brand.about && <p className="max-w-[62ch] text-sm leading-[1.5] text-[#D4D4D2] text-pretty max-md:col-span-2 max-md:text-[13px]">{brand.about}</p>}
            {brand.voice.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 max-md:col-span-2">
                <span className="mr-0.5 text-xs font-bold text-[#D4D4D2]">Voice</span>
                {brand.voice.map((tag) => (
                  <span key={tag} className="rounded-xl border border-[#4a4a48] px-2.5 py-1 text-xs font-bold text-[#EDEDEB]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] content-start gap-5 border-l border-[#2a2a2a] pl-6 max-md:grid-cols-1 max-md:gap-4 max-md:border-t max-md:border-l-0 max-md:pt-4 max-md:pl-0">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <MaterialIcon name="star" size={18} className="text-[#FF1F8F]" />
              <span>What I&apos;m known for</span>
            </div>
            {numbered(brand.knownFor).map((it) => (
              <NumberedRow key={it.n} n={it.n} t={it.t} dark />
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <MaterialIcon name="history_edu" size={18} className="text-[#FF1F8F]" />
              <span>My story beats</span>
            </div>
            {numbered(brand.storyBeats).map((it) => (
              <NumberedRow key={it.n} n={it.n} t={it.t} dark />
            ))}
          </div>
        </div>
          </>
        )}
      </div>

      <SectionHeading
        title="Ideal Client Avatar"
        subtitle="Write about who you're making content for. Ramble if you want. AI turns it into the profile on your Goals page: a name, tags, a short summary, their pain points, what they want, and content topics for you."
      />

      <div className="flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white px-5.5 pt-5 pb-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <textarea
          value={clientText}
          onChange={(e) => {
            setClientText(e.target.value);
            setClientSaved(false);
          }}
          onBlur={() => {
            if (clientText !== client.rawText) saveIdealClientText(clientText);
          }}
          rows={7}
          placeholder="Who are they? What do they do all day? What keeps them stuck? What would they love to have?"
          className="min-h-[150px] resize-y border-0 bg-transparent font-medium text-[17px] leading-[1.55] text-[#0D0D0D] outline-none placeholder:text-[#0D0D0D]/45"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F1] pt-3">
          <span className="text-[12.5px] font-semibold text-[#4a4a48]">
            {clientLoading ? "Reading your notes…" : clientSaved ? "Profile updated. Your Goals page uses it now." : "Regenerate any time you edit your notes."}
          </span>
          <button
            type="button"
            disabled={clientLoading || !clientText.trim()}
            onClick={() => runGenerateIdealClient(clientText)}
            style={{ opacity: clientLoading ? 0.55 : 1 }}
            className="flex items-center gap-2 rounded-md bg-[#FF1F8F] py-2.5 pr-5 pl-4 text-sm font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
          >
            <MaterialIcon name="auto_awesome" size={18} />
            {clientLoading ? "Generating…" : "Generate profile"}
          </button>
        </div>
      </div>

      {clientError && (
        <div className="rounded-md bg-[#FFD9EB] px-3.5 py-2.5 text-[13px] font-semibold">{clientError}</div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[13px] font-bold text-[#4a4a48]">How it shows on your Goals page</span>
          <Link href="/" className="text-[12.5px] font-bold text-[#D10A6E] hover:underline">
            Go to Goals →
          </Link>
        </div>
        <div
          className="relative grid min-w-0 grid-cols-1 gap-4 rounded-lg bg-[#0D0D0D] p-4 text-[#FBFBFA] transition-opacity md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] md:gap-6 md:p-6"
          style={{ opacity: clientLoading ? 0.45 : 1 }}
        >
          {!editingClient && (
            <button
              type="button"
              onClick={() => setEditingClient(true)}
              title="Edit"
              aria-label="Edit"
              className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-md text-[#D4D4D2] hover:bg-[#262626] hover:text-white"
            >
              <MaterialIcon name="edit" size={17} />
            </button>
          )}
          {editingClient ? (
            <ClientEditForm
              client={client}
              onSaved={(c) => {
                setClient(c);
                setEditingClient(false);
              }}
              onCancel={() => setEditingClient(false)}
            />
          ) : (
            <>
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-5 max-md:gap-x-3 max-md:gap-y-2.5">
            <div className="flex size-[72px] flex-none items-center justify-center rounded-lg bg-[#FF1F8F] text-[#0D0D0D] max-md:row-span-2 max-md:size-12">
              <MaterialIcon name="person" size={38} weight={300} className="max-md:text-[26px]!" />
            </div>
            <div className="flex min-w-0 flex-col gap-2.5 max-md:contents">
              <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#C6FF3D] max-md:col-start-2 max-md:row-start-1 max-md:self-end">YOUR IDEAL CLIENT</span>
              <span className="text-[28px] leading-[1.05] font-black tracking-[-0.025em] text-pretty max-md:col-start-2 max-md:row-start-2 max-md:text-[21px]">
                {client.name || "Generate your profile to see it here"}
              </span>
              {client.about && <p className="max-w-[62ch] text-sm leading-[1.5] text-[#D4D4D2] text-pretty max-md:col-span-2 max-md:text-[13px]">{client.about}</p>}
              {client.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5 max-md:col-span-2">
                  {client.tags.map((tag) => (
                    <span key={tag} className="rounded-xl border border-[#4a4a48] px-2.5 py-1 text-xs font-bold text-[#EDEDEB]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-4.5 border-l border-[#2a2a2a] pl-6 max-md:gap-4 max-md:border-t max-md:border-l-0 max-md:pt-4 max-md:pl-0">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 max-md:grid-cols-1 max-md:gap-4">
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <MaterialIcon name="target" size={18} className="text-[#FF1F8F]" />
                  <span>Their Pain Points</span>
                </div>
                {numbered(client.painPoints).map((it) => (
                  <NumberedRow key={it.n} n={it.n} t={it.t} dark />
                ))}
              </div>
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <MaterialIcon name="emoji_events" size={18} className="text-[#FF1F8F]" />
                  <span>What They Want</span>
                </div>
                {numbered(client.desires).map((it) => (
                  <NumberedRow key={it.n} n={it.n} t={it.t} dark />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-[#2a2a2a] pt-4">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <MaterialIcon name="article" size={18} className="text-[#FF1F8F]" />
                <span>My Content Topics</span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {numbered(client.topics).map((it) => (
                  <NumberedRow key={it.n} n={it.n} t={it.t} dark />
                ))}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberedRow({ n, t, dark }: { n: number; t: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-[13px] ${dark ? "text-[#D4D4D2]" : "text-[#0D0D0D]"}`}>
      <span
        className={`flex size-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold ${
          dark ? "bg-[#262626] text-[#EDEDEB]" : "bg-[#F0F0F1] text-[#0D0D0D]"
        }`}
      >
        {n}
      </span>
      <span>{t}</span>
    </div>
  );
}

function PendingNoteRow({
  note,
  brandText,
  onApplied,
  onDismissed,
}: {
  note: PendingBrandNote;
  brandText: string;
  onApplied: (updated: BrandProfile) => void;
  onDismissed: () => void;
}) {
  const [content, setContent] = useState(note.content);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-md bg-[#FBFBFA] p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        className="resize-none border-0 bg-transparent text-sm font-medium text-[#0D0D0D] outline-none"
      />
      {error && <p className="text-xs font-semibold text-[#D10A6E]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                const updated = await applyBrandProfileNote(note.id, content, brandText);
                onApplied(updated);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              }
            });
          }}
          className="rounded-md bg-[#FF1F8F] px-3 py-1.5 text-xs font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await dismissBrandProfileNote(note.id);
              onDismissed();
            });
          }}
          className="rounded-md border border-[#E4E4E2] px-3 py-1.5 text-xs font-bold hover:border-[#0D0D0D]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
