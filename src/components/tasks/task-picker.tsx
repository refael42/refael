"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface PickItem {
  value: string;
  label: string;
  hint?: string;
}

/** Searchable list (works well on phones with ~hundreds of tasks). */
export function TaskPicker({ items, value, onChange }: { items: PickItem[]; value: string | null; onChange: (v: string) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim();
    return (s ? items.filter((i) => i.label.includes(s) || i.hint?.includes(s)) : items).slice(0, 60);
  }, [items, q]);
  return (
    <div className="flex flex-col gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.app.search} />
      <div className="max-h-64 overflow-y-auto rounded-md border">
        {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t.app.noResults}</p>}
        {shown.map((i) => (
          <button
            type="button"
            key={i.value}
            onClick={() => onChange(i.value)}
            className={cn(
              "flex w-full flex-col items-start border-b px-3 py-2 text-start text-sm last:border-b-0 hover:bg-accent",
              value === i.value && "bg-primary/10",
            )}
          >
            <span>{i.label}</span>
            {i.hint && <span className="text-xs text-muted-foreground">{i.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
