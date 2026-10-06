"use server";
import { applyFlow } from "@/lib/services/flow";
import { run } from "./_run";

export async function applyFlowAction(input: { areaIds: string[]; startDate: string; staggerDays?: number; contractorByTrade?: Record<string, string | null> }) {
  return run((ctx) => applyFlow(ctx, input));
}
