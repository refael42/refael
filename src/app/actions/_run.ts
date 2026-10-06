import "server-only";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { StoreError } from "@/lib/db/store";
import { he } from "@/lib/i18n/he";
import { AccessError } from "@/lib/services/auth-types";
import { sessionOrThrow } from "@/lib/services/session";
import { ServiceError, type Ctx } from "@/lib/services/tasks";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Authorize, run a service call, map errors to Hebrew messages, refresh the UI. */
export async function run<T>(fn: (ctx: Ctx) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const s = await sessionOrThrow();
    const data = await fn({ store: getStore(), s });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AccessError || e instanceof ServiceError) return { ok: false, error: e.message };
    if (e instanceof StoreError) return { ok: false, error: e.code === "cycle" ? he.tasks.cycleError : he.errors.invalid };
    console.error("[action]", e);
    return { ok: false, error: he.app.error };
  }
}
