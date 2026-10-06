/**
 * Projects: open a new project (company + PM membership + building structure),
 * edit its details, and switch setup mode on/off.
 */
import type { Store } from "../db/store";
import type { Area, Project } from "../db/types";
import { serverEnv } from "../env";
import { FEATURES } from "../flow/process";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { audit } from "./audit";
import { AccessError, type Session } from "./auth-types";
import { normalizePhone } from "./settings";
import { ServiceError, type Ctx } from "./tasks";

export interface StructureInput {
  buildingName: string;
  /** e.g. 0..8 → "קומת קרקע", "קומה 1" … "קומה 8" */
  floorFrom: number;
  floorTo: number;
  aptsPerFloor: number;
  /** number of the first apartment; apartments are numbered continuously */
  firstApt: number;
  /** "parking" | "elevator" | "sprinklers" */
  buildingFeatures?: string[];
  /** apartments on the lowest floor are garden apartments */
  gardenOnFirst?: boolean;
  /** apartments on the top floor are duplexes (מכפילים) */
  duplexOnTop?: boolean;
}

/** Who may open a project: PMs of any project, listed admins, and anyone in demo mode. */
export function canCreateProject(s: Session): boolean {
  if (s.isDemo) return true;
  if (s.memberships.some((m) => m.role === "pm")) return true;
  const ids = [s.profile.email?.toLowerCase(), normalizePhone(s.profile.phone)].filter(Boolean) as string[];
  const admins = serverEnv.admins.map((a) => (a.includes("@") ? a : normalizePhone(a) ?? a));
  return ids.some((x) => admins.includes(x));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function createProject(
  store: Store,
  s: Session,
  input: { companyName?: string; name: string; address?: string | null; startDate?: string | null; targetDate?: string | null; structure?: StructureInput | null },
  now = new Date(),
): Promise<Project> {
  if (!canCreateProject(s)) throw new AccessError(he.errors.pmOnly, 403);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new ServiceError(he.errors.invalid);
  if ((input.startDate && !ISO.test(input.startDate)) || (input.targetDate && !ISO.test(input.targetDate))) throw new ServiceError(he.errors.invalid);

  let orgId = s.profile.organization_id ?? (s.project?.organization_id || null);
  if (!orgId) {
    const company = input.companyName?.trim();
    if (!company) throw new ServiceError(he.setup.companyRequired);
    [{ id: orgId }] = await store.insert("organizations", [{ name: company }]);
    await store.update("profiles", { id: s.profile.id }, { organization_id: orgId });
  }
  const [project] = await store.insert("projects", [
    {
      organization_id: orgId,
      name,
      address: input.address?.trim() || null,
      start_date: input.startDate || null,
      target_date: input.targetDate || null,
      setup_mode: true,
    },
  ]);
  await store.insert("project_members", [{ project_id: project.id, profile_id: s.profile.id, role: "pm" }]);
  await audit(store, { projectId: project.id, entityType: "project", entityId: project.id, action: "created", to: name, actor: s.profile.id, source: "manual" });
  if (input.structure) await buildStructure(store, project.id, input.structure);
  void now;
  return project;
}

/** Building → floors → apartments, numbered continuously. Skips what already exists. */
export async function buildStructure(store: Store, projectId: string, input: StructureInput): Promise<{ floors: number; apartments: number }> {
  const { floorFrom, floorTo, aptsPerFloor, firstApt } = input;
  const bname = input.buildingName.trim() || he.setup.defaultBuilding;
  input = { ...input, buildingFeatures: (input.buildingFeatures ?? []).filter((f) => FEATURES[f]?.of === "building") };
  if (!Number.isInteger(floorFrom) || !Number.isInteger(floorTo) || floorTo < floorFrom || floorTo - floorFrom > 60) throw new ServiceError(he.errors.invalid);
  if (!Number.isInteger(aptsPerFloor) || aptsPerFloor < 0 || aptsPerFloor > 30 || !Number.isInteger(firstApt) || firstApt < 0) throw new ServiceError(he.errors.invalid);

  const areas = await store.select("areas", { where: { project_id: projectId } });
  const find = (parent: string | null, name: string) => areas.find((a) => a.parent_id === parent && a.name === name);
  const add = async (row: Omit<Area, "id" | "created_at">) => {
    const [a] = await store.insert("areas", [row]);
    areas.push(a);
    return a;
  };
  const building =
    find(null, bname) ??
    (await add({ project_id: projectId, parent_id: null, type: "building", name: bname, sort_order: areas.filter((a) => !a.parent_id).length + 1, features: input.buildingFeatures ?? [] }));
  let apt = firstApt;
  let floors = 0;
  let apartments = 0;
  const rows: Array<Omit<Area, "id" | "created_at">> = [];
  for (let f = floorFrom; f <= floorTo; f++) {
    const fname = f === 0 ? he.setup.groundFloor : he.setup.floor(f);
    let floor = find(building.id, fname);
    if (!floor) {
      floor = await add({ project_id: projectId, parent_id: building.id, type: "floor", name: fname, sort_order: f, features: [] });
      floors++;
    }
    for (let k = 0; k < aptsPerFloor; k++, apt++) {
      const aname = he.setup.apartment(apt);
      if (find(floor.id, aname)) continue;
      const features = [
        ...(input.gardenOnFirst && f === floorFrom ? ["garden"] : []),
        ...(input.duplexOnTop && f === floorTo ? ["duplex"] : []),
      ];
      rows.push({ project_id: projectId, parent_id: floor.id, type: "apartment", name: aname, sort_order: apt, features });
      apartments++;
    }
  }
  if (rows.length) await store.insert("areas", rows);
  return { floors, apartments };
}

export async function updateProject(ctx: Ctx, input: { name?: string; address?: string | null; startDate?: string | null; targetDate?: string | null }) {
  assertPM(ctx.s);
  const patch: Partial<Project> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new ServiceError(he.errors.invalid);
    patch.name = input.name.trim();
  }
  if (input.address !== undefined) patch.address = input.address?.trim() || null;
  for (const [k, v] of [["start_date", input.startDate], ["target_date", input.targetDate]] as const) {
    if (v === undefined) continue;
    if (v && !ISO.test(v)) throw new ServiceError(he.errors.invalid);
    patch[k] = v || null;
  }
  const [p] = await ctx.store.update("projects", { id: ctx.s.project.id }, patch);
  return p;
}

export async function setSetupMode(ctx: Ctx, on: boolean) {
  assertPM(ctx.s);
  await ctx.store.update("projects", { id: ctx.s.project.id }, { setup_mode: on });
  await audit(ctx.store, { projectId: ctx.s.project.id, entityType: "project", entityId: ctx.s.project.id, action: "setup_mode", to: String(on), actor: ctx.s.profile.id, source: "manual" });
}
