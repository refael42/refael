/**
 * Completion flow: contractor reports "done" with photos → task goes to
 * awaiting_approval → PM approves (→ done, downstream auto-released and
 * notified) or rejects with a comment (→ back to in_progress).
 */
import type { CompletionReport } from "../db/types";
import { he } from "../i18n/he";
import { assertCanReportTask, assertPM } from "./access";
import { audit } from "./audit";
import { AccessError } from "./auth-types";
import { isOwnMediaKey } from "./chat";
import { messageContractor, postSystemMessage, projectPMs } from "./messaging";
import { notify } from "./notify";
import { withRelease } from "./release";
import { ServiceError, setTaskStatus, type Ctx } from "./tasks";

export async function submitReport(
  ctx: Ctx,
  input: { taskId: string; photoKeys: string[]; note?: string | null; sourceMessageId?: string | null },
): Promise<CompletionReport> {
  const { store, s } = ctx;
  const task = await store.byId("tasks", input.taskId);
  if (!task) throw new AccessError(he.errors.notFound, 404);
  assertCanReportTask(s, task);
  if (task.status === "done") throw new ServiceError(he.errors.invalid);
  if (!input.photoKeys.length) throw new ServiceError(he.completion.photoRequired);
  if (input.photoKeys.some((k) => !isOwnMediaKey(k, s.project.id))) throw new ServiceError(he.errors.invalid);
  if (await store.first("completion_reports", { where: { task_id: task.id, status: "pending" } }))
    throw new ServiceError(he.status.awaiting_approval);

  const [report] = await store.insert("completion_reports", {
    task_id: task.id,
    contractor_id: task.contractor_id,
    submitted_by: s.profile.id,
    photo_urls: input.photoKeys,
    note: input.note?.trim() || null,
    status: "pending",
    message_id: input.sourceMessageId ?? null,
  });
  await store.update("tasks", { id: task.id }, { status: "awaiting_approval", started_at: task.started_at ?? new Date().toISOString() });
  await audit(store, {
    projectId: s.project.id,
    entityType: "task",
    entityId: task.id,
    action: "status",
    from: task.status,
    to: "awaiting_approval",
    actor: s.profile.id,
    source: input.sourceMessageId ? "chat" : "manual",
    meta: { report_id: report.id },
  });

  // The photos also appear in the contractor's chat with the PM, next to the report notice
  const sent = s.role === "contractor"
    ? await messageContractor(store, s.project.id, task.contractor_id, he.sys.reportSubmitted(s.profile.full_name, task.title), { task_id: task.id })
    : null;
  if (sent) {
    for (const key of input.photoKeys)
      await store.insert("messages", {
        conversation_id: sent.conversationId,
        project_id: s.project.id,
        sender_profile_id: s.profile.id,
        kind: "image",
        media_url: key,
        meta: { task_id: task.id },
      });
  }
  if (input.sourceMessageId) await store.insert("message_links", { message_id: input.sourceMessageId, task_id: task.id, kind: "completion" }).catch(() => undefined);

  const pms = await projectPMs(store, s.project.id);
  await notify(
    store,
    pms
      .filter((p) => p !== s.profile.id)
      .map((pm) => ({
        profileId: pm,
        projectId: s.project.id,
        kind: "report",
        title: he.notify.reportTitle,
        body: `${s.profile.full_name}: ${task.title}`,
        link: "/approvals",
      })),
  );
  return report;
}

export async function approveReport(ctx: Ctx, reportId: string, comment?: string | null) {
  assertPM(ctx.s);
  const { store, s } = ctx;
  const report = await store.byId("completion_reports", reportId);
  const task = report ? await store.byId("tasks", report.task_id) : null;
  if (!report || !task || task.project_id !== s.project.id) throw new AccessError(he.errors.notFound, 404);
  if (report.status !== "pending") throw new ServiceError(he.errors.invalid);
  const now = (ctx.now ?? new Date()).toISOString();

  const res = await withRelease(store, s.project.id, { actor: s.profile.id, source: "manual", now: ctx.now, cause: task.title }, async () => {
    await store.update("completion_reports", { id: reportId }, { status: "approved", reviewed_by: s.profile.id, reviewed_at: now, review_comment: comment?.trim() || null });
    await store.update("tasks", { id: task.id }, { status: "done", completed_at: now });
    await store.update("reminders", { task_id: task.id, status: { in: ["pending", "sent"] } }, { status: "resolved" });
    await audit(store, {
      projectId: s.project.id,
      entityType: "task",
      entityId: task.id,
      action: "status",
      from: task.status,
      to: "done",
      actor: s.profile.id,
      source: "manual",
      meta: { report_id: reportId },
    });
    return {};
  });
  const sent = await messageContractor(store, s.project.id, task.contractor_id, he.sys.reportApproved(task.title), { task_id: task.id });
  if (sent)
    await notify(store, [
      { profileId: sent.profileId, projectId: s.project.id, kind: "report_approved", title: he.notify.approvedTitle, body: task.title, link: `/tasks/${task.id}` },
    ]);
  return res;
}

export async function rejectReport(ctx: Ctx, reportId: string, comment: string) {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!comment.trim()) throw new ServiceError(he.completion.rejectComment);
  const report = await store.byId("completion_reports", reportId);
  const task = report ? await store.byId("tasks", report.task_id) : null;
  if (!report || !task || task.project_id !== s.project.id) throw new AccessError(he.errors.notFound, 404);
  if (report.status !== "pending") throw new ServiceError(he.errors.invalid);
  const now = (ctx.now ?? new Date()).toISOString();
  await store.update("completion_reports", { id: reportId }, { status: "rejected", reviewed_by: s.profile.id, reviewed_at: now, review_comment: comment.trim() });
  await store.update("tasks", { id: task.id }, { status: "in_progress" });
  await audit(store, {
    projectId: s.project.id,
    entityType: "task",
    entityId: task.id,
    action: "status",
    from: task.status,
    to: "in_progress",
    actor: s.profile.id,
    source: "manual",
    meta: { report_id: reportId, rejected: comment.trim() },
  });
  const sent = await messageContractor(store, s.project.id, task.contractor_id, he.sys.reportRejected(task.title, comment.trim()), {
    action: "report_rejected",
    task_id: task.id,
  });
  if (sent)
    await notify(store, [
      { profileId: sent.profileId, projectId: s.project.id, kind: "report_rejected", title: he.notify.rejectedTitle, body: `${task.title}: ${comment.trim()}`, link: `/tasks/${task.id}` },
    ]);
}

/**
 * PM approval of a chat "done" message: approve the pending report if one
 * exists, otherwise complete the task directly (PM's own confirmation).
 */
export async function approvePendingReportOrComplete(
  ctx: Ctx,
  taskId: string,
  opts: { source: "chat" | "manual"; messageId?: string | null },
): Promise<{ released: string[]; reportId: string | null }> {
  assertPM(ctx.s);
  const pending = await ctx.store.first("completion_reports", { where: { task_id: taskId, status: "pending" } });
  if (pending) {
    const r = await approveReport(ctx, pending.id);
    return { released: r.released, reportId: pending.id };
  }
  const r = await setTaskStatus(ctx, taskId, "done", { source: opts.source });
  // close any open photo request for this task
  if (opts.messageId) {
    const task = await ctx.store.byId("tasks", taskId);
    if (task) {
      const msg = await ctx.store.byId("messages", opts.messageId);
      if (msg) await postSystemMessage(ctx.store, ctx.s.project.id, msg.conversation_id, he.sys.reportApproved(task.title), { task_id: taskId });
    }
  }
  return { released: r.released, reportId: null };
}
