import type { Store } from "../db/store";
import type { Message } from "../db/types";
import { canSeeConversation } from "./access";
import type { ProjectSession } from "./auth-types";
import { areaPath, areaSubtree, type ProjectSnapshot } from "./snapshot";
import { describeBlocking, type BlockerLineVM } from "./views";

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
