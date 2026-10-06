/** The company's construction process: custom (flow_templates) or the built-in one. */
import type { Store } from "../db/store";
import { APARTMENT_FLOW, validateFlow, type FlowStage } from "../flow/process";
import { assertPM } from "./access";
import { audit } from "./audit";
import { ServiceError, type Ctx } from "./tasks";

export async function loadFlow(store: Store, organizationId: string): Promise<{ stages: FlowStage[]; custom: boolean }> {
  const row = await store.first("flow_templates", { where: { organization_id: organizationId } });
  if (row && Array.isArray(row.stages) && row.stages.length && !validateFlow(row.stages).length) return { stages: row.stages, custom: true };
  return { stages: APARTMENT_FLOW, custom: false };
}

function clean(stages: FlowStage[]): FlowStage[] {
  return stages.map((s) => ({
    key: s.key.trim(),
    name: s.name.trim(),
    phase: s.phase,
    trade: s.trade,
    days: Math.round(Number(s.days) * 2) / 2,
    after: s.after.map((a) => ({ key: a.key, ...(a.lag ? { lag: Math.max(0, Math.round(Number(a.lag))) } : {}), ...(a.why?.trim() ? { why: a.why.trim() } : {}) })),
    description: (s.description ?? "").trim(),
  }));
}

export async function saveFlow(ctx: Ctx, stages: FlowStage[]) {
  assertPM(ctx.s);
  const next = clean(stages);
  const errors = validateFlow(next);
  if (errors.length) throw new ServiceError(errors.join(" · "));
  const org = ctx.s.project.organization_id;
  const now = (ctx.now ?? new Date()).toISOString();
  const existing = await ctx.store.first("flow_templates", { where: { organization_id: org } });
  if (existing) await ctx.store.update("flow_templates", { organization_id: org }, { stages: next, updated_by: ctx.s.profile.id, updated_at: now });
  else await ctx.store.insert("flow_templates", { organization_id: org, stages: next, updated_by: ctx.s.profile.id, updated_at: now });
  await audit(ctx.store, { projectId: ctx.s.project.id, entityType: "rule", entityId: org, action: "flow_saved", to: String(next.length), actor: ctx.s.profile.id, source: "manual" });
  return next;
}

export async function resetFlow(ctx: Ctx) {
  assertPM(ctx.s);
  await ctx.store.remove("flow_templates", { organization_id: ctx.s.project.organization_id });
}
