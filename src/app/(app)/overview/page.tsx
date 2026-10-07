import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaTile } from "@/components/overview/area-tile";
import { BlockersPanel, type BlockerVM } from "@/components/overview/blockers-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";
import { areaProgress } from "@/lib/services/views";
import { cn } from "@/lib/utils";

export const metadata = { title: t.overview.title };

export default async function OverviewPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const a = snap.analysis;
  const tree = areaProgress(snap);
  const building = tree[0];
  const floors = building?.children.filter((c) => c.type === "floor") ?? [];
  const common = building?.children.filter((c) => c.type !== "floor") ?? [];

  const bottleneck = new Map(a.bottlenecks.filter((b) => b.kind === "external").map((b) => [b.id, b]));
  const blockers: BlockerVM[] = snap.blockers
    .map((b) => ({
      id: b.id,
      title: b.title,
      owner: b.owner_name,
      phone: b.owner_phone,
      status: b.status,
      expected: b.expected_date,
      notes: b.notes,
      blocksDirect: bottleneck.get(b.id)?.blocksDirect ?? 0,
      blocksTransitive: bottleneck.get(b.id)?.blocksTransitive ?? 0,
    }))
    .sort((x, y) => Number(y.status === "open") - Number(x.status === "open") || y.blocksTransitive - x.blocksTransitive);

  const counts = [
    { label: t.home.stats.ready, n: a.readyIds.length, cls: "text-state-ready", href: "/tasks?state=ready" },
    { label: t.home.stats.blocked, n: a.blockedIds.length, cls: "text-state-blocked", href: "/tasks?state=blocked" },
    { label: t.home.stats.inProgress, n: a.inProgressIds.length, cls: "text-state-progress", href: "/tasks?state=in_progress" },
    { label: t.home.stats.awaiting, n: a.awaitingIds.length, cls: "text-amber-600", href: "/approvals" },
    { label: t.home.stats.critical, n: a.criticalPath.length, cls: "text-state-critical", href: "/tasks?critical=1" },
    { label: t.status.done, n: a.doneIds.length, cls: "text-muted-foreground", href: "/tasks?state=done" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold">{t.overview.title}</h1>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {counts.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border p-3 text-center transition-colors hover:bg-accent">
            <div className={cn("num text-3xl font-bold", c.cls)}>{c.n}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t.overview.progressByArea}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[...floors].reverse().map((f) => (
              <div key={f.id} className="flex flex-col gap-2">
                <AreaTile area={f} />
                <div className="grid grid-cols-2 gap-2 ps-4 sm:grid-cols-3 md:grid-cols-5">
                  {f.children.map((apt) => (
                    <AreaTile key={apt.id} area={apt} compact />
                  ))}
                </div>
              </div>
            ))}
            {common.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {common.map((c) => (
                  <AreaTile key={c.id} area={c} compact />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t.overview.blockers}</CardTitle>
          </CardHeader>
          <CardContent>
            <BlockersPanel
              blockers={blockers}
              canEdit={isPM(s)}
              tasks={snap.tasks
                .filter((x) => x.status !== "done")
                .map((x) => ({ value: x.id, label: x.title, hint: areaLabel(snap.areaById, x.area_id) }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
