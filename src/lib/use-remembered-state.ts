"use client";

import { useCallback, useEffect, useState } from "react";

// Like useState, but remembers the value for this browser tab so coming Back to a
// page puts it exactly how you left it (board vs list, filters, sorting).
export function useRememberedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );
  return [value, set] as const;
}
