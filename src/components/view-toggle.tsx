"use client";

import { MaterialIcon } from "@/components/ui/material-icon";

// The one List | Grid switch, used on every page that can show posts either way.
export function ViewToggle({ value, onChange }: { value: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  return (
    <div className="flex gap-0.5 rounded-md border border-[#E4E4E2] bg-white p-0.5">
      {(["list", "grid"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={v === "list" ? "List view" : "Grid view"}
          title={v === "list" ? "List view" : "Grid view"}
          className={`flex h-[34px] items-center gap-1.5 rounded px-2.5 text-[13px] font-bold ${value === v ? "bg-[#0D0D0D] text-white" : "text-[#4a4a48] hover:bg-[#F0F0F1]"}`}
        >
          <MaterialIcon name={v === "list" ? "view_list" : "grid_view"} size={18} />
          <span className="max-md:hidden">{v === "list" ? "List" : "Grid"}</span>
        </button>
      ))}
    </div>
  );
}
