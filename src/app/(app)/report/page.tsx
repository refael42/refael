import { redirect } from "next/navigation";
import { PrintButton } from "@/components/common/print-button";
import { Progress } from "@/components/ui/misc";
import { getStore } from "@/lib/db";
import { fmtDate, localDate, t } from "@/lib/i18n";
import { isStaff } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";
import { areaProgress, contractorLabel, homeView } from "@/lib/services/views";

export const metadata = { title: t.report.title };

const DAY = 86_400_000;

export default async function ReportPage() {
  const s = await requireProjectSession();
  if (!isStaff(s)) redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const a = snap.analysis;
  const now = snap.now;
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const total = snap.tasks.length;
  const done = a.doneIds.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const home = homeView(snap);

  const completed = snap.tasks
    .filter((x) => x.status === "done" && (x.completed_at ?? "") >= weekAgo)
    .sort((x, y) => (y.completed_at ?? "").localeCompare(x.completed_at ?? ""));
  const next = snap.tasks
    .filter((x) => x.status !== "done" && a.byTask[x.id].earlyStart <= 7 * 24)
    .sort((x, y) => a.byTask[x.id].earlyStart - a.byTask[y.id].earlyStart)
    .slice(0, 20);
  const floors = (areaProgress(snap)[0]?.children ?? []).filter((c) => c.type === "floor");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 print:max-w-none print:p-0 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t.report.title}</h1>
          <p className="font-medium">{snap.project.name}</p>
          <p className="text-sm text-muted-foreground">
            {t.report.period(fmtDate(weekAgo), fmtDate(now))} · {t.report.generated(fmtDate(localDate(now)))}
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t.report.progress} value={`${pct}%`} />
        <Kpi label={t.report.completedWeek} value={String(completed.length)} />
        <Kpi label={t.report.pendingApprovals} value={String(a.awaitingIds.length)} />
        <Kpi label={t.report.projectedEnd} value={fmtDate(home.projectEnd)} sub={snap.project.target_date ? `${t.report.target}: ${fmtDate(snap.project.target_date)}` : undefined} />
      </section>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-state-ready">{`${t.home.stats.ready}: ${a.readyIds.length}`}</span>
        <span className="text-state-progress">{`${t.home.stats.inProgress}: ${a.inProgressIds.length}`}</span>
        <span className="text-state-blocked">{`${t.home.stats.blocked}: ${a.blockedIds.length}`}</span>
        <span>{`${t.status.done}: ${done}/${total}`}</span>
      </div>

      <Section title={t.report.byFloor}>
        <div className="flex flex-col gap-2">
          {floors.map((f) => {
            const p = f.total ? Math.round((f.done / f.total) * 100) : 0;
            return (
              <div key={f.id} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
                <span>{f.name}</span>
                <Progress value={p} />
                <span className="num text-end">{p}%</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={t.report.blockers}>
        <Rows
          rows={home.needYou.slice(0, 8).map((b) => [b.line, `${b.kindLabel} · ${b.who}`])}
        />
      </Section>

      <Section title={`${t.report.completedWeek} (${completed.length})`}>
        <Rows
          rows={completed.map((x) => [x.title, `${areaLabel(snap.areaById, x.area_id)} · ${contractorLabel(snap, x.contractor_id)} · ${fmtDate(x.completed_at)}`])}
        />
      </Section>

      <Section title={t.report.nextWeek}>
        <Rows
          rows={next.map((x) => [
            x.title,
            `${contractorLabel(snap, x.contractor_id)} · ${a.byTask[x.id].effective === "ready" ? t.report.readyToStart : t.effective[a.byTask[x.id].effective]} · ${fmtDate(new Date(now.getTime() + a.byTask[x.id].earlyStart * 3_600_000))}`,
          ])}
        />
      </Section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3 print:break-inside-avoid">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 print:break-inside-avoid">
      <h2 className="border-b pb-1 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t.report.none}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b last:border-b-0">
            <td className="py-1.5 pe-3 font-medium">{a}</td>
            <td className="py-1.5 text-muted-foreground">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
