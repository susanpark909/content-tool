"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

// Small centered popup for multi-step actions (pick a board, pick a goal, ...).
export function ActionDialog({
  title,
  onClose,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  children,
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.28)] p-6 backdrop-blur-[6px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-[14px] border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]"
      >
        <div className="px-6 pt-6 pb-3 text-[22px] font-extrabold tracking-[-0.01em]">{title}</div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-y border-[#F0F0F1] py-1.5">{children}</div>
        <div className="flex items-center justify-end gap-2.5 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md px-4 text-[13.5px] font-bold text-[#FF1F8F] hover:bg-[#FFF0F7]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className="h-10 rounded-md bg-[#FF1F8F] px-5 text-[13.5px] font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98] disabled:hover:bg-[#E4E4E2] disabled:hover:text-[#9a9a98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DialogOption({
  icon,
  label,
  hint,
  selected,
  onSelect,
  filled,
}: {
  icon: string;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 px-6 py-2.5 text-left hover:bg-[#F6F6F5]"
      style={{ background: selected ? "#F0F0F1" : undefined }}
    >
      <span
        className="msym select-none"
        style={{ fontSize: 22, color: "#0D0D0D", fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 300` }}
      >
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      {hint && <span className="text-xs font-semibold text-[#4a4a48]">{hint}</span>}
      {selected && <MaterialIcon name="check" size={18} className="text-[#0D0D0D]" />}
    </button>
  );
}

// Icon-only button with a short label that appears on hover.
export function IconAction({
  icon,
  label,
  onClick,
  disabled,
  filled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <span className="group relative flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="relative flex size-8 items-center justify-center rounded-md text-[#0D0D0D] hover:bg-[#F0F0F1] hover:text-[#FF1F8F] disabled:opacity-50"
      >
        {typeof icon === "string" ? (
          <span className="msym select-none" style={{ fontSize: 22, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400` }}>
            {icon}
          </span>
        ) : (
          icon
        )}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded bg-[#0D0D0D] px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}

// Pinterest-style "Create board" popup: centered card, close X, one Name
// field, one pill button (new board, rename board).
export function NameDialog({
  title,
  initial = "",
  confirmLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.45)] p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[450px] flex-col rounded-[28px] bg-white p-8 shadow-[0_24px_72px_rgba(13,13,13,0.28)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full hover:bg-[#F0F0F1]"
        >
          <MaterialIcon name="close" size={22} />
        </button>
        <h2 className="mb-6 text-center text-[28px] leading-tight font-extrabold tracking-[-0.01em]">{title}</h2>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#4a4a48]">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ok) onSubmit(name.trim());
              if (e.key === "Escape") onClose();
            }}
            placeholder='Like "Hooks To Steal" or "Storytelling"'
            maxLength={60}
            className="h-12 w-full rounded-2xl border-2 border-[#CDCDCD] px-4 text-base font-medium text-[#0D0D0D] outline-none placeholder:text-[#8a8a88] focus:border-[#0D0D0D]"
          />
        </label>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!ok}
            onClick={() => ok && onSubmit(name.trim())}
            className="h-12 rounded-full bg-[#FF1F8F] px-6 text-base font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98] disabled:hover:bg-[#E4E4E2] disabled:hover:text-[#9a9a98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
