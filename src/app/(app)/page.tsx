import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { loadSnapshot } from "@/lib/services/snapshot";
import { requireProjectSession } from "@/lib/services/session";

export default async function HomePage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{t.home.title}</h1>
      <p className="mt-2 text-5xl font-bold text-state-ready">{snap.analysis.readyIds.length}</p>
      <p className="text-muted-foreground">{t.home.readyNow}</p>
    </div>
  );
}
