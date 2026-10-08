import { redirect } from "next/navigation";
import { AreasPanel, type AreaNode } from "@/components/settings/areas-panel";
import { ContractorsPanel, MembersPanel, type ContractorRow, type MemberRow } from "@/components/settings/people-panels";
import { ImportPlanCard } from "@/components/settings/import-plan";
import { ImportContractorsDialog } from "@/components/settings/import-contractors";
import { ProjectPanel } from "@/components/settings/project-panel";
import { WhatsappCard } from "@/components/settings/whatsapp-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaProgress, type AreaProgressVM } from "@/lib/services/views";
import { loadSnapshot } from "@/lib/services/snapshot";

export const metadata = { title: t.settings.title };

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await requireProjectSession();
  if (!isPM(s)) redirect("/");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const toNode = (n: AreaProgressVM): AreaNode => ({ id: n.id, name: n.name, type: n.type as AreaNode["type"], tasks: n.total, children: n.children.map(toNode) });

  const memberProfiles = new Set(snap.members.map((m) => m.profile_id));
  const contractors: ContractorRow[] = snap.contractors
    .filter((c) => !c.profile_id || memberProfiles.has(c.profile_id))
    .map((c) => {
      const p = c.profile_id ? snap.profileById.get(c.profile_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: p?.email ?? null,
        company: c.company,
        tradeId: c.trade_id,
        trade: c.trade_id ? snap.tradeById.get(c.trade_id)?.name ?? null : null,
        openTasks: snap.tasks.filter((x) => x.contractor_id === c.id && x.status !== "done").length,
        linked: s.isDemo ? null : !!p?.auth_user_id,
      };
    });
  const order = { pm: 0, viewer: 1, contractor: 2 } as const;
  const members: MemberRow[] = snap.members
    .map((m) => {
      const p = snap.profileById.get(m.profile_id);
      return { profileId: m.profile_id, name: p?.full_name ?? "", role: m.role, contact: p?.phone ?? p?.email ?? null, isMe: m.profile_id === s.profile.id };
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, "he"));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold">{t.settings.title}</h1>
      <Tabs defaultValue={searchParams.tab ?? "areas"}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="project">{t.settings.project}</TabsTrigger>
          <TabsTrigger value="areas">{t.settings.areas}</TabsTrigger>
          <TabsTrigger value="contractors">{t.settings.contractors}</TabsTrigger>
          <TabsTrigger value="members">{t.settings.members}</TabsTrigger>
        </TabsList>
        <TabsContent value="project">
          <div className="flex flex-col gap-4">
            <ImportPlanCard />
            <ProjectPanel project={s.project} />
          </div>
        </TabsContent>
        <TabsContent value="areas">
          <AreasPanel tree={areaProgress(snap).map(toNode)} />
        </TabsContent>
        <TabsContent value="contractors" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <ImportContractorsDialog />
          </div>
          <WhatsappCard />
          <ContractorsPanel rows={contractors} trades={snap.trades.map((x) => ({ value: x.id, label: x.name }))} />
        </TabsContent>
        <TabsContent value="members">
          <MembersPanel rows={members} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
