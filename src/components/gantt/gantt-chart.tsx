"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { STATE_HEX } from "@/components/tasks/state-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EffectiveState } from "@/lib/engine/types";
import { fmtDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface GanttRow {
  id: string;
  title: string;
  area: string;
  areaGroup: string;
  trade: string;
  state: EffectiveState;
  critical: boolean;
  /** computed (CPM) — day offsets from today */
  start: number;
  end: number;
  /** planned — day offsets from today (ghost bar) */
  plannedStart: number | null;
  plannedEnd: number | null;
}

const DAY_W = 26;
const ROW_H = 30;
const LABEL_W = 220;

export function GanttChart({ rows, today }: { rows: GanttRow[]; today: string }) {
  const [group, setGroup] = useState<"area" | "trade">("area");
  const { min, max } = useMemo(() => {
    let min = 0;
    let max = 14;
    for (const r of rows) {
      min = Math.min(min, Math.floor(r.start), r.plannedStart ?? 0);
      max = Math.max(max, Math.ceil(r.end), r.plannedEnd ?? 0);
    }
    return { min: Math.max(min, -21), max: Math.min(max + 2, 240) };
  }, [rows]);
  const days = max - min;
  const groups = useMemo(() => {
    const m = new Map<string, GanttRow[]>();
    for (const r of [...rows].sort((a, b) => a.start - b.start)) {
      const k = group === "area" ? r.areaGroup : r.trade;
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he", { numeric: true }));
  }, [rows, group]);
  const base = new Date(`${today}T12:00:00Z`).getTime();
  const dateAt = (offset: number) => new Date(base + offset * 86_400_000);
  // RTL timeline: time flows right → left, so day d sits at `right`
  const x = (d: number) => (d - min) * DAY_W;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={group} onValueChange={(v) => setGroup(v as "area" | "trade")}>
          <TabsList>
            <TabsTrigger value="area">{t.gantt.byArea}</TabsTrigger>
            <TabsTrigger value="trade">{t.gantt.byTrade}</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-5 rounded-sm bg-slate-400" />
            {t.gantt.computed}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-5 rounded-sm border border-dashed border-slate-500" />
            {t.gantt.planned}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-5 rounded-sm ring-2 ring-state-critical" />
            {t.tasks.onCriticalPath}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <div style={{ width: LABEL_W + days * DAY_W }} className="relative">
          {/* header */}
          <div className="sticky top-0 z-10 flex border-b bg-background">
            <div className="sticky start-0 z-20 shrink-0 border-e bg-background" style={{ width: LABEL_W }} />
            <div className="relative h-10" style={{ width: days * DAY_W }}>
              {Array.from({ length: days }, (_, i) => {
                const d = min + i;
                const date = dateAt(d);
                const first = date.getUTCDate() === 1 || i === 0;
                const weekend = date.getUTCDay() === 5 || date.getUTCDay() === 6;
                return (
                  <div
                    key={d}
                    className={cn("absolute top-0 flex h-10 flex-col items-center justify-end border-s pb-1 text-[10px] text-muted-foreground", weekend && "bg-muted/60")}
                    style={{ right: x(d), width: DAY_W }}
                  >
                    {first && <span className="absolute top-0.5 whitespace-nowrap font-semibold">{fmtDate(date).slice(2)}</span>}
                    <span className={cn(d === 0 && "font-bold text-primary")}>{date.getUTCDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* rows */}
          {groups.map(([name, list]) => (
            <div key={name}>
              <div className="sticky start-0 border-b bg-muted/50 px-2 py-1 text-xs font-semibold" style={{ width: LABEL_W + days * DAY_W }}>
                {name} <span className="text-muted-foreground">({list.length})</span>
              </div>
              {list.map((r) => (
                <div key={r.id} className="flex border-b last:border-b-0" style={{ height: ROW_H }}>
                  <Link
                    href={`/tasks/${r.id}`}
                    className="sticky start-0 z-[5] flex shrink-0 items-center truncate border-e bg-background px-2 text-xs hover:underline"
                    style={{ width: LABEL_W }}
                    title={r.title}
                  >
                    <span className="truncate">{r.title}</span>
                  </Link>
                  <div className="relative" style={{ width: days * DAY_W }}>
                    {r.plannedStart !== null && r.plannedEnd !== null && (
                      <div
                        className="absolute top-1.5 h-[18px] rounded border border-dashed border-slate-500/70"
                        style={{ right: x(Math.max(min, r.plannedStart)), width: Math.max(DAY_W / 2, (Math.min(max, r.plannedEnd + 1) - Math.max(min, r.plannedStart)) * DAY_W) }}
                      />
                    )}
                    <div
                      className={cn("absolute top-[9px] h-3 rounded-sm", r.critical && "ring-2 ring-state-critical")}
                      style={{
                        right: x(Math.max(min, r.start)),
                        width: Math.max(4, (Math.min(max, r.end) - Math.max(min, r.start)) * DAY_W),
                        backgroundColor: STATE_HEX[r.state],
                      }}
                      title={`${fmtDate(dateAt(r.start))} – ${fmtDate(dateAt(r.end))}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
          {/* today */}
          <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-primary/70" style={{ right: LABEL_W + x(0) }}>
            <span className="absolute -top-0 me-1 whitespace-nowrap rounded bg-primary px-1 text-[10px] text-primary-foreground">{t.gantt.today}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
