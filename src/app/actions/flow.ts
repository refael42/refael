"use server";
import type { FlowStage } from "@/lib/flow/process";
import { applyFlow } from "@/lib/services/flow";
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
