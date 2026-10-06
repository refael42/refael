import { LiveRefresh } from "@/components/live/live-refresh";
import { AppShell } from "@/components/shell/app-shell";
import { getStore } from "@/lib/db";
import { navCounts } from "@/lib/services/counts";
import { requireProjectSession } from "@/lib/services/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireProjectSession();
  const counts = await navCounts(getStore(), s);
  return (
    <AppShell
      role={s.role}
      userName={s.profile.full_name}
      projectName={s.project.name}
      isDemo={s.isDemo}
      counts={counts}
    >
      <LiveRefresh projectId={s.project.id} />
      {children}
    </AppShell>
  );
}
