/**
 * Engine 3 — templates / rules → suggested dependencies.
 *
 * Deterministic: given the project's tasks, areas and the company's rules,
 * propose edges for newly created tasks. The PM approves each one; every
 * decision is recorded in rule_feedback so future suggestions follow it:
 *  - a rule rejected repeatedly (more rejections than acceptances, ≥2) is
 *    still shown but unchecked and marked "you rejected this before";
 *  - a trade pair the PM links manually twice becomes a "learned" rule.
 */
import { validateNewDependency, type EngineDependency } from "../engine";
import type { Store } from "../db/store";
import type { Area, Dependency, Rule, RuleFeedback, Task } from "../db/types";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { AccessError } from "./auth-types";
import { areasOverlap } from "./snapshot";
import type { Ctx } from "./tasks";

export interface DependencySuggestion {
  fromTaskId: string;
  toTaskId: string;
  lagHours: number;
  ruleId: string;
  ruleName: string;
  ruleSource: Rule["source"];
  /** PM rejected this rule more than accepted it — default unchecked. */
  lowConfidence: boolean;
}

export const LEARN_THRESHOLD = 2;

function keywordOk(title: string, kw: string | null) {
  return !kw || title.includes(kw);
}

function ruleMatches(rule: Rule, pred: Task, succ: Task, areaById: Map<string, Area>) {
  if (pred.trade_id !== rule.predecessor_trade_id || succ.trade_id !== rule.successor_trade_id) return false;
  if (!keywordOk(pred.title, rule.predecessor_keyword) || !keywordOk(succ.title, rule.successor_keyword)) return false;
  if (rule.scope === "same_room") return !!pred.area_id && pred.area_id === succ.area_id;
  return areasOverlap(areaById, pred.area_id, succ.area_id);
}

export function feedbackScore(feedback: RuleFeedback[], predTrade: string, succTrade: string) {
  let accepted = 0;
  let rejected = 0;
  for (const f of feedback) {
    if (f.predecessor_trade_id !== predTrade || f.successor_trade_id !== succTrade) continue;
    if (f.decision === "rejected") rejected++;
    else accepted++;
  }
  return { accepted, rejected };
}

/**
 * Suggest edges touching `newTaskIds` (both directions), skipping edges that
 * already exist, are implied by the new tasks themselves, or would create a
 * cycle (checked incrementally so the set as a whole stays acyclic).
 */
export function suggestDependencies(input: {
  tasks: Task[];
  dependencies: Pick<Dependency, "id" | "from_task_id" | "to_task_id">[];
  areas: Area[];
  rules: Rule[];
  feedback: RuleFeedback[];
  newTaskIds: string[];
  /** Edges already planned (e.g. the AI's depends_on chain) */
  plannedEdges?: Array<{ from: string; to: string }>;
}): DependencySuggestion[] {
  const areaById = new Map(input.areas.map((a) => [a.id, a]));
  const active = input.rules.filter((r) => r.active);
  const isNew = new Set(input.newTaskIds);
  const edges: EngineDependency[] = input.dependencies
    .filter((d) => d.from_task_id)
    .map((d) => ({ id: d.id, fromTaskId: d.from_task_id, toTaskId: d.to_task_id }));
  for (const e of input.plannedEdges ?? []) edges.push({ id: `planned:${e.from}->${e.to}`, fromTaskId: e.from, toTaskId: e.to });

  const out: DependencySuggestion[] = [];
  const seen = new Set<string>();
  const candidates = [...input.tasks].filter((t) => t.status !== "done" || !isNew.has(t.id));
  const sorted = [...active].sort((a, b) => a.name.localeCompare(b.name, "he") || a.id.localeCompare(b.id));

  for (const id of [...input.newTaskIds].sort()) {
    const task = input.tasks.find((t) => t.id === id);
    if (!task) continue;
    for (const rule of sorted) {
      for (const other of candidates) {
        if (other.id === task.id) continue;
        const pairs: Array<[Task, Task]> = [];
        if (ruleMatches(rule, other, task, areaById)) pairs.push([other, task]);
        if (ruleMatches(rule, task, other, areaById)) pairs.push([task, other]);
        for (const [pred, succ] of pairs) {
          // A done successor can't be blocked any more; skip.
          if (succ.status === "done") continue;
          const key = `${pred.id}->${succ.id}`;
          if (seen.has(key)) continue;
          if (!validateNewDependency(edges, pred.id, succ.id).ok) continue;
          seen.add(key);
          edges.push({ id: `suggest:${key}`, fromTaskId: pred.id, toTaskId: succ.id });
          const score = feedbackScore(input.feedback, rule.predecessor_trade_id, rule.successor_trade_id);
          out.push({
            fromTaskId: pred.id,
            toTaskId: succ.id,
            lagHours: Number(rule.lag_hours) || 0,
            ruleId: rule.id,
            ruleName: rule.name,
            ruleSource: rule.source,
            lowConfidence: score.rejected >= LEARN_THRESHOLD && score.rejected > score.accepted,
          });
        }
      }
    }
  }
  return out;
}

