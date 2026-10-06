"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getStore } from "@/lib/db";
import { he } from "@/lib/i18n/he";
import { AccessError } from "@/lib/services/auth-types";
import { buildStructure, createProject, setSetupMode, updateProject, type StructureInput } from "@/lib/services/project";
import { getSession, PROJECT_COOKIE } from "@/lib/services/session";
import { ServiceError } from "@/lib/services/tasks";
import { run, type ActionResult } from "./_run";

export async function createProjectAction(input: Parameters<typeof createProject>[2]): Promise<ActionResult<string>> {
  try {
    const s = await getSession();
    if (!s) throw new AccessError("unauthorized", 401);
    const p = await createProject(getStore(), s, input);
    cookies().set(PROJECT_COOKIE, p.id, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
    return { ok: true, data: p.id };
  } catch (e) {
    if (e instanceof AccessError || e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: he.app.error };
  }
}

export async function buildStructureAction(input: StructureInput) {
  return run(async (ctx) => {
    if (ctx.s.role !== "pm") throw new AccessError(he.errors.pmOnly, 403);
    return buildStructure(ctx.store, ctx.s.project.id, input);
  });
}

export async function updateProjectAction(input: Parameters<typeof updateProject>[1]) {
  return run(async (ctx) => {
    await updateProject(ctx, input);
  });
}

export async function setSetupModeAction(on: boolean) {
  return run((ctx) => setSetupMode(ctx, on));
}
