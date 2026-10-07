import { MemoryStore } from "@/lib/db/memory-store";
import type { MemberRole } from "@/lib/db/types";
import { buildDemoData, contractorProfileId, DEMO_IDS, sid } from "@/lib/seed/demo";
import type { Ctx } from "@/lib/services/tasks";
import type { ProjectSession } from "@/lib/services/auth-types";

export const NOW = new Date("2026-10-05T09:00:00Z");
export const T = (key: string) => sid(`task:${key}`);

export function demoStore(now = NOW) {
  const store = new MemoryStore(buildDemoData(now));
  store.now = () => now;
  return store;
}

export async function sessionFor(store: MemoryStore, who: "pm" | "viewer" | string): Promise<ProjectSession> {
  const profileId = who === "pm" ? DEMO_IDS.pm : who === "viewer" ? DEMO_IDS.viewer : contractorProfileId(who);
  const profile = (await store.byId("profiles", profileId))!;
  const memberships = await store.select("project_members", { where: { profile_id: profileId } });
  const project = (await store.byId("projects", DEMO_IDS.project))!;
  const contractors = await store.select("contractors", { where: { profile_id: profileId } });
  return {
    profile,
    memberships,
    project,
    role: memberships[0].role as MemberRole,
    contractorIds: contractors.map((c) => c.id),
    isDemo: true,
  };
}

export async function ctxFor(who: "pm" | "viewer" | string, store = demoStore()): Promise<Ctx & { store: MemoryStore }> {
  return { store, s: await sessionFor(store, who), now: NOW };
}
