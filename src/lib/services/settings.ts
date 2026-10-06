/**
 * Project setup (PM): areas hierarchy, contractors and project members.
 * A contractor is a person (profile) + a contractor row + project membership;
 * when he first logs in with that phone/email, the auth trigger links him.
 */
import type { Area, AreaType, MemberRole } from "../db/types";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { AccessError } from "./auth-types";
import { directConversation } from "./messaging";
import { areaSubtree } from "./snapshot";
import { ServiceError, type Ctx } from "./tasks";

const CHILD_TYPES: Record<AreaType | "root", AreaType[]> = {
  root: ["building", "common"],
  building: ["floor", "common"],
  floor: ["apartment", "common", "room"],
  apartment: ["room"],
  common: ["room"],
  room: [],
};

/** Israeli local format → E.164 (050-1234567 → +972501234567). Null for empty/invalid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function cleanEmail(raw: string | null | undefined): string | null {
  const e = raw?.trim().toLowerCase();
  return e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

// ───────────────────────── areas ─────────────────────────

async function ownArea(ctx: Ctx, id: string): Promise<Area> {
  const a = await ctx.store.byId("areas", id);
  if (!a || a.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return a;
}

/**
 * Create one or more sibling areas. `names` may contain a numeric range
 * shorthand: "דירה 21-25" → דירה 21 … דירה 25.
 */
export async function createAreas(ctx: Ctx, input: { parentId: string | null; type: AreaType; names: string[] }): Promise<Area[]> {
  assertPM(ctx.s);
  const parent = input.parentId ? await ownArea(ctx, input.parentId) : null;
  if (!CHILD_TYPES[parent ? parent.type : "root"].includes(input.type)) throw new ServiceError(he.settings.badAreaType);
  const names = expandNames(input.names);
  if (!names.length || names.length > 200) throw new ServiceError(he.errors.invalid);
  const siblings = await ctx.store.select("areas", { where: { project_id: ctx.s.project.id, parent_id: parent?.id ?? null } });
  const existing = new Set(siblings.map((s) => s.name));
  const fresh = names.filter((n) => !existing.has(n));
  const start = siblings.reduce((m, s) => Math.max(m, s.sort_order), 0);
  return ctx.store.insert(
    "areas",
    fresh.map((name, i) => ({
      project_id: ctx.s.project.id,
      parent_id: parent?.id ?? null,
      type: input.type,
      name,
      sort_order: numberIn(name) ?? start + i + 1,
    })),
  );
}

export function expandNames(raw: string[]): string[] {
  const out: string[] = [];
  for (const line of raw.flatMap((r) => r.split(/[\n,]+/))) {
    const s = line.trim();
    if (!s) continue;
    const m = s.match(/^(.*?)(\d+)\s*-\s*(\d+)\s*$/);
    if (m && Number(m[3]) >= Number(m[2]) && Number(m[3]) - Number(m[2]) < 200) {
      for (let n = Number(m[2]); n <= Number(m[3]); n++) out.push(`${m[1]}${n}`.trim());
    } else out.push(s);
  }
  return [...new Set(out)];
}

function numberIn(name: string): number | null {
  const m = name.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export async function renameArea(ctx: Ctx, id: string, name: string) {
  assertPM(ctx.s);
  await ownArea(ctx, id);
  if (!name.trim()) throw new ServiceError(he.errors.invalid);
  await ctx.store.update("areas", { id }, { name: name.trim() });
}

/** Only empty areas can be deleted (no tasks anywhere below them). */
export async function deleteArea(ctx: Ctx, id: string) {
  assertPM(ctx.s);
  await ownArea(ctx, id);
  const areas = await ctx.store.select("areas", { where: { project_id: ctx.s.project.id } });
  const subtree = areaSubtree(areas, id);
  const tasks = await ctx.store.select("tasks", { where: { project_id: ctx.s.project.id, area_id: { in: [...subtree] } } });
  if (tasks.length) throw new ServiceError(he.settings.areaHasTasks(tasks.length));
  // children first (the memory store has no FK cascade on areas)
  const order = [...subtree].sort((a, b) => depth(areas, b) - depth(areas, a));
  for (const aid of order) await ctx.store.remove("areas", { id: aid });
}

function depth(areas: Area[], id: string): number {
  let d = 0;
  for (let cur = areas.find((a) => a.id === id); cur?.parent_id; cur = areas.find((a) => a.id === cur!.parent_id)) d++;
  return d;
}

// ───────────────────────── people ─────────────────────────

/** A person already known by this phone / email (e.g. from another project). */
async function findPerson(ctx: Ctx, phone: string | null, email: string | null) {
  if (phone) {
    const p = await ctx.store.first("profiles", { where: { phone } });
    if (p) return p;
  }
  if (email) {
    const p = await ctx.store.first("profiles", { where: { email } });
    if (p) return p;
  }
  return null;
}

// ───────────────────────── contractors ─────────────────────────

export interface ContractorInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  trade_id?: string | null;
}

