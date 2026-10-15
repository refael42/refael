import type { PlanDiscipline, PlanFile } from "../db/types";
import { he } from "../i18n/he";
import { analyzePlanText } from "../plans/analyze";
import { assertPM } from "./access";
import { audit } from "./audit";
import { AccessError } from "./auth-types";
import { isOwnMediaKey } from "./chat";
import { ServiceError, type Ctx } from "./tasks";

const MAX_TEXT = 60_000;

export interface NewPlan {
  title: string;
  fileKey: string;
  floorAreaId?: string | null;
  /** text read from the PDF in the browser */
  text?: string | null;
  pageCount?: number | null;
  /** upload as a new version of this plan */
  supersedesId?: string | null;
  changeNote?: string | null;
}

/**
 * Add a plan, or a new version of one. The PDF's text tells its discipline,
 * sheet, revision and the apartments / floors it shows (the PM can correct
 * them). A new version takes over the old one's details and pins; the old
 * one stays, marked as not current.
 */
export async function createPlan(ctx: Ctx, input: NewPlan) {
  assertPM(ctx.s);
  if (!isOwnMediaKey(input.fileKey, ctx.s.project.id) || !input.fileKey.endsWith(".pdf")) throw new ServiceError(he.errors.invalid);
  const prev = input.supersedesId ? await ownPlan(ctx, input.supersedesId) : null;
  const title = input.title.trim() || prev?.title || "";
  if (!title) throw new ServiceError(he.errors.invalid);
  const text = (input.text ?? "").slice(0, MAX_TEXT) || null;
  const areas = await ctx.store.select("areas", { where: { project_id: ctx.s.project.id } });
  const read = analyzePlanText(text ?? "", title, areas);
  const floorAreaId = input.floorAreaId ?? prev?.floor_area_id ?? null;
  const areaIds = [...new Set([...(prev?.area_ids ?? []), ...read.areaIds, ...(floorAreaId ? [floorAreaId] : [])])];

  const base = { project_id: ctx.s.project.id, title, file_url: input.fileKey, floor_area_id: floorAreaId, created_by: ctx.s.profile.id };
  let plan: PlanFile;
  try {
    [plan] = await ctx.store.insert("plan_files", {
      ...base,
      discipline: read.discipline ?? prev?.discipline ?? null,
      sheet: read.sheet ?? prev?.sheet ?? null,
      revision: read.revision,
      version: prev ? prev.version + 1 : 1,
      supersedes_id: prev?.id ?? null,
      is_current: true,
      area_ids: areaIds,
      page_count: input.pageCount ?? null,
      text_index: text,
      change_note: input.changeNote?.trim() || null,
    });
  } catch (err) {
    // the database has not been updated for versions yet: keep the plan, without the details
    if (prev) throw err;
    console.warn("[plans] saving without details:", (err as Error).message);
    [plan] = await ctx.store.insert("plan_files", base as Parameters<typeof ctx.store.insert<"plan_files">>[1]);
  }
  if (prev) {
    await ctx.store.update("plan_files", { id: prev.id }, { is_current: false });
    // the drawing usually keeps its layout: carry the marked points over
    const pins = await ctx.store.select("plan_pins", { where: { plan_file_id: prev.id } });
    if (pins.length)
      await ctx.store.insert(
        "plan_pins",
        pins.map((p) => ({ plan_file_id: plan.id, page: p.page, x: p.x, y: p.y, area_id: p.area_id, label: p.label })),
      );
  }
  await audit(ctx.store, {
    projectId: ctx.s.project.id,
    entityType: "plan",
    entityId: plan.id,
    action: prev ? "new_version" : "create",
    actor: ctx.s.profile.id,
    source: "manual",
    ...(prev ? { meta: { supersedes: prev.id, version: plan.version } } : {}),
  });
  return plan;
}

