"use server";
import type { FlowStage } from "@/lib/flow/process";
import { applyFlow, assignByTrade, captureExisting, toggleCaptured } from "@/lib/services/flow";
import { resetFlow, saveFlow } from "@/lib/services/flow-template";
import { run } from "./_run";

export async function applyFlowAction(input: { areaIds: string[]; startDate: string; staggerDays?: number; contractorByTrade?: Record<string, string | null> }) {
  return run((ctx) => applyFlow(ctx, input));
}

export async function saveFlowAction(stages: FlowStage[]) {
  return run(async (ctx) => (await saveFlow(ctx, stages)).length);
}

export async function resetFlowAction() {
  return run(async (ctx) => {
    await resetFlow(ctx);
  });
}

export async function captureExistingAction(input: { areaIds: string[]; doneUpTo: string | null; rescheduleFrom?: string | null }) {
  return run((ctx) => captureExisting(ctx, input));
}

export async function toggleCapturedAction(taskId: string) {
  return run((ctx) => toggleCaptured(ctx, taskId));
}

export async function assignByTradeAction(input: { areaIds: string[] | null; byTrade: Record<string, string | null> }) {
  return run((ctx) => assignByTrade(ctx, input));
}
