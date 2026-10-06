/**
 * Auto-release: run a graph mutation, recompute, and release every task that
 * became ready — persist planned→ready, write the audit trail, and notify the
 * contractor (in-app/push + a message in his chat).
 */
import { analyze, newlyReady } from "../engine";
import type { Store } from "../db/store";
import type { ChangeSource } from "../db/types";
import { he } from "../i18n/he";
import { audit } from "./audit";
import { messageContractor } from "./messaging";
import { notify } from "./notify";
import { loadGraph, toEngineInput } from "./snapshot";

export interface ReleaseResult {
  released: string[];
}

export async function withRelease<T>(
  store: Store,
  projectId: string,
  opts: { actor: string | null; source: ChangeSource; now?: Date; cause?: string },
  mutate: () => Promise<T>,
): Promise<T & ReleaseResult> {
  const now = opts.now ?? new Date();
  const before = await loadGraph(store, projectId);
  const result = await mutate();
  const released = await releaseReady(store, projectId, {
    ...opts,
    now,
    beforeAnalysis: analyze(toEngineInput(before.tasks, before.dependencies, before.blockers, now)),
  });
  return { ...(result as T), released };
}

/**
 * Release tasks that are ready now but were blocked in `beforeAnalysis`
 * (or, when omitted, that are still stored as "planned" — used by the
 * periodic tick after drying lags elapse).
 */
export async function releaseReady(
  store: Store,
  projectId: string,
  opts: {
    actor: string | null;
    source: ChangeSource;
    now: Date;
    cause?: string;
    beforeAnalysis?: ReturnType<typeof analyze>;
  },
): Promise<string[]> {
  const after = await loadGraph(store, projectId);
  const afterAnalysis = analyze(toEngineInput(after.tasks, after.dependencies, after.blockers, opts.now));
  const ids = opts.beforeAnalysis
    ? newlyReady(opts.beforeAnalysis, afterAnalysis)
    : afterAnalysis.readyIds.filter((id) => after.tasks.find((t) => t.id === id)?.status === "planned");
  if (!ids.length) return [];

  const byId = new Map(after.tasks.map((t) => [t.id, t]));
  for (const id of ids) {
    const task = byId.get(id)!;
    if (task.status === "planned") {
      await store.update("tasks", { id }, { status: "ready" });
      await audit(store, {
        projectId,
        entityType: "task",
        entityId: id,
        action: "status",
        from: "planned",
        to: "ready",
        actor: opts.actor,
        source: "system",
        meta: { reason: "auto_release", cause: opts.cause ?? null },
      });
    }
    const text = opts.cause ? he.sys.releasedBy(task.title, opts.cause) : he.sys.released(task.title);
    const sent = await messageContractor(store, projectId, task.contractor_id, text, { action: "task_released", task_id: id });
    if (sent) {
      await notify(store, [
        {
          profileId: sent.profileId,
          projectId,
          kind: "released",
          title: he.notify.releasedTitle,
          body: text,
          link: `/tasks/${id}`,
        },
      ]);
    }
  }
  return ids;
}
