/**
 * Task, dependency and external-blocker mutations. Every write is authorized
 * here (application-level mirror of RLS), audited, and — when it can change
 * readiness — wrapped in withRelease so newly-ready tasks are released and
 * their contractors notified automatically.
 */
import { validateNewDependency } from "../engine";
import type { Store } from "../db/store";
import { StoreError } from "../db/store";
import type { ChangeSource, Dependency, ExternalBlocker, Task, TaskStatus } from "../db/types";
import { he } from "../i18n/he";
import { assertCanReportTask, assertPM } from "./access";
import { audit } from "./audit";
import { messageContractor } from "./messaging";
import { notify } from "./notify";
import { withRelease } from "./release";
import { loadRules, recordRuleFeedback, suggestDependencies, type DependencySuggestion } from "./rules";
import { AccessError, type ProjectSession } from "./auth-types";

export interface Ctx {
  store: Store;
  s: ProjectSession;
  now?: Date;
}

export class ServiceError extends Error {}

const nowOf = (ctx: Ctx) => ctx.now ?? new Date();

async function getTask(ctx: Ctx, id: string): Promise<Task> {
  const task = await ctx.store.byId("tasks", id);
  if (!task || task.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return task;
}

// ───────────────────────── create ─────────────────────────

export interface NewTaskInput {
  title: string;
  description?: string | null;
  area_id?: string | null;
  trade_id?: string | null;
  contractor_id?: string | null;
  status?: "planned" | "in_progress" | "done";
  planned_start?: string | null;
  planned_end?: string | null;
  check_in_days?: number | null;
  is_critical?: boolean;
  /** stage key of the master construction process (lib/flow/process.ts) */
  flow_stage?: string | null;
}

export interface CreateTasksResult {
  tasks: Task[];
  dependencies: Dependency[];
  /** Template suggestions for the PM to approve (nothing applied yet). */
  suggestions: DependencySuggestion[];
}

/**
 * Create one or more tasks. `chain` adds edges between the new tasks by index
 * (AI "depends_on_index"); `extraEdges` link to existing tasks (AI "affects").
 * Only called on explicit PM action.
 */
export async function createTasks(
  ctx: Ctx,
  inputs: NewTaskInput[],
  opts: {
    source: ChangeSource;
    messageId?: string | null;
    chain?: Array<{ from: number; to: number }>;
    affects?: Array<{ fromIndex: number; toTaskId: string }>;
    /** bulk generation: no per-task assignment messages, no rule suggestions */
    quiet?: boolean;
  } = { source: "manual" },
): Promise<CreateTasksResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  const now = nowOf(ctx);
  if (!inputs.length) throw new ServiceError(he.errors.invalid);
  const rows = inputs.map((i) => {
    const title = i.title.trim();
    if (!title) throw new ServiceError(he.errors.invalid);
    const status: TaskStatus = i.status ?? "planned";
    return {
      project_id: s.project.id,
      title,
      description: i.description ?? null,
      area_id: i.area_id ?? null,
      trade_id: i.trade_id ?? null,
      contractor_id: i.contractor_id ?? null,
      status,
      is_critical: i.is_critical ?? false,
      planned_start: i.planned_start ?? null,
      planned_end: i.planned_end ?? null,
      check_at: i.check_in_days ? new Date(now.getTime() + i.check_in_days * 86_400_000).toISOString() : null,
      started_at: status === "in_progress" || status === "done" ? now.toISOString() : null,
      completed_at: status === "done" ? now.toISOString() : null,
      created_from_message_id: opts.messageId ?? null,
      flow_stage: i.flow_stage ?? null,
      created_by: s.profile.id,
    } satisfies Partial<Task>;
  });

  const tasks = await store.insert("tasks", rows);
  const deps: Dependency[] = [];
  for (const e of opts.chain ?? []) {
    if (!tasks[e.from] || !tasks[e.to] || e.from === e.to) continue;
    deps.push(await insertDependency(ctx, { fromTaskId: tasks[e.from].id, toTaskId: tasks[e.to].id, source: opts.source === "manual" ? "manual" : "ai" }));
  }
  for (const e of opts.affects ?? []) {
    const from = tasks[e.fromIndex];
    if (!from) continue;
    try {
      deps.push(await insertDependency(ctx, { fromTaskId: from.id, toTaskId: e.toTaskId, source: "ai" }));
    } catch (err) {
      if (!(err instanceof ServiceError)) throw err; // skip cycles/duplicates from AI "affects"
    }
  }

  for (const t of tasks) {
    await audit(store, {
      projectId: s.project.id,
      entityType: "task",
      entityId: t.id,
      action: "create",
      to: t.status,
      actor: s.profile.id,
      source: opts.source,
      meta: opts.messageId ? { message_id: opts.messageId } : undefined,
    });
    if (opts.messageId) await store.insert("message_links", { message_id: opts.messageId, task_id: t.id, kind: "created" });
    if (opts.quiet) continue;
    const sent = await messageContractor(store, s.project.id, t.contractor_id, he.sys.taskAssigned(t.title), { task_id: t.id });
    if (sent)
      await notify(store, [
        { profileId: sent.profileId, projectId: s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: t.title, link: `/tasks/${t.id}` },
      ]);
  }

  const suggestions = opts.quiet ? [] : await suggestFor(ctx, tasks.map((t) => t.id));
  return { tasks, dependencies: deps, suggestions };
}

