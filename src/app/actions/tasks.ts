"use server";
import type { ExternalBlocker, Task, TaskStatus } from "@/lib/db/types";
import type { DependencySuggestion } from "@/lib/services/rules";
import * as svc from "@/lib/services/tasks";
import { run } from "./_run";

export async function createTaskAction(input: svc.NewTaskInput) {
  return run(async (ctx) => {
    const r = await svc.createTasks(ctx, [input], { source: "manual" });
    return { taskId: r.tasks[0].id, suggestions: r.suggestions, labels: await svc.suggestionLabels(ctx, r.suggestions) };
  });
}

export async function suggestionsForTaskAction(taskId: string) {
  return run(async (ctx) => {
    const suggestions = await svc.suggestFor(ctx, [taskId]);
    return { suggestions, labels: await svc.suggestionLabels(ctx, suggestions) };
  });
}

export async function applySuggestionsAction(decisions: Array<DependencySuggestion & { accept: boolean }>) {
  return run(async (ctx) => (await svc.applySuggestions(ctx, decisions)).length);
}

export async function updateTaskAction(
  id: string,
  patch: Partial<Pick<Task, "title" | "description" | "area_id" | "trade_id" | "contractor_id" | "planned_start" | "planned_end" | "check_at" | "is_critical" | "plan_pin_id">>,
) {
  return run(async (ctx) => {
    await svc.updateTask(ctx, id, patch);
  });
}

export async function setTaskStatusAction(id: string, status: TaskStatus, reason?: string) {
  return run(async (ctx) => (await svc.setTaskStatus(ctx, id, status, { reason })).released.length);
}

export async function deleteTaskAction(id: string) {
  return run(async (ctx) => {
    await svc.deleteTask(ctx, id);
  });
}

export async function addDependencyAction(d: { fromTaskId?: string | null; fromBlockerId?: string | null; toTaskId: string; lagHours?: number }) {
  return run(async (ctx) => {
    await svc.addDependency(ctx, d);
  });
}

export async function removeDependencyAction(id: string) {
  return run(async (ctx) => (await svc.removeDependency(ctx, id)).released.length);
}

export async function createBlockerAction(
  input: Pick<ExternalBlocker, "title" | "owner_name" | "owner_phone" | "expected_date">,
  blocksTaskIds: string[],
) {
  return run(async (ctx) => {
    await svc.createBlocker(ctx, input, blocksTaskIds);
  });
}

export async function setBlockerStatusAction(id: string, status: ExternalBlocker["status"]) {
  return run(async (ctx) => (await svc.setBlockerStatus(ctx, id, status)).released.length);
}

/** One task per area: "<title> – <area name>" (same trade, contractor and dates). */
export async function bulkCreateTasksAction(input: {
  title: string;
  areaIds: string[];
  trade_id?: string | null;
  contractor_id?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
}) {
  return run(async (ctx) => {
    if (!input.title.trim() || !input.areaIds.length || input.areaIds.length > 100) throw new svc.ServiceError("invalid");
    const areas = await ctx.store.select("areas", { where: { id: { in: input.areaIds }, project_id: ctx.s.project.id } });
    const byId = new Map(areas.map((a) => [a.id, a]));
    const r = await svc.createTasks(
      ctx,
      input.areaIds
        .filter((id) => byId.has(id))
        .map((id) => ({
          title: `${input.title.trim()} – ${byId.get(id)!.name}`,
          area_id: id,
          trade_id: input.trade_id ?? null,
          contractor_id: input.contractor_id ?? null,
          planned_start: input.planned_start ?? null,
          planned_end: input.planned_end ?? null,
        })),
      { source: "manual" },
    );
    return { count: r.tasks.length, suggestions: r.suggestions, labels: await svc.suggestionLabels(ctx, r.suggestions) };
  });
}
