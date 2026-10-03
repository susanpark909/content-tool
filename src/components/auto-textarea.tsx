"use client";

import { useLayoutEffect, useRef } from "react";

// A text box that starts small and grows taller as you write.
export function AutoTextarea({
  value,
  onChange,
  className = "",
  placeholder,
  minRows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`resize-none overflow-hidden ${className}`}
    />
  );
}
