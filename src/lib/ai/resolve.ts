/**
 * Server-side resolution of free-text names in a parse result to ids. The
 * model (or heuristic) never writes ids into the database: everything is
 * matched here against the project's own rows, and unknown names stay null.
 */
import type { AiParsedJson, Area, Contractor, Task, Trade } from "../db/types";
import type { ParseContext } from "./context";
import type { ParsedMessage } from "./schema";
import { hasWord, normalize, similarity } from "./text";

export function resolveArea(areas: Area[], name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalize(name);
  // "קומה 4 › דירה 17" → use the last segment
  const last = normalize(n.split(/›|>/).pop() ?? n);
  const exact = areas.find((a) => normalize(a.name) === last);
  if (exact) return exact.id;
  const num = last.match(/\d+/)?.[0];
  if (num) {
    const kind = /קומה/.test(last) ? "floor" : /דיר/.test(last) ? "apartment" : null;
    const byNum = areas.find((a) => (!kind || a.type === kind) && a.name.match(/\d+/)?.[0] === num && a.type !== "room");
    if (byNum) return byNum.id;
  }
  const contains = areas.find((a) => normalize(a.name).includes(last) || last.includes(normalize(a.name)));
  if (contains) return contains.id;
  const best = areas
    .map((a) => ({ a, s: similarity(a.name, last) }))
    .filter((x) => x.s >= 0.5)
    .sort((x, y) => y.s - x.s)[0];
  return best?.a.id ?? null;
}

export function resolveContractor(contractors: Contractor[], name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalize(name);
  const exact = contractors.find((c) => normalize(c.name) === n);
  if (exact) return exact.id;
  const word = contractors.find((c) => hasWord(n, normalize(c.name)) || (c.company && normalize(c.company) === n));
  return word?.id ?? null;
}

export function resolveTrade(trades: Trade[], name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalize(name);
  return (
    trades.find((t) => normalize(t.name) === n || t.key === n)?.id ??
    trades.find((t) => n.includes(normalize(t.name)) || normalize(t.name).includes(n))?.id ??
    null
  );
}

/** Match a free-text title to an open task (exact → contained → token similarity). */
export function resolveTaskTitle(tasks: Task[], title: string): string | null {
  const n = normalize(title);
  const exact = tasks.find((t) => normalize(t.title) === n);
  if (exact) return exact.id;
  const contains = tasks.filter((t) => normalize(t.title).includes(n) || n.includes(normalize(t.title)));
  if (contains.length === 1) return contains[0].id;
  const scored = tasks
    .map((t) => ({ t, s: similarity(t.title, n) }))
    .filter((x) => x.s >= 0.75)
    .sort((a, b) => b.s - a.s);
  if (scored.length && (scored.length === 1 || scored[0].s > scored[1].s)) return scored[0].t.id;
  return null;
}

export function resolveParsed(p: ParsedMessage, ctx: ParseContext, engine: "claude" | "heuristic", model?: string): AiParsedJson {
  const taskIds = new Set(ctx.tasks.map((t) => t.id));
  const tasks = p.tasks.map((t) => {
    const contractor_id = resolveContractor(ctx.contractors, t.contractor);
    const trade_id =
      resolveTrade(ctx.trades, t.trade) ?? ctx.contractors.find((c) => c.id === contractor_id)?.trade_id ?? null;
    return { area_id: resolveArea(ctx.areas, t.area), contractor_id, trade_id };
  });
  const affects_task_ids = [...new Set(p.affects.map((a) => resolveTaskTitle(ctx.tasks, a)).filter((x): x is string => !!x))];
  return {
    ...p,
    // depends_on_index must point at an earlier step
    tasks: p.tasks.map((t, i) => ({
      ...t,
      depends_on_index: t.depends_on_index !== null && t.depends_on_index >= 0 && t.depends_on_index < i ? t.depends_on_index : null,
    })),
    confidence: Math.max(0, Math.min(1, p.confidence)),
    completes_task_id: p.completes_task_id && taskIds.has(p.completes_task_id) ? p.completes_task_id : null,
    resolved: {
      tasks,
      affects_task_ids,
      completes_task_id: p.completes_task_id && taskIds.has(p.completes_task_id) ? p.completes_task_id : null,
    },
    engine,
    model,
  };
}
