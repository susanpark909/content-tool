"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { TYPE_COLORS, typeColor, type ContentType } from "@/lib/content-types";
import {
  createContentType,
  deleteContentType,
  getTypeCounts,
  reorderContentTypes,
  suggestTypes,
  updateContentType,
  type TypeWithCounts,
} from "@/app/types/actions";

export const UNTAGGED = "__untagged__";

// ---------------------------------------------------------------- chips
export function TypeChip({ type, onRemove, small = false }: { type: ContentType; onRemove?: () => void; small?: boolean }) {
  const c = typeColor(type.color);
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-[10px] font-bold whitespace-nowrap ${small ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]"}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {type.name}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${type.name}`} className="flex items-center opacity-70 hover:opacity-100">
          <MaterialIcon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

export function TypeChips({ types, ids, max = 2, small = true }: { types: ContentType[]; ids: string[]; max?: number; small?: boolean }) {
  const mine = ids.map((id) => types.find((t) => t.id === id)).filter((t): t is ContentType => Boolean(t));
  if (mine.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {mine.slice(0, max).map((t) => (
        <TypeChip key={t.id} type={t} small={small} />
      ))}
      {mine.length > max && (
        <span className="text-[10.5px] font-bold text-[#6b6b69]" title={mine.slice(max).map((t) => t.name).join(", ")}>
          +{mine.length - max}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- popover shell
function usePopover(width = 280) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 380)), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  }
  return { pos, close: () => setPos(null), toggle, btn };
}

// ---------------------------------------------------------------- picker (reel / idea)
// Tick the types that fit. Type a new name to create one on the spot.
export function TypePicker({
  types,
  value,
  onChange,
  onTypesChange,
  children,
  className = "",
  title = "Content type",
}: {
  types: ContentType[];
  value: string[];
  onChange: (ids: string[]) => void;
  onTypesChange: (types: ContentType[]) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const p = usePopover(290);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [manage, setManage] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = q.trim();
  const shown = types.filter((t) => !clean || t.name.toLowerCase().includes(clean.toLowerCase()));
  const exact = types.some((t) => t.name.toLowerCase() === clean.toLowerCase());
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  async function create() {
    if (!clean || creating) return;
    setCreating(true);
    setErr(null);
    try {
      const colors = Object.keys(TYPE_COLORS).filter((c) => c !== "gray");
      const t = await createContentType(clean, colors[types.length % colors.length]);
      onTypesChange([...types, t]);
      onChange([...value, t.id]);
      setQ("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create it");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button
        ref={p.btn}
        type="button"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setQ("");
          setErr(null);
          p.toggle();
        }}
        className={className}
      >
        {children}
      </button>
      {p.pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[80]"
              onClick={(e) => {
                e.stopPropagation();
                p.close();
              }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ top: p.pos.top, left: p.pos.left }}
              className="fixed z-[81] flex max-h-[370px] w-[290px] flex-col overflow-hidden rounded-xl border border-[#E4E4E2] bg-white shadow-[0_12px_32px_rgba(13,13,13,0.18)]"
            >
              <div className="flex items-center gap-2 border-b border-[#F0F0F1] px-3 py-2.5">
                <MaterialIcon name="search" size={17} className="text-[#4a4a48]" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && clean && !exact) create();
                  }}
                  placeholder="Find or create a tag…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {shown.map((t) => {
                  const on = value.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggle(t.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F6F6F5]">
                      <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#fff", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                        {on && <MaterialIcon name="check" size={13} className="text-white" />}
                      </span>
                      <TypeChip type={t} />
                    </button>
                  );
                })}
                {clean && !exact && (
                  <button type="button" onClick={create} disabled={creating} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-bold text-[#D10A6E] hover:bg-[#FFF6FA]">
                    <MaterialIcon name="add" size={18} /> Create “{clean}”
                  </button>
                )}
                {shown.length === 0 && !clean && <span className="block px-3 py-4 text-center text-[13px] font-medium text-[#4a4a48]">No tags yet. Type a name to make one.</span>}
                {err && <span className="block px-3 pb-2 text-[12px] font-semibold text-[#D10A6E]">{err}</span>}
              </div>
              <button
                type="button"
                onClick={() => {
                  p.close();
                  setManage(true);
                }}
                className="flex items-center gap-1.5 border-t border-[#F0F0F1] px-3 py-2.5 text-left text-[12.5px] font-bold text-[#4a4a48] hover:bg-[#F6F6F5]"
              >
                <MaterialIcon name="tune" size={16} /> Manage Tags
              </button>
            </div>
          </>,
          document.body,
        )}
      {manage && <ManageTypes types={types} onTypesChange={onTypesChange} onClose={() => setManage(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- filter pill (pick several, or "Untagged")
export function TypeFilter({
  types,
  value,
  onChange,
  withUntagged = true,
  wide = false,
  className = "",
  onTypesChange,
}: {
  types: ContentType[];
  value: string[];
  onChange: (v: string[]) => void;
  withUntagged?: boolean;
  wide?: boolean;
  className?: string;
  onTypesChange?: (types: ContentType[]) => void;
}) {
  const p = usePopover(250);
  const [manage, setManage] = useState(false);
  const label = value.length === 0 ? "All types" : value.length === 1 ? (value[0] === UNTAGGED ? "Untagged" : types.find((t) => t.id === value[0])?.name ?? "1 type") : `${value.length} types`;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className={className}>
      <button
        ref={p.btn}
        type="button"
        onClick={p.toggle}
        className={`relative flex w-full items-center rounded-md border bg-white text-left font-semibold hover:border-[#BDBDBB] ${wide ? "h-9 pr-8 pl-9 text-[13.5px] md:h-[42px]" : "h-9 pr-7 pl-8 text-[12.5px]"}`}
        style={{ borderColor: value.length ? "#FF1F8F" : "#E4E4E2" }}
      >
        <MaterialIcon name="sell" size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <span className="truncate">
          <span className="mr-1 font-bold text-[#6b6b69]">Type</span>
          {label}
        </span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      {p.pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={p.close} />
            <div style={{ top: p.pos.top, left: p.pos.left }} className="fixed z-[81] flex max-h-[340px] w-[250px] flex-col overflow-hidden rounded-xl border border-[#E4E4E2] bg-white shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {withUntagged && (
                  <button type="button" onClick={() => toggle(UNTAGGED)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F6F6F5]">
                    <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: value.includes(UNTAGGED) ? "#0D0D0D" : "#fff", borderColor: value.includes(UNTAGGED) ? "#0D0D0D" : "#BDBDBB" }}>
                      {value.includes(UNTAGGED) && <MaterialIcon name="check" size={13} className="text-white" />}
                    </span>
                    Untagged
                  </button>
                )}
                {types.map((t) => {
                  const on = value.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggle(t.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F6F6F5]">
                      <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#fff", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                        {on && <MaterialIcon name="check" size={13} className="text-white" />}
                      </span>
                      <TypeChip type={t} />
                    </button>
                  );
                })}
              </div>
              {value.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="border-t border-[#F0F0F1] px-3 py-2.5 text-left text-[12.5px] font-bold text-[#D10A6E] hover:bg-[#FFF6FA]">
                  Clear
                </button>
              )}
              {onTypesChange && (
                <button
                  type="button"
                  onClick={() => {
                    p.close();
                    setManage(true);
                  }}
                  className="flex items-center gap-1.5 border-t border-[#F0F0F1] px-3 py-2.5 text-left text-[12.5px] font-bold text-[#4a4a48] hover:bg-[#F6F6F5]"
                >
                  <MaterialIcon name="tune" size={16} /> Manage Tags
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      {manage && onTypesChange && <ManageTypes types={types} onTypesChange={onTypesChange} onClose={() => setManage(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- manage tags
export function ManageTypes({ types, onTypesChange, onClose }: { types: ContentType[]; onTypesChange: (t: ContentType[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<TypeWithCounts[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [warn, setWarn] = useState<TypeWithCounts | null>(null);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getTypeCounts().then(setRows).catch(() => setRows(types.map((t) => ({ ...t, reelCount: 0, ideaCount: 0 }))));
  }, [types]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !warn && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, warn]);

  function sync(next: TypeWithCounts[]) {
    setRows(next);
    onTypesChange(next.map(({ reelCount: _r, ideaCount: _i, ...t }) => t));
  }
  async function rename(t: TypeWithCounts, name: string) {
    setEditing(null);
    const n = name.trim();
    if (!n || n === t.name) return;
    setErr(null);
    try {
      await updateContentType(t.id, { name: n });
      sync((rows ?? []).map((x) => (x.id === t.id ? { ...x, name: n } : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't rename it");
    }
  }
  async function recolor(t: TypeWithCounts, color: string) {
    setColorFor(null);
    sync((rows ?? []).map((x) => (x.id === t.id ? { ...x, color } : x)));
    await updateContentType(t.id, { color }).catch(() => {});
  }
  async function move(i: number, by: -1 | 1) {
    if (!rows) return;
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    sync(next.map((x, k) => ({ ...x, position: k })));
    await reorderContentTypes(next.map((x) => x.id)).catch(() => {});
  }
  async function remove(t: TypeWithCounts) {
    setWarn(null);
    sync((rows ?? []).filter((x) => x.id !== t.id));
    await deleteContentType(t.id).catch(() => {});
  }
  async function add() {
    const n = newName.trim();
    if (!n) return;
    setErr(null);
    try {
      const colors = Object.keys(TYPE_COLORS).filter((c) => c !== "gray");
      const t = await createContentType(n, colors[(rows?.length ?? 0) % colors.length]);
      sync([...(rows ?? []), { ...t, reelCount: 0, ideaCount: 0 }]);
      setNewName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create it");
    }
  }
  const used = (t: TypeWithCounts) => t.reelCount + t.ideaCount;

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex flex-col">
            <span className="text-[22px] font-extrabold tracking-[-0.01em]">Manage Tags</span>
            <span className="text-[12.5px] font-medium text-[#4a4a48]">What kind of content is it? Make them yours.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-y border-[#F0F0F1]">
          {rows === null && <span className="px-5 py-8 text-center text-sm font-medium text-[#4a4a48]">Loading…</span>}
          {rows?.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 border-b border-[#F0F0F1] px-4 py-2.5 last:border-b-0">
              <div className="flex flex-none flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex h-4 items-center text-[#9a9a98] hover:text-[#0D0D0D] disabled:opacity-30">
                  <MaterialIcon name="expand_less" size={16} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="flex h-4 items-center text-[#9a9a98] hover:text-[#0D0D0D] disabled:opacity-30">
                  <MaterialIcon name="expand_more" size={16} />
                </button>
              </div>
              <div className="relative flex-none">
                <button type="button" onClick={() => setColorFor(colorFor === t.id ? null : t.id)} title="Change color" className="flex size-7 items-center justify-center rounded-full border border-black/5" style={{ background: typeColor(t.color).bg }}>
                  <span className="size-3 rounded-full" style={{ background: typeColor(t.color).fg }} />
                </button>
                {colorFor === t.id && (
                  <div className="absolute top-8 left-0 z-10 flex w-[150px] flex-wrap gap-1.5 rounded-lg border border-[#E4E4E2] bg-white p-2 shadow-[0_8px_24px_rgba(13,13,13,0.15)]">
                    {Object.entries(TYPE_COLORS).map(([k, c]) => (
                      <button key={k} type="button" onClick={() => recolor(t, k)} title={c.label} className="flex size-7 items-center justify-center rounded-full border border-black/5" style={{ background: c.bg }}>
                        <span className="size-3 rounded-full" style={{ background: c.fg }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {editing === t.id ? (
                <input
                  autoFocus
                  defaultValue={t.name}
                  onBlur={(e) => rename(t, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-8 min-w-0 flex-1 rounded-md border border-[#BDBDBB] px-2 text-[14px] font-bold outline-none"
                />
              ) : (
                <button type="button" onClick={() => setEditing(t.id)} title="Click to rename" className="min-w-0 flex-1 truncate text-left text-[14px] font-bold hover:text-[#FF1F8F]">
                  {t.name}
                </button>
              )}
              <span className="flex-none text-[11.5px] font-semibold text-[#6b6b69]">
                {used(t) === 0 ? "Not used yet" : `${t.reelCount} ${t.reelCount === 1 ? "reel" : "reels"}${t.ideaCount ? `, ${t.ideaCount} ${t.ideaCount === 1 ? "idea" : "ideas"}` : ""}`}
              </span>
              <button type="button" onClick={() => setEditing(t.id)} aria-label="Rename" title="Rename" className="flex size-8 flex-none items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]">
                <MaterialIcon name="edit" size={17} />
              </button>
              <button type="button" onClick={() => (used(t) > 0 ? setWarn(t) : remove(t))} aria-label="Delete" title="Delete" className="flex size-8 flex-none items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#FFF0F7] hover:text-[#D10A6E]">
                <MaterialIcon name="delete" size={17} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New tag, like “Hot Take”"
              className="h-10 min-w-0 flex-1 rounded-md border border-[#E4E4E2] px-3 text-[13.5px] font-medium outline-none focus:border-[#0D0D0D]"
            />
            <button type="button" onClick={add} disabled={!newName.trim()} className="flex h-10 items-center gap-1 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98]">
              <MaterialIcon name="add" size={18} weight={500} /> Add
            </button>
          </div>
          {err && <span className="text-[12.5px] font-semibold text-[#D10A6E]">{err}</span>}
        </div>

        {warn && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4" onClick={() => setWarn(null)}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[420px] flex-col gap-3 rounded-2xl border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.3)]">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#FFF0F7] text-[#D10A6E]">
                <MaterialIcon name="warning" size={22} />
              </span>
              <span className="text-[19px] font-extrabold tracking-[-0.01em]">“{warn.name}” Is Being Used</span>
              <span className="text-[13.5px] leading-snug font-medium text-[#4a4a48]">
                It's on {warn.reelCount} {warn.reelCount === 1 ? "reel" : "reels"}
                {warn.ideaCount ? ` and ${warn.ideaCount} ${warn.ideaCount === 1 ? "idea" : "ideas"}` : ""}. You can rename it so they keep it, or delete it and it comes off all of them. The reels and ideas themselves stay.
              </span>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(warn.id);
                    setWarn(null);
                  }}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#0D0D0D] text-[13.5px] font-extrabold text-white hover:bg-[#FF1F8F] hover:text-[#0D0D0D]"
                >
                  <MaterialIcon name="edit" size={16} /> Rename It Instead
                </button>
                <button type="button" onClick={() => remove(warn)} className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#FFC2E0] bg-[#FFF0F7] text-[13.5px] font-extrabold text-[#D10A6E] hover:border-[#D10A6E]">
                  <MaterialIcon name="delete" size={16} /> Delete And Remove It From Them
                </button>
                <button type="button" onClick={() => setWarn(null)} className="h-10 rounded-md text-[13.5px] font-bold text-[#4a4a48] hover:bg-[#F0F0F1]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- auto-suggest review
export type SuggestReel = { id: string; caption: string | null; thumbnailUrl: string | null };

// Asks the AI for tags for these reels (in small batches), then lets you tweak and accept.
export function SuggestDialog({
  reels,
  types,
  onTypesChange,
  onApply,
  onClose,
}: {
  reels: SuggestReel[];
  types: ContentType[];
  onTypesChange?: (types: ContentType[]) => void;
  onApply: (picks: Record<string, string[]>) => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      for (let i = 0; i < reels.length; i += 12) {
        const chunk = reels.slice(i, i + 12).map((r) => r.id);
        try {
          const res = await suggestTypes(chunk);
          setPicks((p) => ({ ...p, ...res }));
        } catch {
          setFailed(true);
        }
        setDone(Math.min(reels.length, i + 12));
      }
    })();
  }, [reels]);

  const finished = done >= reels.length;
  const ready = Object.values(picks).filter((v) => v.length > 0).length;
  const toggle = (rid: string, tid: string) => setPicks((p) => ({ ...p, [rid]: (p[rid] ?? []).includes(tid) ? (p[rid] ?? []).filter((x) => x !== tid) : [...(p[rid] ?? []), tid] }));

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex flex-col">
            <span className="flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.01em]">
              <MaterialIcon name="auto_awesome" size={22} className="text-[#FF1F8F]" /> Auto-Suggest Tags
            </span>
            <span className="text-[12.5px] font-medium text-[#4a4a48]">
              {finished ? "Tap a tag to turn it off. Then apply." : `Reading your reels… ${done} of ${reels.length}`}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {!finished && (
          <div className="mx-5 mb-2 h-1.5 overflow-hidden rounded-full bg-[#F0F0F1]">
            <div className="h-full rounded-full bg-[#FF1F8F] transition-[width]" style={{ width: `${(done / Math.max(1, reels.length)) * 100}%` }} />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-y border-[#F0F0F1]">
          {reels.map((r) => {
            const mine = picks[r.id];
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-[#F0F0F1] px-5 py-3 last:border-b-0">
                <span className="relative h-12 w-9 flex-none overflow-hidden rounded bg-[#2b2b29]">
                  {r.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="line-clamp-1 text-[13px] font-bold">{(r.caption ?? "").split("\n")[0] || "(no caption)"}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {mine === undefined ? (
                      finished ? (
                        <span className="text-[12px] font-semibold text-[#9a9a98]">Nothing to read here</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6b6b69]">
                          <EqualizerIcon size={12} /> Reading…
                        </span>
                      )
                    ) : (
                      <>
                        {mine.map((tid) => {
                          const t = types.find((x) => x.id === tid);
                          return t ? <TypeChip key={t.id} type={t} onRemove={() => toggle(r.id, t.id)} /> : null;
                        })}
                        {mine.length === 0 && <span className="text-[12px] font-semibold text-[#9a9a98]">No clear fit</span>}
                        <TypePicker
                          types={types}
                          value={mine}
                          onChange={(v) => setPicks((p) => ({ ...p, [r.id]: v }))}
                          onTypesChange={onTypesChange ?? (() => {})}
                          title="Add another tag"
                          className="flex size-6 items-center justify-center rounded-full border border-dashed border-[#BDBDBB] text-[#6b6b69] hover:border-[#FF1F8F] hover:text-[#FF1F8F]"
                        >
                          <MaterialIcon name="add" size={15} />
                        </TypePicker>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="text-[12.5px] font-semibold text-[#6b6b69]">{failed ? "Some reels couldn't be read." : finished ? `${ready} of ${reels.length} have a suggestion` : ""}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-md px-4 text-[13.5px] font-bold text-[#4a4a48] hover:bg-[#F0F0F1]">
              Cancel
            </button>
            <button
              type="button"
              disabled={!finished || ready === 0}
              onClick={() => onApply(Object.fromEntries(Object.entries(picks).filter(([, v]) => v.length > 0)))}
              className="h-10 rounded-md bg-[#FF1F8F] px-5 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98]"
            >
              Apply {ready > 0 ? `(${ready})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// handy for pages that keep the types list in state
export function useTypes(initial: ContentType[]) {
  const [types, setTypes] = useState(initial);
  useEffect(() => setTypes(initial), [initial]);
  const byId = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  return { types, setTypes, byId };
}
