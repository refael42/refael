"use server";
import type { FlowKind, FlowStage } from "@/lib/flow/process";
import { applyFlow, assignByTrade, captureExisting, setFeatures, toggleCaptured } from "@/lib/services/flow";
import { resetFlow, saveFlow } from "@/lib/services/flow-template";
import { run } from "./_run";

export async function applyFlowAction(input: {
  kind?: FlowKind;
  areaIds: string[];
  startDate: string;
  staggerDays?: number;
  contractorByTrade?: Record<string, string | null>;
}) {
  return run((ctx) => applyFlow(ctx, input));
}

export async function saveFlowAction(stages: FlowStage[], kind: FlowKind = "apartment") {
  return run(async (ctx) => (await saveFlow(ctx, stages, kind)).length);
}

export async function resetFlowAction(kind: FlowKind = "apartment") {
  return run(async (ctx) => {
    await resetFlow(ctx, kind);
  });
}

export async function captureExistingAction(input: { kind?: FlowKind; areaIds: string[]; doneUpTo: string | null; rescheduleFrom?: string | null }) {
  return run((ctx) => captureExisting(ctx, input));
}

export async function toggleCapturedAction(taskId: string) {
  return run((ctx) => toggleCaptured(ctx, taskId));
}

export async function assignByTradeAction(input: { areaIds: string[] | null; byTrade: Record<string, string | null> }) {
  return run((ctx) => assignByTrade(ctx, input));
}

export async function setFeaturesAction(input: { areaIds: string[]; add: string[]; remove: string[] }) {
  return run((ctx) => setFeatures(ctx, input));
}
