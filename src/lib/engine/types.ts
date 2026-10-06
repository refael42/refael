/**
 * Engine input/output types. The engine is pure and deterministic: no I/O, no
 * AI, no Date.now() — the caller passes `now`.
 */

export type StoredStatus = "planned" | "ready" | "in_progress" | "awaiting_approval" | "done" | "blocked_manual";
export type EffectiveState = "ready" | "blocked" | "in_progress" | "awaiting_approval" | "done";

export interface EngineTask {
  id: string;
  title: string;
  status: StoredStatus;
  contractorId?: string | null;
  plannedStart?: string | null; // YYYY-MM-DD
  plannedEnd?: string | null; // YYYY-MM-DD
  completedAt?: string | null; // ISO
  blockedReason?: string | null;
  isCritical?: boolean;
}

export interface EngineDependency {
  id: string;
  fromTaskId?: string | null;
  fromBlockerId?: string | null;
  toTaskId: string;
  lagHours?: number;
}

export interface EngineBlocker {
  id: string;
  title: string;
  ownerName?: string | null;
  status: "open" | "resolved";
  expectedDate?: string | null;
}

export interface EngineInput {
  tasks: EngineTask[];
  dependencies: EngineDependency[];
  blockers?: EngineBlocker[];
  now: Date;
}

/** One reason a task cannot start yet. */
export type BlockingItem =
  | {
      kind: "task";
      taskId: string;
      title: string;
      /** effective state of the predecessor */
      state: EffectiveState;
      contractorId: string | null;
      /** the PM must act (approve) rather than the contractor */
      needsPm: boolean;
    }
  | { kind: "external"; blockerId: string; title: string; ownerName: string | null }
  | { kind: "lag"; taskId: string; title: string; until: string }
  | { kind: "manual"; reason: string | null };

/** Something that can actually be acted on right now to unblock a chain. */
export type RootBlocker =
  | { kind: "task"; taskId: string; title: string; state: EffectiveState; contractorId: string | null; needsPm: boolean }
  | { kind: "external"; blockerId: string; title: string; ownerName: string | null }
  | { kind: "lag"; taskId: string; title: string; until: string }
  | { kind: "manual"; taskId: string; title: string; reason: string | null };

export interface TaskAnalysis {
  id: string;
  effective: EffectiveState;
  /** Direct reasons (empty when ready / done). */
  blockedBy: BlockingItem[];
  /** Upstream items someone can act on now (empty when ready / done). */
  rootBlockers: RootBlocker[];
  /** In progress although a predecessor is not done. */
  outOfOrder: boolean;
  predecessorIds: string[];
  successorIds: string[];
  /** Not-done direct successors. */
  blocksDirect: number;
  /** All not-done tasks downstream. */
  blocksTransitive: number;
  onCriticalPath: boolean;
  inCycle: boolean;
  /** Schedule (hours from `now`) from the CPM forward/backward pass. */
  earlyStart: number;
  earlyFinish: number;
  slackHours: number;
  durationHours: number;
}

export interface UnlockImpact {
  taskId: string;
  /** Tasks that become ready immediately if this task is completed now. */
  immediate: string[];
  /** Tasks freed but still waiting on a lag (drying etc.). */
  afterLag: string[];
  /** All not-done tasks downstream (tie-breaker). */
  downstream: number;
}

export interface Bottleneck {
  kind: "external" | "task";
  id: string;
  title: string;
  /** Who must act: contractor id, blocker owner, or "pm". */
  actor: { type: "contractor"; id: string | null } | { type: "pm" } | { type: "owner"; name: string | null };
  reason: "external" | "awaiting_approval" | "manual" | "overdue" | "bottleneck";
  blocksDirect: number;
  blocksTransitive: number;
  blocksCritical: boolean;
}

export interface ProjectAnalysis {
  now: string;
  byTask: Record<string, TaskAnalysis>;
  readyIds: string[];
  blockedIds: string[];
  inProgressIds: string[];
  awaitingIds: string[];
  doneIds: string[];
  /** Critical tasks ordered by early start. */
  criticalPath: string[];
  /** Hours from now until the computed end of all remaining work. */
  projectEndHours: number;
  cycles: string[][];
  bottlenecks: Bottleneck[];
}