export async function createContractor(ctx: Ctx, input: ContractorInput) {
  assertPM(ctx.s);
  const name = input.name.trim();
  if (!name) throw new ServiceError(he.errors.invalid);
  const phone = normalizePhone(input.phone);
  const email = cleanEmail(input.email);
  if (!phone && !email) throw new ServiceError(he.settings.needPhoneOrEmail);
  const orgId = ctx.s.project.organization_id;
  const existing = await ctx.store.select("contractors", { where: { organization_id: orgId } });
  if (phone && existing.some((c) => c.phone === phone)) throw new ServiceError(he.settings.duplicatePhone);

  const known = await findPerson(ctx, phone, email);
  const [profile] = known
    ? [known]
    : await ctx.store.insert("profiles", { full_name: name, phone, email, organization_id: orgId });
  const [contractor] = await ctx.store.insert("contractors", {
    organization_id: orgId,
    profile_id: profile.id,
    name,
    phone,
    trade_id: input.trade_id ?? null,
    company: input.company?.trim() || null,
  });
  await ensureMember(ctx, profile.id, "contractor");
  await directConversation(ctx.store, ctx.s.project.id, ctx.s.profile.id, profile.id);
  return contractor;
}

export async function updateContractor(ctx: Ctx, id: string, input: Partial<ContractorInput>) {
  assertPM(ctx.s);
  const c = await ctx.store.byId("contractors", id);
  if (!c || c.organization_id !== ctx.s.project.organization_id) throw new AccessError(he.errors.notFound, 404);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new ServiceError(he.errors.invalid);
    patch.name = input.name.trim();
  }
  if (input.phone !== undefined) patch.phone = normalizePhone(input.phone);
  if (input.company !== undefined) patch.company = input.company?.trim() || null;
  if (input.trade_id !== undefined) patch.trade_id = input.trade_id;
  await ctx.store.update("contractors", { id }, patch);
  if (c.profile_id) {
    const p: Record<string, unknown> = {};
    if (patch.name) p.full_name = patch.name;
    if (input.phone !== undefined) p.phone = patch.phone;
    if (input.email !== undefined) p.email = cleanEmail(input.email);
    if (Object.keys(p).length) await ctx.store.update("profiles", { id: c.profile_id }, p);
  }
}

// ───────────────────────── members ─────────────────────────

async function ensureMember(ctx: Ctx, profileId: string, role: MemberRole) {
  const m = await ctx.store.first("project_members", { where: { project_id: ctx.s.project.id, profile_id: profileId } });
  if (!m) await ctx.store.insert("project_members", { project_id: ctx.s.project.id, profile_id: profileId, role });
}

/** Add a PM or viewer (owner / consultant) by phone or email. */
export async function addMember(ctx: Ctx, input: { name: string; phone?: string | null; email?: string | null; role: Exclude<MemberRole, "contractor"> }) {
  assertPM(ctx.s);
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = cleanEmail(input.email);
  if (!name || (!phone && !email)) throw new ServiceError(he.settings.needPhoneOrEmail);
  const known = await findPerson(ctx, phone, email);
  const profile = known ?? (await ctx.store.insert("profiles", { full_name: name, phone, email, organization_id: ctx.s.project.organization_id }))[0];
  const existing = await ctx.store.first("project_members", { where: { project_id: ctx.s.project.id, profile_id: profile.id } });
  if (existing) throw new ServiceError(he.settings.alreadyMember);
  await ctx.store.insert("project_members", { project_id: ctx.s.project.id, profile_id: profile.id, role: input.role });
  await directConversation(ctx.store, ctx.s.project.id, ctx.s.profile.id, profile.id);
  return profile;
}

export async function setMemberRole(ctx: Ctx, profileId: string, role: MemberRole) {
  assertPM(ctx.s);
  if (profileId === ctx.s.profile.id) throw new ServiceError(he.settings.cantChangeSelf);
  await ctx.store.update("project_members", { project_id: ctx.s.project.id, profile_id: profileId }, { role });
}

export async function removeMember(ctx: Ctx, profileId: string) {
  assertPM(ctx.s);
  if (profileId === ctx.s.profile.id) throw new ServiceError(he.settings.cantChangeSelf);
  await ctx.store.remove("project_members", { project_id: ctx.s.project.id, profile_id: profileId });
}
