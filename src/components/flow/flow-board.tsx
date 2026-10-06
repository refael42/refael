import { Check } from "lucide-react";
import Link from "next/link";
import { STATE_HEX } from "@/components/tasks/state-badge";
import type { EffectiveState } from "@/lib/engine/types";
import { t } from "@/lib/i18n";

export interface BoardRow {
  areaId: string;
  label: string;
  cells: Array<{ key: string; state: EffectiveState | "missing"; taskId: string | null; contractor: string | null }>;
  done: number;
  total: number;
  /** names of the stages that can be worked on now / are in progress */
  current: string[];
}

/** Apartments × process stages: where every apartment stands at a glance. */
export function FlowBoard({ stages, rows }: { stages: Array<{ key: string; name: string; color: string }>; rows: BoardRow[] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t.flow.boardEmpty}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t.flow.boardHint}</p>
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
                  const title = `${r.label} · ${st.name} · ${c.state === "missing" ? t.flow.missing : t.effective[c.state]}${c.contractor ? ` · ${c.contractor}` : ""}`;
                  const box = (
                    <span
                      className="mx-auto flex h-5 w-5 items-center justify-center rounded-sm text-white"
                      style={{
                        backgroundColor: c.state === "missing" ? "transparent" : STATE_HEX[c.state],
                        border: c.state === "missing" ? "1px dashed #cbd5e1" : undefined,
                        // blocked = waiting for earlier stages (normal); faded so what can move now stands out
                        opacity: c.state === "blocked" ? 0.3 : 1,
                      }}
                    >
                      {c.state === "done" && <Check className="h-3 w-3" />}
                    </span>
                  );
                  return (
                    <td key={r.areaId} className="p-0.5 text-center" title={title}>
                      {c.taskId ? (
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
