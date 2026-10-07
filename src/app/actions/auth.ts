"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { resetDemoStore } from "@/lib/db/demo-store";
import { isSupabaseMode } from "@/lib/env";
import { DEMO_COOKIE, PROJECT_COOKIE, getSession } from "@/lib/services/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

/** Demo mode only: log in as one of the seeded personas. */
export async function demoLogin(formData: FormData) {
  if (isSupabaseMode()) throw new Error("demo login disabled");
  const profileId = String(formData.get("profileId") ?? "");
  const store = getStore();
  const profile = await store.byId("profiles", profileId);
  if (!profile) redirect("/login");
  cookies().set(DEMO_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR });
  const membership = await store.first("project_members", { where: { profile_id: profile.id } });
  redirect(membership?.role === "contractor" ? "/my" : "/");
}

export async function logout() {
  if (isSupabaseMode()) {
    await createSupabaseServerClient().auth.signOut();
  } else {
    cookies().delete(DEMO_COOKIE);
  }
  cookies().delete(PROJECT_COOKIE);
  redirect("/login");
}

export async function resetDemo() {
  if (isSupabaseMode()) throw new Error("demo only");
  resetDemoStore();
  redirect("/login?reset=1");
}

export async function switchProject(projectId: string) {
  const s = await getSession();
  if (!s || !s.memberships.some((m) => m.project_id === projectId)) throw new Error("forbidden");
  cookies().set(PROJECT_COOKIE, projectId, { sameSite: "lax", path: "/", maxAge: YEAR });
  redirect("/");
}

export async function switchProjectForm(form: FormData) {
  await switchProject(String(form.get("projectId") ?? ""));
}
