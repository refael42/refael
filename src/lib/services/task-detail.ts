import type { Store } from "../db/store";
import type { CompletionReport } from "../db/types";
import { t } from "../i18n";
import { canSeeConversation, isStaff } from "./access";
import type { ProjectSession } from "./auth-types";
import { areaPath, snapshotUnlockImpact, type ProjectSnapshot } from "./snapshot";
import { contractorLabel, describeBlocking, taskCard, type BlockerLineVM, type TaskCardVM } from "./views";

export interface TaskDetailVM {
  card: TaskCardVM;
  description: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  checkAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  isCriticalFlag: boolean;
  onCriticalPath: boolean;
  slackDays: number;
  areaPath: Array<{ id: string; name: string }>;
  contractorLabel: string;
  blockedBy: BlockerLineVM[];
  rootBlockers: BlockerLineVM[];
  predecessors: Array<
    | { depId: string; lagHours: number; kind: "task"; task: TaskCardVM }
    | { depId: string; lagHours: number; kind: "blocker"; blocker: { id: string; title: string; status: string; owner: string | null } }
  >;
  successors: Array<{ depId: string; lagHours: number; task: TaskCardVM }>;
  unlockIfDone: { immediate: number; afterLag: number } | null;
  history: Array<{ id: string; at: string; text: string; source: string; actor: string | null }>;
  reports: Array<CompletionReport & { submitter: string | null; reviewer: string | null }>;
  messages: Array<{ id: string; conversationId: string; text: string; sender: string; at: string; kind: string; mediaUrl: string | null }>;
  pin: { planId: string; planTitle: string; page: number; x: number; y: number } | null;
}

export async function taskDetailView(store: Store, s: ProjectSession, snap: ProjectSnapshot, id: string): Promise<TaskDetailVM> {
  const task = snap.taskById.get(id)!;
  const a = snap.analysis.byTask[id];
  const staff = isStaff(s);

  const incoming = snap.dependencies.filter((d) => d.to_task_id === id);
  const outgoing = snap.dependencies.filter((d) => d.from_task_id === id);
  const impact = snapshotUnlockImpact(snap).find((i) => i.taskId === id);

  const [audits, reports, links, pins] = await Promise.all([
    staff ? store.select("audit_log", { where: { entity_type: "task", entity_id: id }, order: [["created_at", "desc"]], limit: 50 }) : Promise.resolve([]),
    store.select("completion_reports", { where: { task_id: id }, order: [["created_at", "desc"]] }),
    store.select("message_links", { where: { task_id: id } }),
    task.plan_pin_id ? store.select("plan_pins", { where: { id: task.plan_pin_id } }) : Promise.resolve([]),
  ]);

  const msgIds = new Set(links.map((l) => l.message_id));
  if (task.created_from_message_id) msgIds.add(task.created_from_message_id);
  for (const r of reports) if (r.message_id) msgIds.add(r.message_id);
  let messages: TaskDetailVM["messages"] = [];
  if (msgIds.size) {
    const rows = await store.select("messages", { where: { id: { in: [...msgIds] } }, order: [["created_at", "asc"]] });
    const convIds = [...new Set(rows.map((m) => m.conversation_id))];
    const [convs, parts] = await Promise.all([
      store.select("conversations", { where: { id: { in: convIds } } }),
      store.select("conversation_participants", { where: { conversation_id: { in: convIds } } }),
    ]);
    const visibleConv = new Set(
      convs.filter((c) => canSeeConversation(s, c, parts.filter((p) => p.conversation_id === c.id))).map((c) => c.id),
    );
    const senderIds = [...new Set(rows.map((m) => m.sender_profile_id).filter(Boolean) as string[])];
    const senders = senderIds.length ? await store.select("profiles", { where: { id: { in: senderIds } } }) : [];
    messages = rows
      .filter((m) => visibleConv.has(m.conversation_id))
      .map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        text: m.text ?? "",
        sender: m.sender_profile_id ? senders.find((p) => p.id === m.sender_profile_id)?.full_name ?? "" : t.chat.system,
        at: m.created_at,
        kind: m.kind,
        mediaUrl: m.media_url,
      }));
  }

  const profileName = async (ids: (string | null)[]) => {
    const list = [...new Set(ids.filter(Boolean) as string[])];
    const rows = list.length ? await store.select("profiles", { where: { id: { in: list } } }) : [];
    return new Map(rows.map((p) => [p.id, p.full_name]));
  };
  const names = await profileName([...audits.map((x) => x.actor_profile_id), ...reports.flatMap((r) => [r.submitted_by, r.reviewed_by])]);

  let pin: TaskDetailVM["pin"] = null;
  if (pins[0]) {
    const plan = await store.byId("plan_files", pins[0].plan_file_id);
    if (plan) pin = { planId: plan.id, planTitle: plan.title, page: pins[0].page, x: pins[0].x, y: pins[0].y };
  }

  const statusName = (v: string | null) => (v ? t.status[v] ?? v : "—");
  return {
    card: taskCard(snap, id),
    description: task.description,
    plannedStart: task.planned_start,
    plannedEnd: task.planned_end,
    checkAt: task.check_at,
    startedAt: task.started_at,
    completedAt: task.completed_at,
    blockedReason: task.blocked_reason,
    isCriticalFlag: task.is_critical,
    onCriticalPath: a.onCriticalPath,
    slackDays: Math.round((a.slackHours / 24) * 10) / 10,
    areaPath: areaPath(snap.areaById, task.area_id).map((x) => ({ id: x.id, name: x.name })),
    contractorLabel: contractorLabel(snap, task.contractor_id),
    blockedBy: a.blockedBy.map((b) => describeBlocking(snap, b)),
    rootBlockers:
      a.rootBlockers.length && JSON.stringify(a.rootBlockers) !== JSON.stringify(a.blockedBy)
        ? a.rootBlockers.map((r) => describeBlocking(snap, r))
        : [],
    predecessors: incoming.map((d) =>
      d.from_task_id
        ? { depId: d.id, lagHours: Number(d.lag_hours), kind: "task" as const, task: taskCard(snap, d.from_task_id) }
        : {
            depId: d.id,
            lagHours: 0,
            kind: "blocker" as const,
            blocker: (() => {
              const b = snap.blockerById.get(d.from_blocker_id!)!;
              return { id: b.id, title: b.title, status: b.status, owner: b.owner_name };
            })(),
          },
    ),
    successors: outgoing.map((d) => ({ depId: d.id, lagHours: Number(d.lag_hours), task: taskCard(snap, d.to_task_id) })),
    unlockIfDone: impact ? { immediate: impact.immediate.length, afterLag: impact.afterLag.length } : null,
    history: audits.map((x) => ({
      id: x.id,
      at: x.created_at,
      source: x.source,
      actor: x.actor_profile_id ? names.get(x.actor_profile_id) ?? null : null,
      text:
        x.action === "status"
          ? t.tasks.historyLine(statusName(x.from_value), statusName(x.to_value))
          : x.action === "create"
            ? `${t.app.add}: ${statusName(x.to_value)}`
            : x.action === "update"
              ? `${t.app.edit}: ${((x.meta?.fields as string[]) ?? []).join(", ")}`
              : x.action,
    })),
    reports: reports
      .filter((r) => staff || (r.contractor_id && s.contractorIds.includes(r.contractor_id)))
      .map((r) => ({
        ...r,
        submitter: r.submitted_by ? names.get(r.submitted_by) ?? null : null,
        reviewer: r.reviewed_by ? names.get(r.reviewed_by) ?? null : null,
      })),
    messages,
    pin,
  };
}
