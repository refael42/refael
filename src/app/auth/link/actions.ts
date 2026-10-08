"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateToken } from "@/lib/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Use a personal login link. A valid link also opens the site password. */
export async function enterWithLink(_: { error: boolean }, form: FormData): Promise<{ error: boolean }> {
  const token = String(form.get("t") ?? "");
  if (!token) return { error: true };
  // "email" accepts both kinds generateLink returns: a magic link for a confirmed user,
  // a sign-up confirmation for one who never finished signing in (e.g. hit the email rate limit)
  const { error } = await createSupabaseServerClient().auth.verifyOtp({ token_hash: token, type: "email" });
  if (error) {
    console.error("[login-link]", error.message);
    return { error: true };
  }
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    cookies().set(GATE_COOKIE, await gateToken(sitePassword), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  }
  redirect("/");
}
