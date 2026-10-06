import { he } from "../i18n/he";
import { assertPM } from "./access";
import { audit } from "./audit";
import { AccessError } from "./auth-types";
import { isOwnMediaKey } from "./chat";
import { ServiceError, type Ctx } from "./tasks";

export async function createPlan(ctx: Ctx, input: { title: string; fileKey: string; floorAreaId?: string | null }) {
  assertPM(ctx.s);
  if (!input.title.trim() || !isOwnMediaKey(input.fileKey, ctx.s.project.id) || !input.fileKey.endsWith(".pdf")) throw new ServiceError(he.errors.invalid);
  const [plan] = await ctx.store.insert("plan_files", {
    project_id: ctx.s.project.id,
    title: input.title.trim(),
    file_url: input.fileKey,
    floor_area_id: input.floorAreaId ?? null,
    created_by: ctx.s.profile.id,
  });
  await audit(ctx.store, { projectId: ctx.s.project.id, entityType: "plan", entityId: plan.id, action: "create", actor: ctx.s.profile.id, source: "manual" });
  return plan;
}

async function ownPlan(ctx: Ctx, planId: string) {
  const plan = await ctx.store.byId("plan_files", planId);
  if (!plan || plan.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return plan;
}

export async function addPin(ctx: Ctx, input: { planId: string; page: number; x: number; y: number; areaId: string | null; label?: string | null }) {
  assertPM(ctx.s);
  await ownPlan(ctx, input.planId);
  if (![input.x, input.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) || input.page < 1) throw new ServiceError(he.errors.invalid);
  if (input.areaId) {
    const area = await ctx.store.byId("areas", input.areaId);
    if (!area || area.project_id !== ctx.s.project.id) throw new ServiceError(he.errors.invalid);
  }
  const [pin] = await ctx.store.insert("plan_pins", {
    plan_file_id: input.planId,
    page: Math.round(input.page),
    x: input.x,
    y: input.y,
    area_id: input.areaId,
    label: input.label?.trim() || null,
  });
  return pin;
}

export async function deletePin(ctx: Ctx, pinId: string) {
  assertPM(ctx.s);
  const pin = await ctx.store.byId("plan_pins", pinId);
  if (!pin) throw new AccessError(he.errors.notFound, 404);
  await ownPlan(ctx, pin.plan_file_id);
  await ctx.store.update("tasks", { plan_pin_id: pinId }, { plan_pin_id: null });
  await ctx.store.remove("plan_pins", { id: pinId });
}

export async function deletePlan(ctx: Ctx, planId: string) {
  assertPM(ctx.s);
  await ownPlan(ctx, planId);
  const pins = await ctx.store.select("plan_pins", { where: { plan_file_id: planId } });
  if (pins.length) await ctx.store.update("tasks", { plan_pin_id: { in: pins.map((p) => p.id) } }, { plan_pin_id: null });
  await ctx.store.remove("plan_files", { id: planId });
}
