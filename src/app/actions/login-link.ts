"use server";
import { headers } from "next/headers";
import { getAdminClient } from "@/lib/db";
import { he } from "@/lib/i18n/he";
import { createLoginLink } from "@/lib/services/login-link";
import { ServiceError } from "@/lib/services/tasks";
import { supabaseLinkAuth } from "@/lib/supabase/link-auth";
import { run } from "./_run";

/** PM: a one-time login link for a project member, to send on WhatsApp. */
export async function loginLinkAction(profileId: string) {
  return run(async (ctx) => {
    const admin = getAdminClient();
    if (!admin) throw new ServiceError(he.settings.linkDemo);
    const { token, profile } = await createLoginLink(ctx, supabaseLinkAuth(admin), profileId);
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { url: `${proto}://${host}/auth/link?t=${encodeURIComponent(token)}`, phone: profile.phone, name: profile.full_name };
  });
}