export async function suggestFor(ctx: Ctx, taskIds: string[]): Promise<DependencySuggestion[]> {
  const { store, s } = ctx;
  const [tasks, dependencies, areas, { rules, feedback }] = await Promise.all([
    store.select("tasks", { where: { project_id: s.project.id } }),
    store.select("dependencies", { where: { project_id: s.project.id } }),
    store.select("areas", { where: { project_id: s.project.id } }),
    loadRules(store, s.project.organization_id),
  ]);
  return suggestDependencies({ tasks, dependencies, areas, rules, feedback, newTaskIds: taskIds });
}

export async function suggestionLabels(ctx: Ctx, list: DependencySuggestion[]): Promise<Record<string, string>> {
  const ids = [...new Set(list.flatMap((x) => [x.fromTaskId, x.toTaskId]))];
  if (!ids.length) return {};
  const rows = await ctx.store.select("tasks", { where: { id: { in: ids }, project_id: ctx.s.project.id } });
  return Object.fromEntries(rows.map((r) => [r.id, r.title]));
}

/** PM decides on template suggestions: accepted ones become edges, all are recorded. */
export async function applySuggestions(
  ctx: Ctx,
  decisions: Array<DependencySuggestion & { accept: boolean }>,
): Promise<Dependency[]> {
  assertPM(ctx.s);
  const created: Dependency[] = [];
  const projectId = ctx.s.project.id;
  await withRelease(ctx.store, projectId, { actor: ctx.s.profile.id, source: "manual", now: nowOf(ctx) }, async () => {
    for (const d of decisions) {
      const [from, to] = await Promise.all([getTask(ctx, d.fromTaskId), getTask(ctx, d.toTaskId)]);
      const rule = await ctx.store.byId("rules", d.ruleId);
      await recordRuleFeedback(ctx.store, {
        organizationId: ctx.s.project.organization_id,
        predTradeId: rule?.predecessor_trade_id ?? from.trade_id,
        succTradeId: rule?.successor_trade_id ?? to.trade_id,
        decision: d.accept ? "accepted" : "rejected",
        ruleId: d.ruleId,
        actor: ctx.s.profile.id,
      });
      if (!d.accept) continue;
      try {
        created.push(
          await insertDependency(ctx, {
            fromTaskId: d.fromTaskId,
            toTaskId: d.toTaskId,
            lagHours: d.lagHours,
            source: rule?.source === "learned" ? "learned" : "template",
          }),
        );
      } catch (e) {
        if (!(e instanceof ServiceError)) throw e;
      }
    }
    return {};
  });
  return created;
}

// ───────────────────────── update / status ─────────────────────────

export async function updateTask(
  ctx: Ctx,
  id: string,
  patch: Partial<Pick<Task, "title" | "description" | "area_id" | "trade_id" | "contractor_id" | "planned_start" | "planned_end" | "check_at" | "is_critical" | "plan_pin_id">>,
): Promise<Task> {
  assertPM(ctx.s);
  const before = await getTask(ctx, id);
  if (patch.title !== undefined && !patch.title.trim()) throw new ServiceError(he.errors.invalid);
  const [after] = await ctx.store.update("tasks", { id }, patch);
  await audit(ctx.store, {
    projectId: ctx.s.project.id,
    entityType: "task",
    entityId: id,
    action: "update",
    actor: ctx.s.profile.id,
    source: "manual",
    meta: { fields: Object.keys(patch) },
  });
  if (patch.contractor_id && patch.contractor_id !== before.contractor_id) {
    const sent = await messageContractor(ctx.store, ctx.s.project.id, patch.contractor_id, he.sys.taskAssigned(after.title), { task_id: id });
    if (sent)
      await notify(ctx.store, [
        { profileId: sent.profileId, projectId: ctx.s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: after.title, link: `/tasks/${id}` },
      ]);
  }
  return after;
}

