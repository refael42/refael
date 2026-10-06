import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getStore } from "../db";
import type { MemberRole, Profile, Project, ProjectMember } from "../db/types";
import { isSupabaseMode } from "../env";
import { createSupabaseServerClient } from "../supabase/server";

export const DEMO_COOKIE = "sf_demo_profile";
export const PROJECT_COOKIE = "sf_project";

export interface Session {
  profile: Profile;
  memberships: ProjectMember[];
  project: Project | null;
  role: MemberRole | null;
  /** Contractor rows linked to this person (normally 0 or 1). */
  contractorIds: string[];
  isDemo: boolean;
}

export type ProjectSession = Session & { project: Project; role: MemberRole };

async function currentProfileId(): Promise<string | null> {
  if (!isSupabaseMode()) return cookies().get(DEMO_COOKIE)?.value ?? null;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const profile = await getStore().first("profiles", { where: { auth_user_id: data.user.id } });
  return profile?.id ?? null;
}

/** Per-request session (memoized with React cache). */
export const getSession = cache(async (): Promise<Session | null> => {
  const profileId = await currentProfileId();
  if (!profileId) return null;
  const store = getStore();
  const profile = await store.byId("profiles", profileId);
  if (!profile) return null;
  const memberships = await store.select("project_members", { where: { profile_id: profile.id } });
  const wanted = cookies().get(PROJECT_COOKIE)?.value;
  const membership = memberships.find((m) => m.project_id === wanted) ?? memberships[0] ?? null;
  const project = membership ? await store.byId("projects", membership.project_id) : null;
  const contractors = await store.select("contractors", { where: { profile_id: profile.id } });
  return {
    profile,
    memberships,
    project,
    role: membership?.role ?? null,
    contractorIds: contractors.map((c) => c.id),
    isDemo: !isSupabaseMode(),
  };
});

/** For pages: redirect to /login (no session) or /login?noaccess (no project). */
export async function requireProjectSession(): Promise<ProjectSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.project || !s.role) redirect("/login?noaccess=1");
  return s as ProjectSession;
}

export class AccessError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 | 404 = 403,
  ) {
    super(message);
  }
}

/** For actions / route handlers: throw instead of redirecting. */
export async function sessionOrThrow(): Promise<ProjectSession> {
  const s = await getSession();
  if (!s) throw new AccessError("unauthorized", 401);
  if (!s.project || !s.role) throw new AccessError("no project access", 403);
  return s as ProjectSession;
}
