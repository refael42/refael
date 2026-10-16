/**
 * Project intelligence, step 2 — from raw messages to events to updates.
 *
 * processSource reads the waiting messages of a chat (locally, for free) and
 * stores the events it finds, already matched to tasks. Nothing changes until
 * the PM applies an event; each applied change keeps the message, quote and
 * who said it, so every status can be traced back to its source.
 */
import type { Area, Contractor, EventType, ProjectEvent, Source, SourceItem, Task } from "../db/types";
import { TIME_ZONE } from "../i18n";
import { he } from "../i18n/he";
import { dateFrom, extractEvents, matchTasks, NEEDS_TASKS, type ExtractedEvent, type ProjectFacts, type Speaker } from "../intel/extract";
import { Learner, type Example } from "../intel/learn";
import { assertPM } from "./access";
import { audit } from "./audit";
import { AccessError } from "./auth-types";
import { approvePendingReportOrComplete } from "./completion";
import { createBlocker, createTasks, ServiceError, setTaskStatus, updateTask, type Ctx } from "./tasks";

const BATCH = 400;

async function facts(ctx: Ctx): Promise<ProjectFacts> {
  const [areas, trades, contractors, tasks] = await Promise.all([
    ctx.store.select("areas", { where: { project_id: ctx.s.project.id } }),
    ctx.store.select("trades", { order: [["sort_order", "asc"]] }),
    ctx.store.select("contractors", { where: { organization_id: ctx.s.project.organization_id } }),
    ctx.store.select("tasks", { where: { project_id: ctx.s.project.id } }),
  ]);
  return { areas, trades, contractors, tasks };
}

async function speakerOf(ctx: Ctx, item: SourceItem, contractors: Contractor[]): Promise<Speaker> {
  if (!item.author_profile_id) return { name: item.author ?? "", role: null, contractorId: null };
  const member = await ctx.store.first("project_members", { where: { project_id: ctx.s.project.id, profile_id: item.author_profile_id } });
  return {
    name: item.author ?? "",
    role: member?.role ?? null,
    contractorId: contractors.find((c) => c.profile_id === item.author_profile_id)?.id ?? null,
  };
}

/** In a 1:1 chat, the contractor on the other side (whom the PM's "סיים" is about). */
function counterpartOf(src: Source, contractors: Contractor[]): Contractor | null {
  if (src.is_group) return null;
  const ids = Object.values(src.speakers).filter((v) => !v.ignore && v.profile_id).map((v) => v.profile_id!);
  const cs = contractors.filter((c) => c.profile_id && ids.includes(c.profile_id));
  return cs.length === 1 ? cs[0] : null;
}

/** The PM's past decisions as examples: approved / hand-marked = "yes", dismissed = "no". */
async function learnerFor(ctx: Ctx): Promise<Learner> {
  const events = await ctx.store.select("project_events", { where: { project_id: ctx.s.project.id }, order: [["created_at", "desc"]] });
  const examples: Example[] = [];
  for (const e of events.slice(0, 3000)) {
    if (!e.quote) continue;
    const manual = e.extracted?.engine === "manual";
    if (e.status === "applied" || (manual && e.status !== "dismissed")) examples.push({ id: e.id, type: e.type, text: e.quote, positive: true });
    else if (e.status === "dismissed" && !manual) examples.push({ id: e.id, type: e.type, text: e.quote, positive: false });
  }
  return new Learner(examples);
}

function resolve(e: ExtractedEvent, f: ProjectFacts) {
  const tasks = matchTasks(e, f);
  let status: ProjectEvent["status"] = "proposed";
  let note: string | null = null;
  if (NEEDS_TASKS.includes(e.type) && !tasks.length) {
    status = "needs_info";
    note = e.contractorId || e.tradeId ? he.intel.noTasks : he.intel.noWho;
  } else if (e.type === "commitment" && !e.date) {
    status = "needs_info";
    note = he.intel.noDate;
  } else if (e.type === "defect" && !e.areaIds.length && !tasks.length) {
    status = "needs_info";
    note = he.intel.noPlace;
  }
  return {
    status,
    note,
    resolved: { task_ids: tasks.map((t) => t.id), area_ids: e.areaIds, contractor_id: e.contractorId, trade_id: e.tradeId, date: e.date },
  };
}

