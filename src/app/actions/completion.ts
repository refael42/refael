"use server";
import * as svc from "@/lib/services/completion";
import { run } from "./_run";

export async function submitReportAction(input: { taskId: string; photoKeys: string[]; note?: string | null; sourceMessageId?: string | null }) {
  return run(async (ctx) => {
    const r = await svc.submitReport(ctx, input);
    return { id: r.id };
  });
}

export async function approveReportAction(reportId: string, comment?: string | null) {
  return run(async (ctx) => (await svc.approveReport(ctx, reportId, comment)).released.length);
}

export async function rejectReportAction(reportId: string, comment: string) {
  return run(async (ctx) => {
    await svc.rejectReport(ctx, reportId, comment);
  });
}