/** Rules visible to an organization: built-ins + its own. */
export async function loadRules(store: Store, organizationId: string) {
  const [builtin, own, feedback] = await Promise.all([
    store.select("rules", { where: { organization_id: null } }),
    store.select("rules", { where: { organization_id: organizationId } }),
    store.select("rule_feedback", { where: { organization_id: organizationId } }),
  ]);
  return { rules: [...builtin, ...own], feedback };
}

/**
 * Record the PM's decision. When the same trade pair is added manually
 * LEARN_THRESHOLD times with no matching rule, create a learned rule.
 */
export async function recordRuleFeedback(
  store: Store,
  args: {
    organizationId: string;
    predTradeId: string | null;
    succTradeId: string | null;
    decision: RuleFeedback["decision"];
    ruleId?: string | null;
    actor: string | null;
    lagHours?: number;
    tradeNames?: { pred: string; succ: string };
  },
): Promise<Rule | null> {
  if (!args.predTradeId || !args.succTradeId) return null;
  await store.insert("rule_feedback", {
    organization_id: args.organizationId,
    rule_id: args.ruleId ?? null,
    predecessor_trade_id: args.predTradeId,
    successor_trade_id: args.succTradeId,
    decision: args.decision,
    created_by: args.actor,
  });
  if (args.decision !== "added") return null;

  const { rules, feedback } = await loadRules(store, args.organizationId);
  const exists = rules.some(
    (r) => r.predecessor_trade_id === args.predTradeId && r.successor_trade_id === args.succTradeId && !r.predecessor_keyword && !r.successor_keyword,
  );
  if (exists) return null;
  const added = feedback.filter(
    (f) => f.decision === "added" && f.predecessor_trade_id === args.predTradeId && f.successor_trade_id === args.succTradeId,
  ).length;
  if (added < LEARN_THRESHOLD) return null;
  const [rule] = await store.insert("rules", {
    organization_id: args.organizationId,
    name: args.tradeNames ? `${args.tradeNames.pred} לפני ${args.tradeNames.succ}` : "חוק נלמד",
    predecessor_trade_id: args.predTradeId,
    successor_trade_id: args.succTradeId,
    scope: "same_area",
    lag_hours: args.lagHours ?? 0,
    active: true,
    source: "learned",
  });
  return rule;
}

// ───────────────────────── management (PM) ─────────────────────────

export interface RuleInput {
  name: string;
  predecessor_trade_id: string;
  successor_trade_id: string;
  predecessor_keyword?: string | null;
  successor_keyword?: string | null;
  scope: Rule["scope"];
  lag_hours: number;
  active?: boolean;
}

function validRule(r: RuleInput) {
  if (!r.name.trim() || !r.predecessor_trade_id || !r.successor_trade_id || !(r.lag_hours >= 0)) throw new AccessError(he.errors.invalid, 403);
}

export async function createRule(ctx: Ctx, r: RuleInput) {
  assertPM(ctx.s);
  validRule(r);
  const [rule] = await ctx.store.insert("rules", {
    organization_id: ctx.s.project.organization_id,
    name: r.name.trim(),
    predecessor_trade_id: r.predecessor_trade_id,
    successor_trade_id: r.successor_trade_id,
    predecessor_keyword: r.predecessor_keyword?.trim() || null,
    successor_keyword: r.successor_keyword?.trim() || null,
    scope: r.scope,
    lag_hours: r.lag_hours,
    active: r.active ?? true,
    source: "custom",
  });
  return rule;
}

async function ownRule(ctx: Ctx, id: string) {
  const rule = await ctx.store.byId("rules", id);
  // built-in rules (organization_id null) are read-only; override them with a custom rule
  if (!rule || rule.organization_id !== ctx.s.project.organization_id) throw new AccessError(he.templates.builtinReadonly, 403);
  return rule;
}

export async function updateRule(ctx: Ctx, id: string, patch: Partial<RuleInput>) {
  assertPM(ctx.s);
  const rule = await ownRule(ctx, id);
  validRule({ ...rule, ...patch, name: patch.name ?? rule.name } as RuleInput);
  const [updated] = await ctx.store.update("rules", { id }, patch);
  return updated;
}

export async function deleteRule(ctx: Ctx, id: string) {
  assertPM(ctx.s);
  await ownRule(ctx, id);
  await ctx.store.remove("rules", { id });
}
