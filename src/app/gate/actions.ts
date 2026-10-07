"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateToken, safeNext } from "@/lib/gate";

export async function enterGate(_: { error: boolean }, form: FormData): Promise<{ error: boolean }> {
  const expected = process.env.SITE_PASSWORD;
  const next = safeNext(String(form.get("next") ?? ""));
  if (!expected) redirect(next);
  const given = String(form.get("password") ?? "");
  const [a, b] = await Promise.all([gateToken(given), gateToken(expected)]);
  if (a !== b) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: true };
  }
  cookies().set(GATE_COOKIE, b, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect(next);
}
