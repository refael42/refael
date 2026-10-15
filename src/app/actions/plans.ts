"use server";
import * as svc from "@/lib/services/plans";
import { updateTask } from "@/lib/services/tasks";
import { run } from "./_run";

export async function createPlanAction(input: svc.NewPlan) {
  return run(async (ctx) => (await svc.createPlan(ctx, input)).id);
}
export async function updatePlanAction(planId: string, patch: Parameters<typeof svc.updatePlan>[2]) {
  return run((ctx) => svc.updatePlan(ctx, planId, patch));
}
export async function addPinAction(input: { planId: string; page: number; x: number; y: number; areaId: string | null; label?: string | null }) {
  return run(async (ctx) => (await svc.addPin(ctx, input)).id);
}
export async function deletePinAction(pinId: string) {
  return run(async (ctx) => {
    await svc.deletePin(ctx, pinId);
  });
}
export async function deletePlanAction(planId: string) {
  return run(async (ctx) => {
    await svc.deletePlan(ctx, planId);
  });
}
export async function linkTaskToPinAction(taskId: string, pinId: string | null) {
  return run(async (ctx) => {
    await updateTask(ctx, taskId, { plan_pin_id: pinId });
  });
}
