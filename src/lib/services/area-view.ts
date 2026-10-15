import type { Store } from "../db/store";
import type { EventStatus, EventType, Message } from "../db/types";
import { localDate } from "../i18n";
import { canSeeConversation } from "./access";
import type { ProjectSession } from "./auth-types";
import { areaPath, areaSubtree, type ProjectSnapshot } from "./snapshot";
import { contractorLabel, describeBlocking, type BlockerLineVM } from "./views";

/**
 * Does the text mention this area by name? Allows Hebrew one-letter prefixes
 * ("בדירה 17", "לדירה 17") and refuses partial numbers ("דירה 1" ≠ "דירה 17").
 */
export function mentionsArea(text: string, name: string): boolean {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])[ובלמהשכ]{0,2}${esc}(?![\\p{N}])`, "u").test(text);
}

export interface AreaBlockerVM extends BlockerLineVM {
  key: string;
  /** number of blocked tasks in this area held by it */
  count: number;
}

/** Root blockers of every blocked task in the area, aggregated. */
export function areaBlockers(s: ProjectSnapshot, areaId: string): AreaBlockerVM[] {
  const inArea = areaSubtree(s.areas, areaId);
  const agg = new Map<string, AreaBlockerVM>();
  for (const task of s.tasks) {
    if (!task.area_id || !inArea.has(task.area_id)) continue;
    const a = s.analysis.byTask[task.id];
    if (a.effective !== "blocked") continue;
    for (const r of a.rootBlockers) {
      const key = r.kind === "external" ? `x:${r.blockerId}` : `${r.kind}:${r.taskId}`;
      const cur = agg.get(key);
      if (cur) cur.count++;
      else agg.set(key, { ...describeBlocking(s, r), key, count: 1 });
    }
  }
  return [...agg.values()].sort((x, y) => y.count - x.count);
}

/** Messages that are linked to tasks in the area or mention the area by name. */
export async function areaMessages(store: Store, sess: ProjectSession, s: ProjectSnapshot, areaId: string, limit = 30) {
  const inArea = areaSubtree(s.areas, areaId);
  const names = [...inArea].map((id) => s.areaById.get(id)!).filter((a) => a.type === "apartment" || a.type === "floor" || a.type === "common").map((a) => a.name);
  const own = s.areaById.get(areaId)!;
  if (!names.includes(own.name)) names.push(own.name);
  const taskIds = s.tasks.filter((t) => t.area_id && inArea.has(t.area_id)).map((t) => t.id);

  const [all, links, convs, parts] = await Promise.all([
    store.select("messages", { where: { project_id: s.project.id }, order: [["created_at", "desc"]], limit: 500 }),
    taskIds.length ? store.select("message_links", { where: { task_id: { in: taskIds } } }) : Promise.resolve([]),
    store.select("conversations", { where: { project_id: s.project.id } }),
    store.select("conversation_participants"),
  ]);
  const linked = new Set(links.map((l) => l.message_id));
  const visible = new Set(convs.filter((c) => canSeeConversation(sess, c, parts.filter((p) => p.conversation_id === c.id))).map((c) => c.id));
  const hits: Message[] = all.filter(
    (m) => visible.has(m.conversation_id) && m.text && (linked.has(m.id) || names.some((n) => mentionsArea(m.text!, n))),
  );
  return hits.slice(0, limit);
}

export function areaBreadcrumb(s: ProjectSnapshot, areaId: string) {
  return areaPath(s.areaById, areaId).map((a) => ({ id: a.id, name: a.name }));
}

export interface PreventLine {
  taskId: string;
  title: string;
  who: string;
  late: boolean;
}

/** "What stops this area from being finished?" — open work, grouped by who has to act next. */
export interface WhatPrevents {
  total: number;
  open: number;
  /** root causes of the blocked tasks (another trade, an external blocker) */
  blocked: AreaBlockerVM[];
  /** done by the contractor, waiting for the PM's check */
  toInspect: PreventLine[];
  /** free to start, not started */
  toStart: PreventLine[];
  inProgress: PreventLine[];
}

export function whatPrevents(s: ProjectSnapshot, areaId: string): WhatPrevents {
  const inArea = areaSubtree(s.areas, areaId);
  const tasks = s.tasks.filter((x) => x.area_id && inArea.has(x.area_id));
  const today = localDate(s.now);
  const line = (id: string): PreventLine => {
    const task = s.taskById.get(id)!;
    return { taskId: id, title: task.title, who: contractorLabel(s, task.contractor_id), late: !!task.planned_end && task.planned_end < today };
  };
  const by = (state: string) => tasks.filter((x) => s.analysis.byTask[x.id].effective === state).map((x) => line(x.id));
  return {
    total: tasks.length,
    open: tasks.filter((x) => s.analysis.byTask[x.id].effective !== "done").length,
    blocked: areaBlockers(s, areaId),
    toInspect: by("awaiting_approval"),
    toStart: by("ready"),
    inProgress: by("in_progress"),
  };
}

export interface AreaEventVM {
  id: string;
  type: EventType;
  status: EventStatus;
  summary: string;
  quote: string | null;
  at: string;
  author: string;
  sourceId: string | null;
  sourceTitle: string;
}

/** What the WhatsApp chats said about this area (and its tasks), newest first, with the source. */
export async function areaEvents(store: Store, s: ProjectSnapshot, areaId: string, limit = 30): Promise<AreaEventVM[]> {
  const inArea = areaSubtree(s.areas, areaId);
  const taskIds = new Set(s.tasks.filter((x) => x.area_id && inArea.has(x.area_id)).map((x) => x.id));
  const events = (await store.select("project_events", { where: { project_id: s.project.id }, order: [["occurred_at", "desc"]] })).filter(
    (e) =>
      e.status !== "dismissed" &&
      ((e.resolved.area_ids ?? []).some((id) => inArea.has(id)) ||
        [...(e.resolved.task_ids ?? []), ...(e.resolved.applied_task_ids ?? [])].some((id) => taskIds.has(id))),
  ).slice(0, limit);
  if (!events.length) return [];
  const itemIds = [...new Set(events.map((e) => e.source_item_id).filter(Boolean) as string[])];
  const items = itemIds.length ? await store.select("source_items", { where: { id: { in: itemIds } } }) : [];
  const sources = items.length ? await store.select("sources", { where: { id: { in: [...new Set(items.map((i) => i.source_id))] } } }) : [];
  return events.map((e) => {
    const item = items.find((i) => i.id === e.source_item_id);
    const src = sources.find((x) => x.id === item?.source_id);
    return {
      id: e.id,
      type: e.type,
      status: e.status,
      summary: e.summary,
      quote: e.quote,
      at: e.occurred_at,
      author: (item?.author_profile_id && s.profileById.get(item.author_profile_id)?.full_name) || item?.author || "",
      sourceId: src?.id ?? null,
      sourceTitle: src?.title ?? "",
    };
  });
}
