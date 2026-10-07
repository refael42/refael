import { LiveRefresh } from "@/components/live/live-refresh";
import { AppShell } from "@/components/shell/app-shell";
import { getStore } from "@/lib/db";
import { navCounts } from "@/lib/services/counts";
import { canCreateProject } from "@/lib/services/project";
import { requireProjectSession } from "@/lib/services/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireProjectSession();
  const store = getStore();
  const counts = await navCounts(store, s);
  const projects = await store.select("projects", { where: { id: { in: s.memberships.map((m) => m.project_id) } } });
  return (
    <AppShell
      role={s.role}
      userName={s.profile.full_name}
      projectName={s.project.name}
      isDemo={s.isDemo}
      counts={counts}
      projects={projects.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "he"))}
      projectId={s.project.id}
      canCreateProject={canCreateProject(s)}
      setupMode={!!s.project.setup_mode}
    >
      <LiveRefresh projectId={s.project.id} />
      {children}
    </AppShell>
  );
}
