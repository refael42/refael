import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlanCompare } from "@/components/plans/plan-compare";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { textChanges } from "@/lib/plans/analyze";
import { planVersions } from "@/lib/services/plans";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.plans.compare };

/** A version next to the one it replaced: the drawing overlaid, and the words that changed. */
export default async function ComparePage({ params }: { params: { id: string } }) {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const plan = await store.byId("plan_files", params.id);
  if (!plan || plan.project_id !== s.project.id) notFound();
  const versions = await planVersions({ store, s }, plan.id);
  const prev = versions[versions.findIndex((v) => v.id === plan.id) + 1];
  if (!prev) redirect(`/plans/${plan.id}`);
  const words = textChanges(prev.text_index, plan.text_index);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 lg:p-6">
      <Link href={`/plans/${plan.id}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowRight className="h-4 w-4" />
        {plan.title}
      </Link>
      <h1 className="text-xl font-bold">{t.plans.compareTitle(prev.version ?? 1, plan.version ?? 2)}</h1>
      <p className="text-sm text-muted-foreground">{t.plans.compareHint}</p>
      {plan.change_note && <p className="text-sm">{plan.change_note}</p>}
      {(words.added.length > 0 || words.removed.length > 0) && (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {words.added.length > 0 && (
            <div className="rounded-md border border-red-200 p-3 dark:border-red-900">
              <span className="font-semibold text-red-700 dark:text-red-400">{t.plans.textAdded}: </span>
              {words.added.join(" · ")}
            </div>
          )}
          {words.removed.length > 0 && (
            <div className="rounded-md border border-blue-200 p-3 dark:border-blue-900">
              <span className="font-semibold text-blue-700 dark:text-blue-400">{t.plans.textRemoved}: </span>
              {words.removed.join(" · ")}
            </div>
          )}
        </div>
      )}
      <PlanCompare oldUrl={mediaSrc(prev.file_url)} newUrl={mediaSrc(plan.file_url)} />
    </div>
  );
}
