/**
 * Engine 4 — the periodic tick (cron every ~10 min in production, every
 * minute in demo mode). Idempotent: every reminder has a dedupe_key, so
 * running it twice never notifies twice.
 *
 *  check        task.check_at passed, no completion confirmation
 *  overdue      planned_end passed, not done (once per day)
 *  no_response  PM wrote to a contractor, no reply for N hours
 *  escalation   repeated unanswered reminders on the same task → urgent
 *  critical_blocker  open external blocker holding critical-path work (daily)
 *  + releases tasks whose drying / lag time just elapsed
 */
import { analyze } from "../engine";
import type { Store } from "../db/store";
import type { ReminderKind, Task } from "../db/types";
import { serverEnv } from "../env";
import { he } from "../i18n/he";
import { directConversation, projectPMs } from "./messaging";
import { notify } from "./notify";
import { releaseReady } from "./release";
import { areaLabel, loadSnapshot, toEngineInput } from "./snapshot";

export const ESCALATE_AFTER = 2;

export interface TickResult {
  reminders: number;
  released: number;
}

async function remind(
  store: Store,
  r: { projectId: string; kind: ReminderKind; dedupeKey: string; taskId?: string; messageId?: string; blockerId?: string; target: string | null; now: Date },
): Promise<boolean> {
  if (await store.first("reminders", { where: { dedupe_key: r.dedupeKey } })) return false;
  try {
    await store.insert("reminders", {
      project_id: r.projectId,
      task_id: r.taskId ?? null,
      message_id: r.messageId ?? null,
      blocker_id: r.blockerId ?? null,
      kind: r.kind,
      due_at: r.now.toISOString(),
      sent_at: r.now.toISOString(),
      status: "sent",
      target_profile_id: r.target,
      dedupe_key: r.dedupeKey,
    });
    return true;
  } catch {
    return false; // concurrent tick inserted it first
  }
}

export async function runTick(store: Store, now = new Date(), opts: { windowMinutes?: number; projectId?: string } = {}): Promise<TickResult> {
  const projects = opts.projectId ? [(await store.byId("projects", opts.projectId))!] : await store.select("projects");
  const total: TickResult = { reminders: 0, released: 0 };
  for (const p of projects) {
    const r = await tickProject(store, p.id, now, opts.windowMinutes ?? 15);
    total.reminders += r.reminders;
    total.released += r.released;
  }
  return total;
}