/**
 * Change a task's stored status.
 *  - PM: any transition.
 *  - Contractor: only start his own task (→ in_progress); completion goes
 *    through a completion report (photo) and PM approval.
 */
export async function setTaskStatus(
  ctx: Ctx,
  id: string,
  status: TaskStatus,
  opts: { reason?: string | null; source?: ChangeSource } = {},
) {
  const task = await getTask(ctx, id);
  if (ctx.s.role !== "pm") {
    assertCanReportTask(ctx.s, task);
    if (status !== "in_progress" || !["planned", "ready"].includes(task.status)) throw new AccessError(he.errors.pmOnly, 403);
  }
  if (task.status === status && status !== "blocked_manual") return { task, released: [] as string[] };
  const now = nowOf(ctx).toISOString();
  const patch: Partial<Task> = { status };
  if (status === "done") patch.completed_at = now;
  else patch.completed_at = null;
  if (status === "in_progress" && !task.started_at) patch.started_at = now;
  patch.blocked_reason = status === "blocked_manual" ? opts.reason?.trim() || null : null;

  return withRelease(
    ctx.store,
    ctx.s.project.id,
    { actor: ctx.s.profile.id, source: opts.source ?? "manual", now: nowOf(ctx), cause: status === "done" ? task.title : undefined },
    async () => {
      const [updated] = await ctx.store.update("tasks", { id }, patch);
      await audit(ctx.store, {
        projectId: ctx.s.project.id,
        entityType: "task",
        entityId: id,
        action: "status",
        from: task.status,
        to: status,
        actor: ctx.s.profile.id,
        source: opts.source ?? "manual",
        meta: opts.reason ? { reason: opts.reason } : undefined,
      });
      if (status === "done") await ctx.store.update("reminders", { task_id: id, status: { in: ["pending", "sent"] } }, { status: "resolved" });
      return { task: updated };
    },
  );
}

export async function deleteTask(ctx: Ctx, id: string) {
  assertPM(ctx.s);
  const task = await getTask(ctx, id);
  return withRelease(ctx.store, ctx.s.project.id, { actor: ctx.s.profile.id, source: "manual", now: nowOf(ctx) }, async () => {
    await ctx.store.remove("tasks", { id });
    await audit(ctx.store, {
      projectId: ctx.s.project.id,
      entityType: "task",
      entityId: id,
      action: "delete",
      from: task.title,
      actor: ctx.s.profile.id,
      source: "manual",
    });
    return {};
  });
}

// ───────────────────────── dependencies ─────────────────────────

export async function insertDependency(
  ctx: Ctx,
  d: { fromTaskId?: string | null; fromBlockerId?: string | null; toTaskId: string; lagHours?: number; source: Dependency["source"] },
): Promise<Dependency> {
  const { store, s } = ctx;
  const to = await getTask(ctx, d.toTaskId);
  let fromTask: Task | null = null;
  if (d.fromTaskId) {
    fromTask = await getTask(ctx, d.fromTaskId);
    const existing = await store.select("dependencies", { where: { project_id: s.project.id } });
    const check = validateNewDependency(
      existing.map((e) => ({ id: e.id, fromTaskId: e.from_task_id, toTaskId: e.to_task_id })),
      d.fromTaskId,
      d.toTaskId,
    );
    if (!check.ok) throw new ServiceError(check.reason === "duplicate" ? he.tasks.duplicateDep : he.tasks.cycleError);
  } else if (d.fromBlockerId) {
    const b = await store.byId("external_blockers", d.fromBlockerId);
    if (!b || b.project_id !== s.project.id) throw new AccessError(he.errors.notFound, 404);
  } else throw new ServiceError(he.errors.invalid);

  const lag = Math.max(0, Number(d.lagHours) || 0);
  let dep: Dependency;
  try {
    [dep] = await store.insert("dependencies", {
      project_id: s.project.id,
      from_task_id: d.fromTaskId ?? null,
      from_blocker_id: d.fromBlockerId ?? null,
      to_task_id: d.toTaskId,
      type: lag > 0 ? "finish_plus_lag" : "finish_to_start",
      lag_hours: lag,
      source: d.source,
      created_by: s.profile.id,
    });
  } catch (e) {
    if (e instanceof StoreError) throw new ServiceError(e.code === "cycle" ? he.tasks.cycleError : he.tasks.duplicateDep);
    throw e;
  }
  // A released task that gets a new unfinished predecessor goes back to planned.
  if (to.status === "ready" && (!fromTask || fromTask.status !== "done")) await store.update("tasks", { id: to.id }, { status: "planned" });
  await audit(store, {
    projectId: s.project.id,
    entityType: "dependency",
    entityId: dep.id,
    action: "create",
    to: `${d.fromTaskId ?? d.fromBlockerId}->${d.toTaskId}`,
    actor: s.profile.id,
    source: d.source === "ai" ? "ai" : "manual",
    meta: { lag_hours: lag },
  });
  return dep;
}

