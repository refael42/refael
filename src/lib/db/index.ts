import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseMode, serverEnv, SUPABASE_URL } from "../env";
import { getDemoStore } from "./demo-store";
import type { Store } from "./store";
import { SupabaseStore } from "./supabase-store";

let admin: SupabaseStore | null = null;

/**
 * The privileged server store. In Supabase mode it uses the service role,
 * so callers MUST go through the service layer, which authorizes first.
 */
export function getStore(): Store {
  if (!isSupabaseMode()) return getDemoStore();
  if (!admin) {
    if (!serverEnv.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in Supabase mode");
    admin = new SupabaseStore(
      createClient(SUPABASE_URL, serverEnv.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }
  return admin;
}

export function getAdminClient() {
  if (!isSupabaseMode()) return null;
  return createClient(SUPABASE_URL, serverEnv.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type { Store } from "./store";