async function tickProject(store: Store, projectId: string, now: Date, windowMinutes: number): Promise<TickResult> {
  const snap = await loadSnapshot(store, projectId, now);
  const pms = await projectPMs(store, projectId);
  if (!pms.length) return { reminders: 0, released: 0 };
  const today = now.toISOString().slice(0, 10);
  let count = 0;
  const contractorProfile = (t: Task) => (t.contractor_id ? snap.contractorById.get(t.contractor_id)?.profile_id ?? null : null);

  const followUp = async (pm: string, t: Task) => {
    const prof = contractorProfile(t);
    if (!prof) return null;
    const conversation_id = await directConversation(store, projectId, pm, prof);
    return { type: "send_follow_up" as const, conversation_id, text: he.sys.followUp(t.title), task_id: t.id };
  };

  const open = snap.tasks.filter((t) => t.status !== "done" && t.status !== "awaiting_approval");

  // 1. promised checks
  for (const t of open) {
    if (!t.check_at || t.check_at > now.toISOString()) continue;
    for (const pm of pms) {
      if (!(await remind(store, { projectId, kind: "check", dedupeKey: `check:${t.id}:${t.check_at}:${pm}`, taskId: t.id, target: pm, now }))) continue;
      count++;
      await notify(store, [
        {
          profileId: pm,
          projectId,
          kind: "check",
          title: he.notify.checkTitle,
          body: he.notify.check(t.title, areaLabel(snap.areaById, t.area_id)),
          link: `/tasks/${t.id}`,
          action: await followUp(pm, t),
        },
      ]);
    }
  }

  // 2. overdue (daily) — only for work that can actually progress; a blocked
  //    task's lateness is reported through its blocker instead.
  for (const t of open) {
    const st = snap.analysis.byTask[t.id].effective;
    if (st !== "ready" && st !== "in_progress") continue;
    if (!t.planned_end || t.planned_end >= today) continue;
    const days = Math.max(1, Math.round((Date.parse(today) - Date.parse(t.planned_end)) / 86_400_000));
    for (const pm of pms) {
      if (!(await remind(store, { projectId, kind: "overdue", dedupeKey: `overdue:${t.id}:${today}:${pm}`, taskId: t.id, target: pm, now }))) continue;
      count++;
      await notify(store, [
        {
          profileId: pm,
          projectId,
          kind: "overdue",
          title: he.notify.overdueTitle,
          body: he.notify.overdue(t.title, days),
          link: `/tasks/${t.id}`,
          action: await followUp(pm, t),
        },
      ]);
    }
  }

  // 3. escalation: repeated reminders on a still-open task
  const sent = await store.select("reminders", { where: { project_id: projectId, kind: { in: ["check", "overdue"] } } });
  for (const t of open) {
    const mine = sent.filter((r) => r.task_id === t.id);
    // misses on separate days (several reminders in one tick are one miss)
    const days = new Set(mine.map((r) => (r.sent_at ?? r.created_at).slice(0, 10))).size;
    if (days < ESCALATE_AFTER) continue;
    const n = mine.length;
    const level = Math.floor(days / ESCALATE_AFTER);
    for (const pm of pms) {
      if (!(await remind(store, { projectId, kind: "escalation", dedupeKey: `escalation:${t.id}:${level}:${pm}`, taskId: t.id, target: pm, now }))) continue;
      count++;
      await notify(store, [
        {
          profileId: pm,
          projectId,
          kind: "escalation",
          title: he.notify.escalationTitle,
          body: he.notify.escalation(t.title, n),
          link: `/tasks/${t.id}`,
          urgent: true,
          action: await followUp(pm, t),
        },
      ]);
    }
  }

  // 4. no response from a contractor
  const hours = serverEnv.noResponseHours;
  const cutoff = new Date(now.getTime() - hours * 3600_000).toISOString();
  const convs = await store.select("conversations", { where: { project_id: projectId, type: "direct" } });
  for (const c of convs) {
    if (!c.last_message_at || c.last_message_at > cutoff) continue;
    const [last] = await store.select("messages", { where: { conversation_id: c.id, kind: { neq: "system" } }, order: [["created_at", "desc"]], limit: 1 });
    if (!last || !last.sender_profile_id || !pms.includes(last.sender_profile_id) || last.created_at > cutoff) continue;
    const parts = await store.select("conversation_participants", { where: { conversation_id: c.id } });
    const other = parts.find((x) => x.profile_id !== last.sender_profile_id);
    if (!other) continue;
    const isContractor = snap.contractors.some((x) => x.profile_id === other.profile_id);
    if (!isContractor) continue;
    if (!(await remind(store, { projectId, kind: "no_response", dedupeKey: `no_response:${last.id}`, messageId: last.id, target: last.sender_profile_id, now }))) continue;
    count++;
    const name = snap.profileById.get(other.profile_id)?.full_name ?? "";
    await notify(store, [
      {
        profileId: last.sender_profile_id,
        projectId,
        kind: "no_response",
        title: he.notify.noResponseTitle,
        body: he.notify.noResponse(name, Math.round((now.getTime() - Date.parse(last.created_at)) / 3600_000)),
        link: `/chat/${c.id}`,
        action: { type: "send_follow_up", conversation_id: c.id, text: he.sys.noResponseFollowUp },
      },
    ]);
  }

  // 5. external blockers holding critical-path work (daily, urgent)
  for (const b of snap.analysis.bottlenecks.filter((x) => x.kind === "external" && x.blocksCritical)) {
    for (const pm of pms) {
      if (!(await remind(store, { projectId, kind: "critical_blocker", dedupeKey: `critical:${b.id}:${today}:${pm}`, blockerId: b.id, target: pm, now }))) continue;
      count++;
      await notify(store, [
        {
          profileId: pm,
          projectId,
          kind: "critical_blocker",
          title: he.notify.criticalTitle,
          body: he.notify.critical(b.title, b.blocksTransitive),
          link: `/overview#blocker-${b.id}`,
          urgent: true,
        },
      ]);
    }
  }

  // 6. drying / lag elapsed since the last window → release
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  const beforeAnalysis = analyze(toEngineInput(snap.tasks, snap.dependencies, snap.blockers, since));
  const released = await releaseReady(store, projectId, { actor: null, source: "system", now, beforeAnalysis });

  return { reminders: count, released: released.length };
}
