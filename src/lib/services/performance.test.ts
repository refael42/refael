import { describe, expect, it } from "vitest";
import type { CompletionReport, Contractor, Message, Task } from "../db/types";
import { contractorPerformance } from "./performance";

const now = new Date("2026-10-06T09:00:00Z");
const c = (id: string, profile: string | null): Contractor => ({ id, organization_id: "o", profile_id: profile, name: id, phone: null, trade_id: null, company: null, created_at: "" });
const task = (id: string, contractor: string, p: Partial<Task>): Task =>
  ({ id, project_id: "p", contractor_id: contractor, title: id, status: "planned", planned_end: null, completed_at: null, ...p }) as Task;
const report = (contractor: string, status: CompletionReport["status"]) => ({ contractor_id: contractor, status }) as CompletionReport;
const msg = (conv: string, sender: string | null, at: string) => ({ conversation_id: conv, sender_profile_id: sender, created_at: at }) as Message;

describe("contractor performance", () => {
  it("measures on-time, overdue, rework and reply time", () => {
    const [p] = contractorPerformance({
      contractors: [c("vadim", "pv"), c("idle", null)],
      tasks: [
        task("t1", "vadim", { status: "done", planned_end: "2026-10-01", completed_at: "2026-09-30T10:00:00Z" }),
        task("t2", "vadim", { status: "done", planned_end: "2026-10-01", completed_at: "2026-10-03T10:00:00Z" }),
        task("t3", "vadim", { status: "in_progress", planned_end: "2026-10-04" }),
        task("t4", "vadim", { status: "planned", planned_end: "2026-10-20" }),
      ],
      reports: [report("vadim", "approved"), report("vadim", "rejected"), report("vadim", "pending")],
      messages: [
        msg("c1", null, "2026-10-01T08:00:00Z"),
        msg("c1", "pm", "2026-10-01T08:30:00Z"),
        msg("c1", "pv", "2026-10-01T10:00:00Z"), // 2h after the first unanswered message
        msg("c1", "pm", "2026-10-02T08:00:00Z"),
        msg("c1", "pv", "2026-10-02T12:00:00Z"), // 4h
        msg("c2", "pm", "2026-10-02T08:00:00Z"), // conversation without the contractor: ignored
      ],
      now,
    });
    expect(p).toMatchObject({ contractorId: "vadim", total: 4, done: 2, onTimePct: 50, overdue: 1, rejected: 1, reports: 2, rejectPct: 50, medianReplyHours: 3 });
    expect(p.score).toBeGreaterThan(0);
  });

  it("skips contractors without tasks and has no score without data", () => {
    const res = contractorPerformance({ contractors: [c("a", null), c("b", null)], tasks: [task("t", "b", {})], reports: [], messages: [], now });
    expect(res.map((x) => x.contractorId)).toEqual(["b"]);
    expect(res[0].score).toBeNull();
  });
});
