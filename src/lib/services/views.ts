/**
 * View models: turn engine output + rows into small, serializable objects the
 * screens render. Every "why blocked" explanation is produced here, so all
 * screens describe blockers (and who must act) the same way.
 */
import type { BlockingItem, Bottleneck, EffectiveState, RootBlocker } from "../engine";
import { fmtDateTime, t } from "../i18n";
import type { ProjectSnapshot } from "./snapshot";
import { areaLabel, snapshotRecommendation, snapshotUnlockImpact } from "./snapshot";

export interface TaskCardVM {
  id: string;
  title: string;
  area: string;
  areaId: string | null;
  trade: string | null;
  tradeColor: string;
  contractor: string | null;
  contractorId: string | null;
  state: EffectiveState;
  storedStatus: string;
  critical: boolean;
  blocksDirect: number;
  blocksTransitive: number;
  plannedEnd: string | null;
  overdue: boolean;
  outOfOrder: boolean;
  /** One-line "why blocked" summary */
  reason: string | null;
}

export interface BlockerLineVM {
  kind: BlockingItem["kind"] | RootBlocker["kind"];
  text: string;
  who: string;
  href: string | null;
}

export function contractorName(s: ProjectSnapshot, id: string | null | undefined): string | null {
  if (!id) return null;
  const c = s.contractorById.get(id);
  return c ? c.name : null;
}

export function contractorLabel(s: ProjectSnapshot, id: string | null | undefined): string {
  if (!id) return t.tasks.noContractor;
  const c = s.contractorById.get(id);
  if (!c) return t.tasks.noContractor;
  const trade = c.trade_id ? s.tradeById.get(c.trade_id)?.name : null;
  return trade ? `${c.name} (${trade})` : c.name;
}

export function describeBlocking(s: ProjectSnapshot, item: BlockingItem | RootBlocker): BlockerLineVM {
  switch (item.kind) {
    case "task": {
      const who = item.needsPm ? t.blocking.pmMustApprove : contractorLabel(s, item.contractorId);
      const state = t.effective[item.state] ?? item.state;
      return { kind: "task", text: `${t.blocking.task(item.title)} · ${state}`, who, href: `/tasks/${item.taskId}` };
    }
    case "external":
      return {
        kind: "external",
        text: t.blocking.external(item.title),
        who: item.ownerName ?? t.app.unknown,
        href: `/overview#blocker-${item.blockerId}`,
      };
    case "lag":
      return {
        kind: "lag",
        text: t.blocking.lag(item.title, fmtDateTime(item.until)),
        who: t.blocking.timeOnly,
        href: `/tasks/${item.taskId}`,
      };
    case "manual":
      return {
        kind: "manual",
        text: item.reason ? t.blocking.manual(item.reason) : t.blocking.manualNoReason,
        who: t.roles.pm,
        href: "taskId" in item ? `/tasks/${item.taskId}` : null,
      };
  }
}

export function taskCard(s: ProjectSnapshot, id: string): TaskCardVM {
  const task = s.taskById.get(id)!;
  const a = s.analysis.byTask[id];
  const trade = task.trade_id ? s.tradeById.get(task.trade_id) : undefined;
  const today = s.now.toISOString().slice(0, 10);
  const first = a.blockedBy[0];
  return {
    id,
    title: task.title,
    area: areaLabel(s.areaById, task.area_id) || t.tasks.noArea,
    areaId: task.area_id,
    trade: trade?.name ?? null,
    tradeColor: trade?.color ?? "#94a3b8",
    contractor: contractorName(s, task.contractor_id),
    contractorId: task.contractor_id,
    state: a.effective,
    storedStatus: task.status,
    critical: task.is_critical || a.onCriticalPath,
    blocksDirect: a.blocksDirect,
    blocksTransitive: a.blocksTransitive,
    plannedEnd: task.planned_end,
    overdue: a.effective !== "done" && !!task.planned_end && task.planned_end < today,
    outOfOrder: a.outOfOrder,
    reason:
      a.effective === "blocked" && first
        ? describeBlocking(s, first).text + (a.blockedBy.length > 1 ? ` (+${a.blockedBy.length - 1})` : "")
        : null,
  };
}

