"use client";
import { Check, MousePointerClick } from "lucide-react";
import { useState } from "react";
import { toggleCapturedAction } from "@/app/actions/flow";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { STATE_HEX } from "@/components/tasks/state-badge";
import type { EffectiveState } from "@/lib/engine/types";
import { t } from "@/lib/i18n";

export interface BoardRow {
  areaId: string;
  label: string;
  cells: Array<{ key: string; state: EffectiveState | "missing" | "skip"; taskId: string | null; contractor: string | null }>;
  done: number;
  total: number;
  /** names of the stages that can be worked on now / are in progress */
  current: string[];
}

/** Apartments × process stages: where every apartment stands at a glance. */
export function FlowBoard({
  stages,
  rows,
  editable = false,
  actions,
  hint = t.flow.boardHint,
}: {
  hint?: string;
  stages: Array<{ key: string; name: string; color: string }>;
  rows: BoardRow[];
  /** PM: quick-mark mode (tap a cell = done / not done, no messages) */
  editable?: boolean;
  actions?: React.ReactNode;
}) {
  const [marking, setMarking] = useState(false);
  const { call, pending } = useAction();
  if (!rows.length)
    return (
      <div className="flex flex-col items-start gap-3">
        {actions}
        <p className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.flow.boardEmpty}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {editable && (
          <Button size="sm" variant={marking ? "default" : "outline"} onClick={() => setMarking((m) => !m)}>
            <MousePointerClick />
            {t.setup.markMode}
          </Button>
        )}
      </div>
      <p className={marking ? "rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" : "text-sm text-muted-foreground"}>
        {marking ? t.setup.markModeHint : hint}
      </p>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["ready", "in_progress", "awaiting_approval", "done", "blocked"] as const).map((st) => (
          <span key={st} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATE_HEX[st], opacity: st === "blocked" ? 0.3 : 1 }} />
            {st === "blocked" ? t.flow.waiting : t.effective[st]}
          </span>
        ))}
      </div>
      <div className="max-w-full self-start overflow-x-auto rounded-lg border">
        <table className="w-max border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50 align-bottom">
              <th className="sticky start-0 z-10 min-w-40 bg-muted p-2 text-start font-semibold">{t.flow.phase}</th>
              {rows.map((r) => (
                <th key={r.areaId} className="min-w-12 p-1 text-center font-medium" title={r.label}>
                  <Link href={`/flow?area=${r.areaId}`} className="block hover:underline">
                    {r.label.split(" › ").pop()!.replace(/^דירה\s*/, "")}
                  </Link>
                  <div className="mx-auto mt-1 h-1 w-8 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-state-ready" style={{ width: `${(100 * r.done) / Math.max(1, r.total)}%` }} />
                  </div>
                  <span className="num text-[10px] font-normal text-muted-foreground">{`${r.done}/${r.total}`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stages.map((st, i) => (
              <tr key={st.key} className="border-t">
                <th className="sticky start-0 z-10 max-w-56 truncate bg-card px-2 py-1 text-start font-normal" title={st.name} style={{ borderInlineStart: `3px solid ${st.color}` }}>
                  {st.name}
                </th>
                {rows.map((r) => {
                  const c = r.cells[i];
                  if (c.state === "skip" && !c.taskId)
                    return (
                      <td key={r.areaId} className="p-0.5 text-center text-muted-foreground/50" title={`${r.label} · ${st.name} · ${t.flow.skip}`}>
                        –
                      </td>
                    );
                  const title = `${r.label} · ${st.name} · ${c.state === "missing" || c.state === "skip" ? t.flow.missing : t.effective[c.state]}${c.contractor ? ` · ${c.contractor}` : ""}`;
                  const box = (
                    <span
                      className="mx-auto flex h-5 w-5 items-center justify-center rounded-sm text-white"
                      style={{
                        backgroundColor: c.state === "missing" || c.state === "skip" ? "transparent" : STATE_HEX[c.state],
                        border: c.state === "missing" || c.state === "skip" ? "1px dashed #cbd5e1" : undefined,
                        // blocked = waiting for earlier stages (normal); faded so what can move now stands out
                        opacity: c.state === "blocked" ? 0.3 : 1,
                      }}
                    >
                      {c.state === "done" && <Check className="h-3 w-3" />}
                    </span>
                  );
                  return (
                    <td key={r.areaId} className="p-0.5 text-center" title={title}>
                      {c.taskId && marking ? (
                        <button type="button" disabled={pending} aria-label={title} className="block w-full disabled:opacity-60" onClick={() => call(() => toggleCapturedAction(c.taskId!))}>
                          {box}
                        </button>
                      ) : c.taskId ? (
                        <Link href={`/tasks/${c.taskId}`} aria-label={title}>
                          {box}
                        </Link>
                      ) : (
                        box
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">{t.flow.current}</span>
        {rows.map((r) => (
          <span key={r.areaId}>
            <span className="font-medium">{r.label}: </span>
            {r.done === r.total ? <span className="text-state-ready">{t.flow.allDone}</span> : r.current.join(" · ") || "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
