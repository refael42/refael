import { TaskFilters } from "@/components/tasks/task-filters";
import { BulkTaskDialog, type AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { getStore } from "@/lib/db";
import type { EffectiveState } from "@/lib/engine/types";
import { t } from "@/lib/i18n";
import { isPM, visibleTasks } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, areaSubtree, loadSnapshot } from "@/lib/services/snapshot";
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
        {isPM(s) && (
          <div className="flex flex-wrap gap-2">
            <BulkTaskDialog options={opts} groups={bulkGroups(snap)} />
            <TaskFormDialog options={opts} defaultAreaId={searchParams.area ?? null} />
          </div>
        )}
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

/** Bulk-create targets: every floor (its apartments) + the whole building. */
function bulkGroups(snap: Awaited<ReturnType<typeof loadSnapshot>>): AreaGroup[] {
  const byNum = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he", { numeric: true });
  const floors = snap.areas.filter((a) => a.type === "floor").sort(byNum);
  const groups: AreaGroup[] = floors.map((f) => ({
    id: f.id,
    label: areaLabel(snap.areaById, f.id),
    children: snap.areas.filter((a) => a.parent_id === f.id && a.type === "apartment").sort(byNum).map((a) => ({ id: a.id, label: a.name })),
  }));
  const all = snap.areas.filter((a) => a.type === "apartment").sort(byNum);
  groups.unshift({ id: "__all__", label: t.bulk.allApartments, children: all.map((a) => ({ id: a.id, label: a.name })) });
  groups.push({ id: "__floors__", label: t.settings.areaTypes.floor, children: floors.map((f) => ({ id: f.id, label: f.name })) });
  return groups.filter((g) => g.children.length);
}