export interface NeedYouVM {
  id: string;
  kind: Bottleneck["reason"];
  kindLabel: string;
  line: string;
  who: string;
  href: string;
  blocksDirect: number;
  blocksTransitive: number;
  critical: boolean;
}

function bottleneckVM(s: ProjectSnapshot, b: Bottleneck): NeedYouVM {
  const labels: Record<Bottleneck["reason"], string> = {
    external: t.home.kindExternal,
    awaiting_approval: t.home.kindApproval,
    manual: t.home.kindManual,
    overdue: t.home.kindOverdue,
    bottleneck: t.home.kindBottleneck,
  };
  const who =
    b.actor.type === "pm"
      ? t.roles.pm
      : b.actor.type === "owner"
        ? b.actor.name ?? t.app.unknown
        : contractorLabel(s, b.actor.id);
  const href =
    b.kind === "external" ? `/overview#blocker-${b.id}` : b.reason === "awaiting_approval" ? "/approvals" : `/tasks/${b.id}`;
  return {
    id: b.id,
    kind: b.reason,
    kindLabel: labels[b.reason],
    line: t.home.blocksN(b.title, b.blocksTransitive),
    who,
    href,
    blocksDirect: b.blocksDirect,
    blocksTransitive: b.blocksTransitive,
    critical: b.blocksCritical,
  };
}

export interface HomeVM {
  readyCount: number;
  stats: { blocked: number; inProgress: number; awaiting: number; critical: number };
  byTrade: Array<{ id: string; name: string; color: string; count: number }>;
  recommendation: {
    tasks: Array<TaskCardVM & { unlocks: number; unlocksAfterLag: number }>;
    unlocked: number;
    unlockedAfterLag: number;
  };
  needYou: NeedYouVM[];
  readyList: Array<TaskCardVM & { unlocks: number }>;
  projectEnd: string;
}

export function homeView(s: ProjectSnapshot): HomeVM {
  const a = s.analysis;
  const trades = new Map<string, number>();
  for (const id of a.readyIds) {
    const tr = s.taskById.get(id)!.trade_id ?? "none";
    trades.set(tr, (trades.get(tr) ?? 0) + 1);
  }
  const byTrade = [...trades.entries()]
    .map(([id, count]) => {
      const tr = s.tradeById.get(id);
      return { id, name: tr?.name ?? t.tasks.noTrade, color: tr?.color ?? "#94a3b8", count };
    })
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, "he"));

  const impact = new Map(snapshotUnlockImpact(s).map((i) => [i.taskId, i]));
  const rec = snapshotRecommendation(s, 3);

  const readyList = a.readyIds
    .map((id) => ({ ...taskCard(s, id), unlocks: impact.get(id)?.immediate.length ?? 0 }))
    .sort((x, y) => y.unlocks - x.unlocks || Number(y.critical) - Number(x.critical) || y.blocksTransitive - x.blocksTransitive);

  const end = new Date(s.now.getTime() + a.projectEndHours * 3600_000);
  return {
    readyCount: a.readyIds.length,
    stats: {
      blocked: a.blockedIds.length,
      inProgress: a.inProgressIds.length,
      awaiting: a.awaitingIds.length,
      critical: a.criticalPath.length,
    },
    byTrade,
    recommendation: {
      tasks: rec.taskIds.map((id) => ({
        ...taskCard(s, id),
        unlocks: impact.get(id)?.immediate.length ?? 0,
        unlocksAfterLag: impact.get(id)?.afterLag.length ?? 0,
      })),
      unlocked: rec.unlocked.length,
      unlockedAfterLag: rec.unlockedAfterLag.length,
    },
    needYou: a.bottlenecks.map((b) => bottleneckVM(s, b)),
    readyList,
    projectEnd: end.toISOString(),
  };
}
