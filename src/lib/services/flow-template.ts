/** The company's construction processes (per kind): custom (flow_templates) or built-in. */
import type { Store } from "../db/store";
import { DEFAULT_FLOWS, FLOW_KINDS, validateFlow, type FlowKind, type FlowStage } from "../flow/process";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { audit } from "./audit";
import { ServiceError, type Ctx } from "./tasks";

export async function loadFlow(store: Store, organizationId: string, kind: FlowKind = "apartment"): Promise<{ stages: FlowStage[]; custom: boolean }> {
  const row = await store.first("flow_templates", { where: { organization_id: organizationId, kind } });
  if (row && Array.isArray(row.stages) && row.stages.length && !validateFlow(row.stages).length) return { stages: row.stages, custom: true };
  return { stages: DEFAULT_FLOWS[kind], custom: false };
}

export function assertKind(kind: string): FlowKind {
  if (!FLOW_KINDS.includes(kind as FlowKind)) throw new ServiceError(he.errors.invalid);
  return kind as FlowKind;
}

function clean(stages: FlowStage[]): FlowStage[] {
  return stages.map((s) => ({
    key: s.key.trim(),
    name: s.name.trim(),
    phase: s.phase,
    trade: s.trade,
    days: Math.round(Number(s.days) * 2) / 2,
    after: s.after.map((a) => ({
      key: a.key,
      ...(a.lag ? { lag: Math.max(0, Math.round(Number(a.lag))) } : {}),
      ...(a.why?.trim() ? { why: a.why.trim() } : {}),
      ...(a.scope === "building" ? { scope: "building" as const } : {}),
    })),
    description: (s.description ?? "").trim(),
    ...(s.when ? { when: s.when } : {}),
    ...(s.part ? { part: s.part } : {}),
  }));
}

export async function saveFlow(ctx: Ctx, stages: FlowStage[], kind: FlowKind = "apartment") {
  assertPM(ctx.s);
  assertKind(kind);
  const next = clean(stages);
  if (next.length > 300) throw new ServiceError(he.errors.invalid);
  const errors = validateFlow(next);
  if (kind === "building" && next.some((s) => !s.part)) errors.push(he.flow.partRequired);
  if (errors.length) throw new ServiceError(errors.join(" · "));
  const org = ctx.s.project.organization_id;
  const now = (ctx.now ?? new Date()).toISOString();
  const existing = await ctx.store.first("flow_templates", { where: { organization_id: org, kind } });
  if (existing) await ctx.store.update("flow_templates", { organization_id: org, kind }, { stages: next, updated_by: ctx.s.profile.id, updated_at: now });
  else await ctx.store.insert("flow_templates", { organization_id: org, kind, stages: next, updated_by: ctx.s.profile.id, updated_at: now });
  await audit(ctx.store, { projectId: ctx.s.project.id, entityType: "rule", entityId: org, action: "flow_saved", to: `${kind}:${next.length}`, actor: ctx.s.profile.id, source: "manual" });
  return next;
}

export async function resetFlow(ctx: Ctx, kind: FlowKind = "apartment") {
  assertPM(ctx.s);
  assertKind(kind);
  await ctx.store.remove("flow_templates", { organization_id: ctx.s.project.organization_id, kind });
}