/** Human summary of an event, from what was matched. */
export function summarize(e: Pick<ExtractedEvent, "type" | "contractorId" | "tradeId" | "areaIds" | "all" | "exceptAreaIds" | "date">, f: ProjectFacts): string {
  const who = f.contractors.find((c) => c.id === e.contractorId)?.name;
  const trade = f.trades.find((t) => t.id === e.tradeId)?.name;
  const areaName = (id: string) => f.areas.find((a) => a.id === id)?.name ?? "";
  const where = e.areaIds.length ? e.areaIds.map(areaName).join(", ") : e.all ? he.intel.everywhere : "";
  const except = e.exceptAreaIds.length ? ` ${he.intel.except}${e.exceptAreaIds.map(areaName).join(", ")}` : "";
  return he.intel.summary[e.type]({ who: who ?? "", trade: trade ?? "", where: `${where}${except}`.trim(), date: e.date ?? "" });
}

/** Read the waiting messages of a chat. Call again while `remaining` > 0. */
export async function processSource(ctx: Ctx, sourceId: string): Promise<{ processed: number; events: number; remaining: number }> {
  assertPM(ctx.s);
  const src = await ctx.store.byId("sources", sourceId);
  if (!src || src.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  const waiting = await ctx.store.select("source_items", { where: { source_id: src.id, status: "new" }, order: [["sent_at", "asc"]] });
  const batch = waiting.slice(0, BATCH);
  const f = await facts(ctx);
  const counterpart = counterpartOf(src, f.contractors);
  const speakers = new Map<string, Speaker>();
  const learner = await learnerFor(ctx);
  // a message read again keeps what the PM already decided: no second card of the same kind
  const ids = batch.map((i) => i.id);
  const before = ids.length ? await ctx.store.select("project_events", { where: { source_item_id: { in: ids } } }) : [];
  const decided = new Set(before.map((e) => `${e.source_item_id}|${e.type}`));
  let events = 0;
  for (const item of batch) {
    const key = item.author_profile_id ?? `?${item.author}`;
    if (!speakers.has(key)) speakers.set(key, await speakerOf(ctx, item, f.contractors));
    const found = (
      item.text ? extractEvents(item.text, { speaker: speakers.get(key)!, counterpart, sentAt: new Date(item.sent_at), timeZone: TIME_ZONE, facts: f, learner }) : []
    ).filter((e) => !decided.has(`${item.id}|${e.type}`));
    if (found.length) {
      await ctx.store.insert(
        "project_events",
        found.map((e) => {
          const r = resolve(e, f);
          return {
            project_id: ctx.s.project.id,
            source_item_id: item.id,
            type: e.type,
            summary: summarize(e, f),
            quote: e.quote,
            extracted: { all: e.all, except_area_ids: e.exceptAreaIds, commit: e.commit, engine: e.learnedFrom ? "learned" : "local", like: e.learnedFrom ?? null },
            resolved: r.resolved,
            confidence: e.confidence,
            status: r.status,
            note: r.note,
            occurred_at: item.sent_at,
          };
        }),
      );
      events += found.length;
    }
    await ctx.store.update("source_items", { id: item.id }, { status: "processed" });
  }
  return { processed: batch.length, events, remaining: waiting.length - batch.length };
}

/**
 * Read a chat again from scratch: suggestions the PM has not decided on are
 * dropped and their messages go back to waiting. Decided ones (applied or
 * dismissed) stay as they are, and so do their messages.
 */
export async function reprocessSource(ctx: Ctx, sourceId: string): Promise<{ removed: number; waiting: number }> {
  assertPM(ctx.s);
  const src = await ctx.store.byId("sources", sourceId);
  if (!src || src.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  const items = await ctx.store.select("source_items", { where: { source_id: src.id, status: "processed" } });
  if (!items.length) return { removed: 0, waiting: 0 };
  const ids = items.map((i) => i.id);
  const events = await ctx.store.select("project_events", { where: { source_item_id: { in: ids } } });
  // undecided suggestions go; hand-marked ones and decisions stay (reading again won't repeat them)
  const open = events.filter((e) => (e.status === "proposed" || e.status === "needs_info") && e.extracted?.engine !== "manual");
  if (open.length) await ctx.store.remove("project_events", { id: { in: open.map((e) => e.id) } });
  for (let i = 0; i < ids.length; i += 500) await ctx.store.update("source_items", { id: { in: ids.slice(i, i + 500) } }, { status: "new" });
  return { removed: open.length, waiting: ids.length };
}

/**
 * The PM marks a message the reader missed as an update. It lands in the
 * updates queue like any other (nothing changes until approved) and teaches
 * the reader: similar messages will be proposed from now on.
 */
export async function markAsEvent(
  ctx: Ctx,
  itemId: string,
  input: { type: EventType; areaIds: string[]; contractorId: string | null; quote: string | null },
): Promise<{ eventId: string }> {
  assertPM(ctx.s);
  const item = await ctx.store.byId("source_items", itemId);
  if (!item || item.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  if (!(input.type in he.intel.type)) throw new ServiceError(he.errors.invalid);
  const f = await facts(ctx);
  const areaIds = input.areaIds.filter((id) => f.areas.some((a) => a.id === id));
  const contractor = input.contractorId ? f.contractors.find((c) => c.id === input.contractorId) ?? null : null;
  if (input.contractorId && !contractor) throw new AccessError(he.errors.notFound, 404);
  const quote = (input.quote ?? item.text ?? "").trim().slice(0, 500);
  if (!quote) throw new ServiceError(he.errors.invalid);
  const e: ExtractedEvent = {
    type: input.type,
    quote,
    contractorId: contractor?.id ?? null,
    tradeId: contractor?.trade_id ?? null,
    areaIds,
    all: false,
    exceptAreaIds: [],
    date: input.type === "commitment" ? dateFrom(quote, new Date(item.sent_at), TIME_ZONE) : null,
    commit: input.type === "commitment" ? "finish" : null,
    confidence: 1,
  };
  const r = resolve(e, f);
  const [row] = await ctx.store.insert("project_events", {
    project_id: ctx.s.project.id,
    source_item_id: item.id,
    type: e.type,
    summary: summarize(e, f),
    quote,
    extracted: { all: false, except_area_ids: [], commit: e.commit, engine: "manual", by: ctx.s.profile.id },
    resolved: r.resolved,
    confidence: 1,
    status: r.status,
    note: r.note,
    occurred_at: item.sent_at,
  });
  if (item.status === "new") await ctx.store.update("source_items", { id: item.id }, { status: "processed" });
  return { eventId: row.id };
}

export interface EventCard {
  event: ProjectEvent;
  author: string;
  sourceTitle: string;
  sourceId: string | null;
  text: string | null;
  tasks: Array<{ id: string; title: string; area: string; status: Task["status"] }>;
}

export async function listEvents(ctx: Ctx, opts: { status?: Array<ProjectEvent["status"]>; limit?: number } = {}): Promise<EventCard[]> {
  if (ctx.s.role !== "pm" && ctx.s.role !== "viewer") throw new AccessError(he.errors.forbidden, 403);
  const statuses = opts.status ?? ["proposed", "needs_info"];
  const events = (
    await ctx.store.select("project_events", { where: { project_id: ctx.s.project.id, status: { in: statuses } }, order: [["occurred_at", "desc"]] })
  ).slice(0, opts.limit ?? 200);
  if (!events.length) return [];
  const itemIds = [...new Set(events.map((e) => e.source_item_id).filter(Boolean) as string[])];
  const items = itemIds.length ? await ctx.store.select("source_items", { where: { id: { in: itemIds } } }) : [];
  const sources = items.length ? await ctx.store.select("sources", { where: { id: { in: [...new Set(items.map((i) => i.source_id))] } } }) : [];
  const f = await facts(ctx);
  const profileIds = [...new Set(items.map((i) => i.author_profile_id).filter(Boolean) as string[])];
  const profiles = profileIds.length ? await ctx.store.select("profiles", { where: { id: { in: profileIds } } }) : [];
  const areaById = new Map<string, Area>(f.areas.map((a) => [a.id, a]));
  const taskById = new Map(f.tasks.map((t) => [t.id, t]));
  return events.map((event) => {
    const item = items.find((i) => i.id === event.source_item_id);
    const src = sources.find((s) => s.id === item?.source_id);
    const ids = event.status === "applied" ? event.resolved.applied_task_ids ?? event.resolved.task_ids ?? [] : event.resolved.task_ids ?? [];
    return {
      event,
      author: profiles.find((p) => p.id === item?.author_profile_id)?.full_name ?? item?.author ?? "",
      sourceTitle: src?.title ?? "",
      sourceId: src?.id ?? null,
      text: item?.text ?? null,
      tasks: ids
        .map((id) => taskById.get(id))
        .filter((t): t is Task => !!t)
        .map((t) => ({ id: t.id, title: t.title, area: t.area_id ? areaById.get(t.area_id)?.name ?? "" : "", status: t.status })),
    };
  });
}

export async function countOpenEvents(ctx: Ctx): Promise<number> {
  if (ctx.s.role !== "pm") return 0;
  return (await ctx.store.select("project_events", { where: { project_id: ctx.s.project.id, status: { in: ["proposed", "needs_info"] } } })).length;
}

async function ownEvent(ctx: Ctx, id: string): Promise<ProjectEvent> {
  const e = await ctx.store.byId("project_events", id);
  if (!e || e.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return e;
}

/**
 * Apply an event (optionally to a chosen subset of its tasks). A contractor's
 * "done" becomes "בוצע, לא נבדק" — only an inspection makes it done.
 */
export async function applyEvent(ctx: Ctx, id: string, opts: { taskIds?: string[] } = {}): Promise<{ changed: number; released: number }> {
  assertPM(ctx.s);
  const e = await ownEvent(ctx, id);
  if (e.status === "applied" || e.status === "dismissed") throw new ServiceError(he.intel.alreadyDecided);
  const proposed = e.resolved.task_ids ?? [];
  const taskIds = (opts.taskIds ?? proposed).filter((t) => proposed.includes(t));
  if (NEEDS_TASKS.includes(e.type) && !taskIds.length) throw new ServiceError(he.intel.noTasks);
  const item = e.source_item_id ? await ctx.store.byId("source_items", e.source_item_id) : null;
  const now = (ctx.now ?? new Date()).toISOString();
  let changed = 0;
  let released = 0;
  let blockerId: string | null = null;
  const tasks = taskIds.length ? await ctx.store.select("tasks", { where: { id: { in: taskIds }, project_id: ctx.s.project.id } }) : [];

  switch (e.type as EventType) {
    case "reported_done": {
      // photos the same person sent around that message are the proof for the inspection
      const photos = item ? await nearbyPhotos(ctx, item) : [];
      for (const t of tasks) {
        if (t.status === "done" || t.status === "awaiting_approval") continue;
        await ctx.store.insert("completion_reports", {
          task_id: t.id,
          contractor_id: t.contractor_id,
          submitted_by: item?.author_profile_id ?? ctx.s.profile.id,
          photo_urls: photos,
          note: e.quote,
          status: "pending",
          message_id: null,
        });
        await ctx.store.update("tasks", { id: t.id }, { status: "awaiting_approval", started_at: t.started_at ?? e.occurred_at });
        await audit(ctx.store, {
          projectId: ctx.s.project.id,
          entityType: "task",
          entityId: t.id,
          action: "status",
          from: t.status,
          to: "awaiting_approval",
          actor: ctx.s.profile.id,
          source: "chat",
          meta: { event_id: e.id, source_item_id: e.source_item_id, quote: e.quote },
        });
        changed++;
      }
      break;
    }
    case "inspected_ok":
      for (const t of tasks) {
        if (t.status === "done") continue;
        const r = await approvePendingReportOrComplete(ctx, t.id, { source: "chat" });
        released += r.released.length;
        changed++;
      }
      break;
    case "started":
      for (const t of tasks) {
        if (t.status !== "planned" && t.status !== "ready") continue;
        await setTaskStatus(ctx, t.id, "in_progress", { source: "chat" });
        changed++;
      }
      break;
    case "commitment":
      if (e.resolved.date)
        for (const t of tasks) {
          await updateTask(ctx, t.id, e.extracted.commit === "finish" ? { planned_end: e.resolved.date } : { planned_start: e.resolved.date });
          changed++;
        }
      break;
    case "blocker":
    case "material_missing":
    case "approval_missing": {
      const r = await createBlocker(ctx, { title: e.summary, notes: e.quote }, taskIds, "ai");
      blockerId = r.blocker.id;
      changed = taskIds.length;
      break;
    }
    case "defect":
    case "new_task": {
      const areaId = e.resolved.area_ids?.[0] ?? tasks[0]?.area_id ?? null;
      const r = await createTasks(
        ctx,
        [
          {
            title: (e.type === "defect" ? `${he.intel.fixPrefix} ${e.quote ?? e.summary}` : e.quote ?? e.summary).slice(0, 90),
            description: e.quote,
            area_id: areaId,
            contractor_id: e.resolved.contractor_id ?? null,
            trade_id: e.resolved.trade_id ?? null,
            status: "planned",
          },
        ],
        { source: "ai" },
      );
      changed = r.tasks.length;
      taskIds.push(...r.tasks.map((t) => t.id));
      break;
    }
    default:
      // instruction changes and dependency hints are recorded, not acted on
      break;
  }

  await ctx.store.update("project_events", { id: e.id }, {
    status: "applied",
    decided_by: ctx.s.profile.id,
    decided_at: now,
    resolved: { ...e.resolved, applied_task_ids: taskIds, blocker_id: blockerId },
  });
  return { changed, released };
}

export async function dismissEvent(ctx: Ctx, id: string) {
  assertPM(ctx.s);
  const e = await ownEvent(ctx, id);
  if (e.status === "applied") throw new ServiceError(he.intel.alreadyDecided);
  await ctx.store.update("project_events", { id: e.id }, { status: "dismissed", decided_by: ctx.s.profile.id, decided_at: (ctx.now ?? new Date()).toISOString() });
}

/** One decision for a whole list: approve the checked lines, dismiss the rest. */
export async function decideEvents(ctx: Ctx, input: { apply: string[]; dismiss: string[] }): Promise<{ changed: number }> {
  assertPM(ctx.s);
  if (input.apply.length + input.dismiss.length > 200) throw new ServiceError(he.errors.invalid);
  let changed = 0;
  for (const id of input.apply) changed += (await applyEvent(ctx, id)).changed;
  for (const id of input.dismiss) await dismissEvent(ctx, id);
  return { changed };
}

const PHOTO_WINDOW_MS = 2 * 3600_000;

/** Pictures the author of a message sent in the same chat within two hours of it. */
async function nearbyPhotos(ctx: Ctx, item: SourceItem): Promise<string[]> {
  if (!item.author) return [];
  const t0 = Date.parse(item.sent_at);
  const items = await ctx.store.select("source_items", { where: { source_id: item.source_id, kind: "image" } });
  return items
    .filter((i) => i.media_url && i.author === item.author && Math.abs(Date.parse(i.sent_at) - t0) <= PHOTO_WINDOW_MS)
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at))
    .map((i) => i.media_url!)
    .slice(0, 10);
}

/** Waiting messages per source (for the "read messages" button). */
export async function waitingCount(ctx: Ctx, sourceId: string): Promise<number> {
  return (await ctx.store.select("source_items", { where: { source_id: sourceId, status: "new" } })).length;
}
