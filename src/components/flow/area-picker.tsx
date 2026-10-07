"use client";
import { useMemo, useState } from "react";
import { Field, OptionSelect } from "@/components/common/field";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { t } from "@/lib/i18n";

/** Pick apartments: a floor (or "all apartments") and then the apartments in it. */
export function AreaPicker({ groups, picked, onChange }: { groups: AreaGroup[]; picked: Set<string>; onChange: (s: Set<string>) => void }) {
  const [group, setGroup] = useState<string | null>(groups[0]?.id ?? null);
  const children = useMemo(() => groups.find((g) => g.id === group)?.children ?? [], [groups, group]);
  return (
    <div className="flex flex-col gap-2">
      <Field label={t.bulk.where}>
        <OptionSelect
          value={group}
          onChange={(v) => {
            setGroup(v);
            onChange(new Set());
          }}
          options={groups.map((g) => ({ value: g.id, label: g.label }))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(new Set(children.map((c) => c.id)))}>
          {t.setup.selectAll}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(new Set())}>
          {t.setup.clearAll}
        </Button>
      </div>
      <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
        {children.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={picked.has(c.id)}
              onCheckedChange={(v) => {
                const n = new Set(picked);
                if (v) n.add(c.id);
                else n.delete(c.id);
                onChange(n);
              }}
            />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}
