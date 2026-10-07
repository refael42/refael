import { redirect } from "next/navigation";
import { RulesManager, type RuleVM } from "@/components/templates/rules-manager";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { feedbackScore, loadRules } from "@/lib/services/rules";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.templates.title };

export default async function TemplatesPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const [{ rules, feedback }, trades] = await Promise.all([loadRules(store, s.project.organization_id), store.select("trades", { order: [["sort_order", "asc"]] })]);
  const name = (id: string) => trades.find((x) => x.id === id)?.name ?? "?";
  const order = { learned: 0, custom: 1, system: 2 } as const;
  const vms: RuleVM[] = rules
    .map((r) => {
      const score = feedbackScore(feedback, r.predecessor_trade_id, r.successor_trade_id);
      return {
        id: r.id,
        name: r.name,
        pred: name(r.predecessor_trade_id),
        succ: name(r.successor_trade_id),
        predKeyword: r.predecessor_keyword,
        succKeyword: r.successor_keyword,
        scope: r.scope,
        lag: Number(r.lag_hours),
        active: r.active,
        source: r.source,
        editable: r.organization_id === s.project.organization_id,
        accepted: score.accepted,
        rejected: score.rejected,
      };
    })
    .sort((a, b) => order[a.source] - order[b.source] || a.name.localeCompare(b.name, "he"));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-bold">{t.templates.title}</h1>
        <p className="text-sm text-muted-foreground">{t.templates.hint}</p>
        <p className="text-xs text-muted-foreground">{t.templates.learnedHint}</p>
      </div>
      <RulesManager rules={vms} trades={trades.map((x) => ({ value: x.id, label: x.name }))} canEdit={isPM(s)} />
    </div>
  );
}
