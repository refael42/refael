/**
 * Engine 2 (intelligence) — every new chat message is parsed into a
 * suggestion. NOTHING enters the graph here: analyzeMessage only stores the
 * suggestion on the message; approveSuggestion (PM only) is the single path
 * that turns it into tasks / dependencies / blockers / completions.
 */
import { claudeAvailable, parseWithClaude } from "../ai/claude";
import type { ParseContext } from "../ai/context";
import { heuristicParse } from "../ai/heuristic";
import { resolveParsed } from "../ai/resolve";
import type { Store } from "../db/store";
import type { AiParsedJson, Message } from "../db/types";
import { serverEnv } from "../env";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { audit } from "./audit";
import { AccessError } from "./auth-types";
import { postSystemMessage, projectPMs } from "./messaging";
import { notify } from "./notify";
import { loadRules } from "./rules";
import { approvePendingReportOrComplete } from "./completion";
import { createBlocker, createTasks, ServiceError, type Ctx } from "./tasks";
import type { DependencySuggestion } from "./rules";

export async function buildParseContext(store: Store, msg: Message, now: Date): Promise<ParseContext> {
  const project = (await store.byId("projects", msg.project_id))!;
  const [areas, trades, contractors, tasks, { rules }, parts, members] = await Promise.all([
    store.select("areas", { where: { project_id: project.id } }),
    store.select("trades", { order: [["sort_order", "asc"]] }),
    store.select("contractors", { where: { organization_id: project.organization_id } }),
    store.select("tasks", { where: { project_id: project.id, status: { neq: "done" } } }),
    loadRules(store, project.organization_id),
    store.select("conversation_participants", { where: { conversation_id: msg.conversation_id } }),
    store.select("project_members", { where: { project_id: project.id } }),
  ]);
  const profiles = parts.length ? await store.select("profiles", { where: { id: { in: parts.map((p) => p.profile_id) } } }) : [];
  const sender = profiles.find((p) => p.id === msg.sender_profile_id);
  const role = members.find((m) => m.profile_id === msg.sender_profile_id)?.role ?? null;
  return {
    areas,
    trades,
    contractors,
    tasks,
    rules,
    sender: {
      profileId: msg.sender_profile_id,
      name: sender?.full_name ?? "",
      role,
      contractorId: contractors.find((c) => c.profile_id === msg.sender_profile_id)?.id ?? null,
    },
    addressees: profiles
      .filter((p) => p.id !== msg.sender_profile_id)
      .map((p) => ({ name: p.full_name, contractorId: contractors.find((c) => c.profile_id === p.id)?.id ?? null })),
    now,
  };
}

