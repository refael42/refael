import { notFound, redirect } from "next/navigation";
import { PlanDetails } from "@/components/plans/plan-details";
import { PlanViewer } from "@/components/plans/plan-viewer";
import type { PinAreaVM } from "@/components/plans/types";
import { getStore } from "@/lib/db";
import { mediaSrc } from "@/lib/media";
import { isPM } from "@/lib/services/access";
import { areaMessages } from "@/lib/services/area-view";
import { planVersions } from "@/lib/services/plans";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, areaSubtree, loadSnapshot } from "@/lib/services/snapshot";
import { areaProgress, findArea, formOptions, taskCard } from "@/lib/services/views";

export default async function PlanPage({ params, searchParams }: { params: { id: string }; searchParams: { pin?: string } }) {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const plan = await store.byId("plan_files", params.id);
  if (!plan || plan.project_id !== s.project.id) notFound();
  const [pins, snap] = await Promise.all([store.select("plan_pins", { where: { plan_file_id: plan.id } }), loadSnapshot(store, s.project.id)]);
  const tree = areaProgress(snap);
  const senders = new Map(snap.profiles.map((p) => [p.id, p.full_name]));

  const areas: Record<string, PinAreaVM> = {};
  for (const pin of pins) {
    if (!pin.area_id || areas[pin.area_id]) continue;
    const a = snap.areaById.get(pin.area_id);
    if (!a) continue;
    const prog = findArea(tree, a.id);
    const inArea = areaSubtree(snap.areas, a.id);
    const msgs = await areaMessages(store, s, snap, a.id, 5);
    areas[a.id] = {
      id: a.id,
      name: a.name,
      path: areaLabel(snap.areaById, a.id),
      worst: prog?.worst ?? null,
      done: prog?.done ?? 0,
      total: prog?.total ?? 0,
      tasks: snap.tasks
        .filter((x) => x.area_id && inArea.has(x.area_id))
        .map((x) => {
          const c = taskCard(snap, x.id);
          return { id: c.id, title: c.title, state: c.state, contractor: c.contractor, reason: c.reason };
        }),
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        text: m.text ?? "",
        sender: m.sender_profile_id ? senders.get(m.sender_profile_id) ?? "" : "",
        at: m.created_at,
      })),
    };
  }

  const versions = await planVersions({ store, s }, plan.id);
  const idx = versions.findIndex((v) => v.id === plan.id);
  const options = formOptions(snap).areas;
  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      <PlanDetails
        canEdit={isPM(s)}
        areas={options}
        plan={{
          id: plan.id,
          title: plan.title,
          discipline: plan.discipline ?? null,
          sheet: plan.sheet ?? null,
          revision: plan.revision ?? null,
          version: plan.version ?? 1,
          isCurrent: plan.is_current !== false,
          currentId: versions.find((v) => v.is_current !== false)?.id ?? null,
          previousId: versions[idx + 1]?.id ?? null,
          changeNote: plan.change_note ?? null,
          areaIds: plan.area_ids ?? [],
          createdAt: plan.created_at,
          versions: versions.map((v) => ({ id: v.id, version: v.version ?? 1, revision: v.revision ?? null, createdAt: v.created_at, isCurrent: v.is_current !== false })),
        }}
      />
    <PlanViewer
      planId={plan.id}
      url={mediaSrc(plan.file_url)}
      pins={pins.map((p) => ({ id: p.id, page: p.page, x: p.x, y: p.y, areaId: p.area_id, label: p.label }))}
      areas={areas}
      areaOptions={options}
      canEdit={isPM(s)}
      initialPin={searchParams.pin ?? null}
    />
    </div>
  );
}
