/**
 * Contractor performance: how reliably each contractor finishes on time,
 * how often their work is sent back, and how fast they answer messages.
 * Pure — the caller loads the rows.
 */
import type { CompletionReport, Contractor, Message, Task } from "../db/types";
import { localDate } from "../i18n";

export interface ContractorPerformance {
  contractorId: string;
  name: string;
  /** tasks assigned in this project */
  total: number;
  done: number;
  /** done tasks that had a planned end */
  measured: number;
  onTime: number;
  /** % of measured tasks finished on/before planned end (null when nothing measured) */
  onTimePct: number | null;
  /** open tasks already past their planned end */
  overdue: number;
  reports: number;
  rejected: number;
  rejectPct: number | null;
  /** median hours between a message to the contractor and their next reply */
  medianReplyHours: number | null;
  /** 0–100 composite, null when there is too little data */
  score: number | null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function contractorPerformance(input: {
  contractors: Contractor[];
  tasks: Task[];
  reports: CompletionReport[];
  /** messages of the conversations the contractors take part in */
  messages: Message[];
  now: Date;
}): ContractorPerformance[] {
  const today = localDate(input.now);
  const byConv = new Map<string, Message[]>();
  for (const m of input.messages) (byConv.get(m.conversation_id) ?? byConv.set(m.conversation_id, []).get(m.conversation_id)!).push(m);
  for (const list of byConv.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return input.contractors
    .map((c) => {
      const tasks = input.tasks.filter((t) => t.contractor_id === c.id);
      const done = tasks.filter((t) => t.status === "done");
      const measuredTasks = done.filter((t) => t.planned_end && t.completed_at);
      const onTime = measuredTasks.filter((t) => localDate(new Date(t.completed_at!)) <= t.planned_end!).length;
      const overdue = tasks.filter((t) => t.status !== "done" && t.planned_end && t.planned_end < today).length;
      const reports = input.reports.filter((r) => r.contractor_id === c.id && r.status !== "pending");
      const rejected = reports.filter((r) => r.status === "rejected").length;

      // reply time: first unanswered message from someone else → the contractor's next message
      const replies: number[] = [];
      if (c.profile_id)
        for (const list of byConv.values()) {
          if (!list.some((m) => m.sender_profile_id === c.profile_id)) continue;
          let pending: string | null = null;
          for (const m of list) {
            if (m.sender_profile_id === c.profile_id) {
              if (pending) replies.push((Date.parse(m.created_at) - Date.parse(pending)) / 3_600_000);
              pending = null;
            } else if (!pending) pending = m.created_at;
          }
        }

      const onTimePct = measuredTasks.length ? Math.round((100 * onTime) / measuredTasks.length) : null;
      const rejectPct = reports.length ? Math.round((100 * rejected) / reports.length) : null;
      const medianReplyHours = median(replies);
      const parts: Array<[number, number]> = [];
      if (onTimePct !== null) parts.push([onTimePct, 0.5]);
      if (rejectPct !== null) parts.push([100 - rejectPct, 0.3]);
      // replying within 2h scores 100, a day or more scores 0
      if (medianReplyHours !== null) parts.push([Math.max(0, Math.min(100, 100 - ((medianReplyHours - 2) / 22) * 100)), 0.2]);
      const w = parts.reduce((s, p) => s + p[1], 0);
      const score = w ? Math.round(parts.reduce((s, p) => s + p[0] * p[1], 0) / w) : null;

      return {
        contractorId: c.id,
        name: c.name,
        total: tasks.length,
        done: done.length,
        measured: measuredTasks.length,
        onTime,
        onTimePct,
        overdue,
        reports: reports.length,
        rejected,
        rejectPct,
        medianReplyHours: medianReplyHours === null ? null : Math.round(medianReplyHours * 10) / 10,
        score,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.done - a.done);
}
