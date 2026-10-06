import { MessageCircle, Unlock, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AiCard } from "@/components/chat/ai-card";
import { ReportReview } from "@/components/completion/report-review";
import { StateBadge } from "@/components/tasks/state-badge";
import { TaskActions } from "@/components/tasks/task-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStore } from "@/lib/db";
import { fmtDateTime, t } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";
import { contractorLabel, formOptions, releaseIfDone } from "@/lib/services/views";

export const metadata = { title: t.approvals.title };

export default async function ApprovalsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await requireProjectSession();
  if (!isPM(s)) redirect("/");
  const store = getStore();
  const snap = await loadSnapshot(store, s.project.id);
  const awaiting = snap.tasks.filter((x) => x.status === "awaiting_approval");
  const reports = awaiting.length
    ? await store.select("completion_reports", { where: { task_id: { in: awaiting.map((x) => x.id) }, status: "pending" }, order: [["created_at", "asc"]] })
    : [];
  const suggested = await store.select("messages", { where: { project_id: s.project.id, ai_status: "suggested" }, order: [["created_at", "desc"]] });
  const names = new Map(snap.profiles.map((p) => [p.id, p.full_name]));
  const options = formOptions(snap);
  const taskOptions = snap.tasks.map((x) => ({ value: x.id, label: x.title }));
  const withoutReport = awaiting.filter((x) => !reports.some((r) => r.task_id === x.id));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold">{t.approvals.title}</h1>
      <Tabs defaultValue={searchParams.tab === "ai" ? "ai" : "reports"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">
            {t.approvals.reports} ({reports.length + withoutReport.length})
          </TabsTrigger>
          <TabsTrigger value="ai">
            {t.approvals.suggestions} ({suggested.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="flex flex-col gap-3">
          {reports.length + withoutReport.length === 0 && <p className="py-8 text-center text-muted-foreground">{t.approvals.empty}</p>}
          {reports.map((r) => {
            const task = snap.taskById.get(r.task_id)!;
            const release = releaseIfDone(snap, task.id);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <Link href={`/tasks/${task.id}`} className="font-semibold hover:underline">
                        {task.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{areaLabel(snap.areaById, task.area_id)}</span>
                    </div>
                    <StateBadge state="awaiting_approval" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" />
                    {t.completion.by} {r.submitted_by ? names.get(r.submitted_by) ?? contractorLabel(snap, r.contractor_id) : contractorLabel(snap, r.contractor_id)} ·{" "}
                    {fmtDateTime(r.created_at)}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {r.photo_urls.map((u) => (
                      <a key={u} href={mediaSrc(u)} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={mediaSrc(u)} alt="" className="h-36 w-36 rounded-lg border object-cover" />
                      </a>
                    ))}
                  </div>
                  {r.note && <p className="text-sm">{r.note}</p>}
                  {release.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-md bg-state-ready/10 p-2 text-sm text-state-ready">
                      <span className="flex items-center gap-1 font-medium">
                        <Unlock className="h-4 w-4" />
                        {t.completion.unlocks(release.length)}
                      </span>
                      <span className="text-xs">{release.map((id) => snap.taskById.get(id)!.title).join(" · ")}</span>
                    </div>
                  )}
                  <ReportReview reportId={r.id} />
                </CardContent>
              </Card>
            );
          })}
          {withoutReport.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <Link href={`/tasks/${task.id}`} className="font-semibold hover:underline">
                  {task.title}
                </Link>
                <TaskActions taskId={task.id} status={task.status} role="pm" isOwnTask={false} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ai" className="flex flex-col gap-4">
          {suggested.length === 0 && <p className="py-8 text-center text-muted-foreground">{t.approvals.emptySuggestions}</p>}
          {suggested.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <Link href={`/chat/${m.conversation_id}#m-${m.id}`} className="flex flex-col gap-0.5 text-sm hover:underline">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  {t.approvals.fromMessage} · {m.sender_profile_id ? names.get(m.sender_profile_id) : t.chat.system} · {fmtDateTime(m.created_at)}
                </span>
                <span>{m.text}</span>
              </Link>
              <AiCard messageId={m.id} ai={m.ai_parsed_json!} status={m.ai_status} mine={false} isPM options={options} taskOptions={taskOptions} />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
