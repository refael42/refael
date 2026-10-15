import { redirect } from "next/navigation";
import { PlanCard } from "@/components/plans/plan-card";
import { UploadPlan } from "@/components/plans/upload-plan";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { DISCIPLINE_KEYS } from "@/lib/services/plans";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.plans.title };

/** Current versions only, by discipline; older versions are reached from each plan. */
export default async function PlansPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const [all, floors] = await Promise.all([
    store.select("plan_files", { where: { project_id: s.project.id }, order: [["created_at", "desc"]] }),
    store.select("areas", { where: { project_id: s.project.id, type: "floor" }, order: [["sort_order", "asc"]] }),
  ]);
  const plans = all.filter((p) => p.is_current !== false);
  const pins = plans.length ? await store.select("plan_pins", { where: { plan_file_id: { in: plans.map((p) => p.id) } } }) : [];
  const groups = DISCIPLINE_KEYS.map((d) => ({ d, list: plans.filter((p) => (p.discipline ?? "other") === d) })).filter((g) => g.list.length);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.plans.title}</h1>
        {isPM(s) && <UploadPlan floors={floors.map((a) => ({ value: a.id, label: a.name }))} />}
      </div>
      {plans.length === 0 && <p className="py-10 text-center text-muted-foreground">{t.plans.empty}</p>}
      {groups.map(({ d, list }) => (
        <section key={d} className="flex flex-col gap-2">
          {groups.length > 1 && <h2 className="font-semibold">{t.plans.disciplines[d]}</h2>}
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => (
              <PlanCard key={p.id} plan={p} floor={floors.find((a) => a.id === p.floor_area_id)?.name ?? null} pins={pins.filter((x) => x.plan_file_id === p.id).length} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