/** Parse a message (Claude if configured, else the local parser) and store the suggestion. */
export async function analyzeMessage(
  store: Store,
  messageId: string,
  opts: { now?: Date; force?: boolean } = {},
): Promise<AiParsedJson | null> {
  const now = opts.now ?? new Date();
  const msg = await store.byId("messages", messageId);
  if (!msg || msg.kind !== "text" || !msg.text || !msg.sender_profile_id) return null;
  if (msg.ai_parsed_json && !opts.force) return msg.ai_parsed_json;

  const ctx = await buildParseContext(store, msg, now);
  let parsed: AiParsedJson;
  if (claudeAvailable()) {
    try {
      const out = await parseWithClaude(msg.text, ctx);
      parsed = out ? resolveParsed(out, ctx, "claude", serverEnv.anthropicModel) : resolveParsed(heuristicParse(msg.text, ctx), ctx, "heuristic");
    } catch (err) {
      console.warn("[ai] Claude parse failed, using local parser:", (err as Error).message);
      parsed = resolveParsed(heuristicParse(msg.text, ctx), ctx, "heuristic");
    }
  } else {
    parsed = resolveParsed(heuristicParse(msg.text, ctx), ctx, "heuristic");
  }

  // Re-read: the PM may have acted while we were parsing.
  const fresh = await store.byId("messages", messageId);
  if (!fresh || fresh.ai_status !== "none") return fresh?.ai_parsed_json ?? null;
  const status = parsed.intent === "none" ? "none" : "suggested";
  await store.update("messages", { id: messageId }, { ai_parsed_json: parsed, ai_status: status });
  if (status === "none") return parsed;

  // Contractor said "done" → ask for a photo (the report itself is his explicit action).
  const target = parsed.resolved?.completes_task_id;
  if (parsed.intent === "completion_report" && target && ctx.sender.role === "contractor") {
    const task = await store.byId("tasks", target);
    const pending = await store.first("completion_reports", { where: { task_id: target, status: "pending" } });
    if (task && !pending && task.contractor_id === ctx.sender.contractorId) {
      await postSystemMessage(store, msg.project_id, msg.conversation_id, he.sys.requestPhoto(ctx.sender.name, task.title), {
        action: "request_photo",
        task_id: task.id,
        for_profile_id: msg.sender_profile_id,
        source_message_id: msg.id,
      });
    }
  }

  if (ctx.sender.role !== "pm") {
    const pms = await projectPMs(store, msg.project_id);
    await notify(
      store,
      pms.map((pm) => ({
        profileId: pm,
        projectId: msg.project_id,
        kind: "ai_suggestion",
        title: he.notify.suggestionTitle,
        body: `${ctx.sender.name}: ${msg.text!.slice(0, 120)}`,
        link: `/chat/${msg.conversation_id}#m-${msg.id}`,
      })),
    );
  }
  return parsed;
}

export interface ApproveEdits {
  tasks?: Array<{
    title: string;
    area_id: string | null;
    contractor_id: string | null;
    trade_id: string | null;
    status: "planned" | "in_progress" | "done" | null;
    check_in_days: number | null;
    depends_on_index: number | null;
  }>;
  affects_task_ids?: string[];
  completes_task_id?: string | null;
  blocker_text?: string | null;
  blocker_owner?: string | null;
}

export interface ApproveResult {
  createdTaskIds: string[];
  released: number;
  suggestions: DependencySuggestion[];
}