/** PM adds a dependency by hand (also feeds rule learning). */
export async function addDependency(
  ctx: Ctx,
  d: { fromTaskId?: string | null; fromBlockerId?: string | null; toTaskId: string; lagHours?: number },
) {
  assertPM(ctx.s);
  const dep = await insertDependency(ctx, { ...d, source: "manual" });
  if (d.fromTaskId) {
    const [from, to, trades] = await Promise.all([
      getTask(ctx, d.fromTaskId),
      getTask(ctx, d.toTaskId),
      ctx.store.select("trades"),
    ]);
    const name = (id: string | null) => trades.find((x) => x.id === id)?.name ?? "";
    if (from.trade_id && to.trade_id && from.trade_id !== to.trade_id)
      await recordRuleFeedback(ctx.store, {
        organizationId: ctx.s.project.organization_id,
        predTradeId: from.trade_id,
        succTradeId: to.trade_id,
        decision: "added",
        actor: ctx.s.profile.id,
        lagHours: d.lagHours,
        tradeNames: { pred: name(from.trade_id), succ: name(to.trade_id) },
      });
  }
  return dep;
}

export async function removeDependency(ctx: Ctx, id: string) {
  assertPM(ctx.s);
  const dep = await ctx.store.byId("dependencies", id);
  if (!dep || dep.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return withRelease(ctx.store, ctx.s.project.id, { actor: ctx.s.profile.id, source: "manual", now: nowOf(ctx) }, async () => {
    await ctx.store.remove("dependencies", { id });
    await audit(ctx.store, {
      projectId: ctx.s.project.id,
      entityType: "dependency",
      entityId: id,
      action: "delete",
      from: `${dep.from_task_id ?? dep.from_blocker_id}->${dep.to_task_id}`,
      actor: ctx.s.profile.id,
      source: "manual",
    });
    return {};
  });
}

// ───────────────────────── external blockers ─────────────────────────

export async function createBlocker(
  ctx: Ctx,
  input: { title: string; owner_name?: string | null; owner_phone?: string | null; expected_date?: string | null; notes?: string | null; messageId?: string | null },
  blocksTaskIds: string[] = [],
  source: ChangeSource = "manual",
): Promise<{ blocker: ExternalBlocker; dependencies: Dependency[] }> {
  assertPM(ctx.s);
  if (!input.title.trim()) throw new ServiceError(he.errors.invalid);
  const [blocker] = await ctx.store.insert("external_blockers", {
    project_id: ctx.s.project.id,
    title: input.title.trim(),
    owner_name: input.owner_name ?? null,
    owner_phone: input.owner_phone ?? null,
    expected_date: input.expected_date ?? null,
    notes: input.notes ?? null,
    created_from_message_id: input.messageId ?? null,
  });
  await audit(ctx.store, {
    projectId: ctx.s.project.id,
    entityType: "blocker",
    entityId: blocker.id,
    action: "create",
    to: "open",
    actor: ctx.s.profile.id,
    source,
  });
  const deps: Dependency[] = [];
  for (const taskId of blocksTaskIds)
    deps.push(await insertDependency(ctx, { fromBlockerId: blocker.id, toTaskId: taskId, source: source === "manual" ? "manual" : "ai" }));
  return { blocker, dependencies: deps };
}

export async function setBlockerStatus(ctx: Ctx, id: string, status: ExternalBlocker["status"]) {
  assertPM(ctx.s);
  const b = await ctx.store.byId("external_blockers", id);
  if (!b || b.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return withRelease(
    ctx.store,
    ctx.s.project.id,
    { actor: ctx.s.profile.id, source: "manual", now: nowOf(ctx), cause: status === "resolved" ? b.title : undefined },
    async () => {
      await ctx.store.update(
        "external_blockers",
        { id },
        { status, resolved_at: status === "resolved" ? nowOf(ctx).toISOString() : null },
      );
      await audit(ctx.store, {
        projectId: ctx.s.project.id,
        entityType: "blocker",
        entityId: id,
        action: "status",
        from: b.status,
        to: status,
        actor: ctx.s.profile.id,
        source: "manual",
      });
      return {};
    },
  );
}
