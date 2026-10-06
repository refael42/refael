import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { getStore } from "@/lib/db";
import type { EffectiveState } from "@/lib/engine/types";
import { t } from "@/lib/i18n";
import { isPM, visibleTasks } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaSubtree, loadSnapshot } from "@/lib/services/snapshot";
import { formOptions, taskCard } from "@/lib/services/views";

export const metadata = { title: t.tasks.title };

const ORDER: Record<EffectiveState, number> = { in_progress: 0, ready: 1, awaiting_approval: 2, blocked: 3, done: 4 };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { state?: string; trade?: string; area?: string; contractor?: string; q?: string; critical?: string };
}) {
  const s = await requireProjectSession();
  const snap = await loadSnapshot(getStore(), s.project.id);
  const opts = formOptions(snap);
  const inArea = searchParams.area ? areaSubtree(snap.areas, searchParams.area) : null;
  const q = searchParams.q?.trim();

  const cards = visibleTasks(s, snap.tasks)
    .filter((task) => {
      const a = snap.analysis.byTask[task.id];
      if (searchParams.state && a.effective !== searchParams.state) return false;
      if (searchParams.trade && task.trade_id !== searchParams.trade) return false;
      if (searchParams.contractor && task.contractor_id !== searchParams.contractor) return false;
      if (inArea && (!task.area_id || !inArea.has(task.area_id))) return false;
      if (searchParams.critical && !(task.is_critical || a.onCriticalPath)) return false;
      if (q && !task.title.includes(q)) return false;
      return true;
    })
    .map((task) => taskCard(snap, task.id))
    .sort(
      (a, b) =>
        ORDER[a.state] - ORDER[b.state] ||
        Number(b.critical) - Number(a.critical) ||
        b.blocksTransitive - a.blocksTransitive ||
        a.title.localeCompare(b.title, "he", { numeric: true }),
    );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{t.tasks.title}</h1>
          <p className="text-sm text-muted-foreground">{t.tasks.count(cards.length)}</p>
        </div>
        {isPM(s) && <TaskFormDialog options={opts} defaultAreaId={searchParams.area ?? null} />}
      </div>
      <TaskFilters areas={opts.areas} trades={opts.trades} contractors={opts.contractors} />
      {cards.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t.tasks.empty}</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {cards.map((c) => (
            <TaskRow key={c.id} task={c} />
          ))}
        </div>
      )}
    </div>
  );
}