async function loadSuggested(ctx: Ctx, messageId: string): Promise<Message & { ai_parsed_json: AiParsedJson }> {
  const msg = await ctx.store.byId("messages", messageId);
  if (!msg || msg.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  if (msg.ai_status !== "suggested" || !msg.ai_parsed_json) throw new ServiceError(he.errors.invalid);
  return msg as Message & { ai_parsed_json: AiParsedJson };
}

/** PM approves (optionally edited) suggestion → the only path from AI into the graph. */
export async function approveSuggestion(ctx: Ctx, messageId: string, edits: ApproveEdits = {}): Promise<ApproveResult> {
  assertPM(ctx.s);
  const msg = await loadSuggested(ctx, messageId);
  const ai = msg.ai_parsed_json;
  const resolved = ai.resolved ?? { tasks: [], affects_task_ids: [], completes_task_id: null };
  const affects = edits.affects_task_ids ?? resolved.affects_task_ids;
  const applied: NonNullable<AiParsedJson["applied"]> = {};
  const result: ApproveResult = { createdTaskIds: [], released: 0, suggestions: [] };

  // Claim it first so a double click cannot apply twice.
  const claimed = await ctx.store.update(
    "messages",
    { id: messageId, ai_status: "suggested" },
    { ai_status: "accepted", ai_reviewed_by: ctx.s.profile.id, ai_reviewed_at: (ctx.now ?? new Date()).toISOString() },
  );
  if (!claimed.length) throw new ServiceError(he.errors.invalid);

  try {
    if (ai.intent === "new_task") {
      const tasks =
        edits.tasks ??
        ai.tasks.map((t, i) => ({
          title: t.title,
          area_id: resolved.tasks[i]?.area_id ?? null,
          contractor_id: resolved.tasks[i]?.contractor_id ?? null,
          trade_id: resolved.tasks[i]?.trade_id ?? null,
          status: t.status,
          check_in_days: t.check_in_days,
          depends_on_index: t.depends_on_index,
        }));
      if (!tasks.length) throw new ServiceError(he.errors.invalid);
      const chain = tasks
        .map((t, i) => ({ from: t.depends_on_index ?? -1, to: i }))
        .filter((e) => e.from >= 0 && e.from < e.to);
      // the tasks nothing else in the chain waits on carry the "affects" edges
      const sinks = tasks.map((_, i) => i).filter((i) => !chain.some((e) => e.from === i));
      const created = await createTasks(
        ctx,
        tasks.map((t) => ({
          title: t.title,
          area_id: t.area_id,
          contractor_id: t.contractor_id,
          trade_id: t.trade_id,
          status: t.status ?? "planned",
          check_in_days: t.check_in_days,
        })),
        {
          source: "ai",
          messageId,
          chain,
          affects: sinks.flatMap((i) => affects.map((toTaskId) => ({ fromIndex: i, toTaskId }))),
        },
      );
      applied.task_ids = created.tasks.map((t) => t.id);
      applied.dependency_ids = created.dependencies.map((d) => d.id);
      result.createdTaskIds = applied.task_ids;
      result.suggestions = created.suggestions;
    } else if (ai.intent === "completion_report") {
      const taskId = edits.completes_task_id ?? resolved.completes_task_id;
      if (!taskId) throw new ServiceError(he.errors.invalid);
      const r = await approvePendingReportOrComplete(ctx, taskId, { source: "chat", messageId });
      result.released = r.released.length;
      applied.report_id = r.reportId ?? undefined;
      await ctx.store.insert("message_links", { message_id: messageId, task_id: taskId, kind: "completion" }).catch(() => undefined);
    } else if (ai.intent === "blocker") {
      const title = (edits.blocker_text ?? ai.blocker_text ?? msg.text ?? "").trim();
      const sender = msg.sender_profile_id ? await ctx.store.byId("profiles", msg.sender_profile_id) : null;
      const { blocker } = await createBlocker(
        ctx,
        { title, owner_name: edits.blocker_owner ?? null, notes: sender ? `${sender.full_name}: ${msg.text}` : msg.text, messageId },
        affects,
        "chat",
      );
      applied.blocker_id = blocker.id;
      for (const taskId of affects)
        await ctx.store.insert("message_links", { message_id: messageId, task_id: taskId, kind: "blocker" }).catch(() => undefined);
    }
    // question / decision: recording the PM's acknowledgement is the action
    await ctx.store.update("messages", { id: messageId }, { ai_parsed_json: { ...ai, applied } });
    await audit(ctx.store, {
      projectId: ctx.s.project.id,
      entityType: "message",
      entityId: messageId,
      action: "ai_accept",
      to: ai.intent,
      actor: ctx.s.profile.id,
      source: "ai",
      meta: { edited: Object.keys(edits).length > 0, ...applied },
    });
    return result;
  } catch (e) {
    // roll the claim back so the PM can fix and retry
    await ctx.store.update("messages", { id: messageId }, { ai_status: "suggested", ai_reviewed_by: null, ai_reviewed_at: null });
    throw e;
  }
}

export async function dismissSuggestion(ctx: Ctx, messageId: string) {
  assertPM(ctx.s);
  await loadSuggested(ctx, messageId);
  await ctx.store.update(
    "messages",
    { id: messageId },
    { ai_status: "dismissed", ai_reviewed_by: ctx.s.profile.id, ai_reviewed_at: (ctx.now ?? new Date()).toISOString() },
  );
  await audit(ctx.store, {
    projectId: ctx.s.project.id,
    entityType: "message",
    entityId: messageId,
    action: "ai_dismiss",
    actor: ctx.s.profile.id,
    source: "ai",
  });
}

