"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminClient, getStore } from "@/lib/db";
import { GATE_COOKIE, gateToken } from "@/lib/gate";
import { accountForPhone } from "@/lib/services/login-link";
import { supabaseLinkAuth } from "@/lib/supabase/link-auth";
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
  await openGate();
  redirect("/");
}

/** A valid sign-in also opens the site password. */
async function openGate() {
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    cookies().set(GATE_COOKIE, await gateToken(sitePassword), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  }
}

/** Sign in with phone + the 6-digit code that came with a login link (or from "code for this phone"). */
export async function enterWithCode(_: { error: boolean }, form: FormData): Promise<{ error: boolean }> {
  const phone = String(form.get("phone") ?? "");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const admin = getAdminClient();
  if (!admin || code.length < 6 || code.length > 10) return { error: true };
  const email = await accountForPhone({ store: getStore() }, supabaseLinkAuth(admin), phone).catch(() => null);
  if (!email) return { error: true };
  const { error } = await createSupabaseServerClient().auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    console.error("[login-code]", error.message);
    return { error: true };
  }
  await openGate();
  redirect("/");
}
