import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkAuth } from "../services/login-link";

/** LinkAuth over the Supabase Auth admin API (service role). */
export function supabaseLinkAuth(admin: SupabaseClient): LinkAuth {
  const generate = (email: string) => admin.auth.admin.generateLink({ type: "magiclink", email });
  return {
    async userEmail(id) {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;
      return data.user?.email || null;
    },
    async setUserEmail(id, email) {
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) throw error;
    },
    async magicLink(email) {
      let r = await generate(email);
      if (r.error) {
        // no auth user yet → create it (confirmed, no email is sent), then generate
        const created = await admin.auth.admin.createUser({ email, email_confirm: true });
        if (created.error) throw created.error;
        r = await generate(email);
        if (r.error) throw r.error;
      }
      return { userId: r.data.user.id, hashedToken: r.data.properties.hashed_token };
    },
  };
}
