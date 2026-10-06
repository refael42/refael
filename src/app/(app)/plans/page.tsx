import { FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadPlan } from "@/components/plans/upload-plan";
import { getStore } from "@/lib/db";
import { fmtDate, t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.plans.title };

export default async function PlansPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const [plans, areas] = await Promise.all([
    store.select("plan_files", { where: { project_id: s.project.id }, order: [["created_at", "desc"]] }),
    store.select("areas", { where: { project_id: s.project.id, type: "floor" }, order: [["sort_order", "asc"]] }),
  ]);
  const pins = plans.length ? await store.select("plan_pins", { where: { plan_file_id: { in: plans.map((p) => p.id) } } }) : [];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.plans.title}</h1>
        {isPM(s) && <UploadPlan floors={areas.map((a) => ({ value: a.id, label: a.name }))} />}
      </div>
      {plans.length === 0 && <p className="py-10 text-center text-muted-foreground">{t.plans.empty}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => (
          <Link key={p.id} href={`/plans/${p.id}`} className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex flex-1 flex-col">
              <span className="font-medium">{p.title}</span>
              <span className="text-xs text-muted-foreground">
                {areas.find((a) => a.id === p.floor_area_id)?.name ?? ""} · {fmtDate(p.created_at)}
              </span>
            </div>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {pins.filter((x) => x.plan_file_id === p.id).length}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
