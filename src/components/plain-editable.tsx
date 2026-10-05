"use client";

import { useEffect, useRef } from "react";

// A plain-text writing box built from an editable div instead of a form field.
// Phones attach their AutoFill shortcut bar (passwords, cards, addresses) to
// form fields; an editable div isn't one, so the bar stays away.
export function PlainEditable({
  value,
  onChange,
  onPaste,
  disabled,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep what's shown in step with the value (for example, cleared after a save).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      contentEditable={disabled ? false : "plaintext-only"}
      suppressContentEditableWarning
      spellCheck
      autoCapitalize="sentences"
      data-placeholder={placeholder}
      onPaste={onPaste}
      onInput={(e) => {
        const el = e.currentTarget;
        // A browser leaves a stray line break behind when the box is emptied.
        if (el.innerText === "\n") el.innerHTML = "";
        onChange(el.innerText);
      }}
      className={`whitespace-pre-wrap outline-none empty:before:pointer-events-none empty:before:text-[#0D0D0D]/50 empty:before:content-[attr(data-placeholder)] ${className}`}
    />
  );
}
