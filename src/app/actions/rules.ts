"use server";
import * as svc from "@/lib/services/rules";
import { run } from "./_run";

export async function createRuleAction(input: svc.RuleInput) {
  return run(async (ctx) => (await svc.createRule(ctx, input)).id);
}
export async function updateRuleAction(id: string, patch: Partial<svc.RuleInput>) {
  return run(async (ctx) => {
    await svc.updateRule(ctx, id, patch);
  });
}
export async function deleteRuleAction(id: string) {
  return run(async (ctx) => {
    await svc.deleteRule(ctx, id);
  });
}
