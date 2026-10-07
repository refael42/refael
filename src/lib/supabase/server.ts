import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../env";

/** User-scoped Supabase client (anon key + the user's session cookie → RLS applies). */
export function createSupabaseServerClient() {
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component — middleware refreshes the session */
        }
      },
    },
  });
}