/** The PM corrects what was read from the PDF. */
export async function updatePlan(
  ctx: Ctx,
  planId: string,
  patch: { title?: string; discipline?: PlanDiscipline | null; sheet?: string | null; revision?: string | null; areaIds?: string[]; changeNote?: string | null },
) {
  assertPM(ctx.s);
  const plan = await ownPlan(ctx, planId);
  const next: Partial<PlanFile> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new ServiceError(he.errors.invalid);
    next.title = patch.title.trim();
  }
  if (patch.discipline !== undefined) {
    if (patch.discipline && !DISCIPLINE_KEYS.includes(patch.discipline)) throw new ServiceError(he.errors.invalid);
    next.discipline = patch.discipline;
  }
  if (patch.sheet !== undefined) next.sheet = patch.sheet?.trim() || null;
  if (patch.revision !== undefined) next.revision = patch.revision?.trim() || null;
  if (patch.changeNote !== undefined) next.change_note = patch.changeNote?.trim() || null;
  if (patch.areaIds !== undefined) {
    const areas = await ctx.store.select("areas", { where: { project_id: ctx.s.project.id } });
    next.area_ids = [...new Set(patch.areaIds)].filter((id) => areas.some((a) => a.id === id));
  }
  await ctx.store.update("plan_files", { id: plan.id }, next);
}

/** All versions of a plan, newest first. */
export async function planVersions(ctx: Ctx, planId: string): Promise<PlanFile[]> {
  const plan = await ownPlan(ctx, planId);
  const all = await ctx.store.select("plan_files", { where: { project_id: ctx.s.project.id } });
  const byId = new Map(all.map((p) => [p.id, p]));
  // walk back to the first version, then forward through everything that replaced it
  let root = plan;
  while (root.supersedes_id && byId.has(root.supersedes_id)) root = byId.get(root.supersedes_id)!;
  const chain: PlanFile[] = [root];
  for (let cur: PlanFile | undefined = root; cur; ) {
    cur = all.find((p) => p.supersedes_id === cur!.id);
    if (cur) chain.push(cur);
  }
  return chain.reverse();
}

/** Current plans that show an area: named on it, on its floor or building, or with a pin in it. */
export async function plansForArea(ctx: Ctx, areaId: string): Promise<PlanFile[]> {
  const areas = await ctx.store.select("areas", { where: { project_id: ctx.s.project.id } });
  const byId = new Map(areas.map((a) => [a.id, a]));
  if (!byId.has(areaId)) return [];
  const around = new Set<string>();
  for (let a = byId.get(areaId); a; a = a.parent_id ? byId.get(a.parent_id) : undefined) around.add(a.id);
  const plans = (await ctx.store.select("plan_files", { where: { project_id: ctx.s.project.id } })).filter((p) => p.is_current !== false);
  const pins = plans.length ? await ctx.store.select("plan_pins", { where: { plan_file_id: { in: plans.map((p) => p.id) }, area_id: areaId } }) : [];
  const pinned = new Set(pins.map((p) => p.plan_file_id));
  return plans
    .filter((p) => pinned.has(p.id) || (p.floor_area_id && around.has(p.floor_area_id)) || (p.area_ids ?? []).some((id) => around.has(id)))
    .sort((a, b) => DISCIPLINE_KEYS.indexOf(a.discipline ?? "other") - DISCIPLINE_KEYS.indexOf(b.discipline ?? "other") || a.title.localeCompare(b.title, "he"));
}

export const DISCIPLINE_KEYS: PlanDiscipline[] = ["architecture", "structure", "electrical", "plumbing", "hvac", "fire", "landscape", "other"];

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
  const plan = await ownPlan(ctx, planId);
  // keep the version chain whole: the previous version comes back when the newest goes
  await ctx.store.update("plan_files", { supersedes_id: plan.id }, { supersedes_id: plan.supersedes_id });
  if (plan.supersedes_id && plan.is_current !== false) await ctx.store.update("plan_files", { id: plan.supersedes_id }, { is_current: true });
  const pins = await ctx.store.select("plan_pins", { where: { plan_file_id: planId } });
  if (pins.length) await ctx.store.update("tasks", { plan_pin_id: { in: pins.map((p) => p.id) } }, { plan_pin_id: null });
  await ctx.store.remove("plan_files", { id: planId });
}
