"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateToken } from "@/lib/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Use a personal login link. A valid link also opens the site password. */
export async function enterWithLink(_: { error: boolean }, form: FormData): Promise<{ error: boolean }> {
  const token = String(form.get("t") ?? "");
  if (!token) return { error: true };
  const { error } = await createSupabaseServerClient().auth.verifyOtp({ token_hash: token, type: "magiclink" });
  if (error) return { error: true };
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    cookies().set(GATE_COOKIE, await gateToken(sitePassword), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  }
  redirect("/");
}
