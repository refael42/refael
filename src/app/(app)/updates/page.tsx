import { redirect } from "next/navigation";
import { AutoDone } from "@/components/intel/auto-done";
import { EventCards } from "@/components/intel/event-cards";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { autoApplied, listEvents } from "@/lib/services/intel";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.intel.title };

export default async function UpdatesPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const ctx = { store: getStore(), s };
  const [cards, done] = await Promise.all([listEvents(ctx), autoApplied(ctx)]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t.intel.title}</h1>
        <p className="text-sm text-muted-foreground">{t.intel.hint}</p>
      </div>
      {done.length > 0 && <AutoDone cards={JSON.parse(JSON.stringify(done))} canUndo={isPM(s)} />}
      {cards.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t.intel.empty}</p>
      ) : (
        <EventCards cards={JSON.parse(JSON.stringify(cards))} canDecide={isPM(s)} />
      )}
    </div>
  );
}
