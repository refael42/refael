"use server";
import readXlsxFile from "read-excel-file/node";
import { he } from "@/lib/i18n/he";
import { parseWorkbook, type Plan, type SheetRows } from "@/lib/import/plan";
import { assertPM } from "@/lib/services/access";
import { buildingNameFrom, importPlan } from "@/lib/services/import-plan";
import { ServiceError } from "@/lib/services/tasks";
import { run } from "./_run";

const MAX_BYTES = 15 * 1024 * 1024;

async function readPlan(form: FormData): Promise<Plan> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) throw new ServiceError(he.importPlan.badFile);
  try {
    const sheets = (await readXlsxFile(Buffer.from(await file.arrayBuffer()))) as SheetRows[];
    return parseWorkbook(sheets);
  } catch {
    throw new ServiceError(he.importPlan.badFile);
  }
}

/** Read the file and say what would be imported (nothing is written). */
export async function previewPlanAction(form: FormData) {
  return run(async (ctx) => {
    assertPM(ctx.s);
    const plan = await readPlan(form);
    const count = (st: string) => plan.tasks.filter((t) => t.status === st).length;
    return {
      title: plan.title,
      building: buildingNameFrom(plan, ctx.s.project.name),
      tasks: plan.tasks.length,
      people: plan.people.length,
      done: count("awaiting_approval") + count("done"),
      inProgress: count("in_progress"),
      blocked: count("blocked"),
      dependencies: plan.tasks.reduce((n, t) => n + t.dependsOn.length, 0),
      skipped: plan.skipped,
      warnings: plan.warnings.slice(0, 20),
      sample: plan.tasks.slice(0, 5).map((t) => ({ number: t.number, title: t.title, location: t.location, responsible: t.responsible })),
      // every dependency spelled out, so wrong numbers stand out before importing
      dependencyList: plan.tasks.flatMap((t) =>
        t.dependsOn.map((ref) => {
          const from = plan.tasks.find((x) => x.ref === ref)!;
          return { to: `${t.number}. ${t.title}`, from: `${from.number}. ${from.title}` };
        }),
      ),
    };
  });
}

export async function importPlanAction(form: FormData) {
  return run(async (ctx) => {
    const plan = await readPlan(form);
    const building = String(form.get("building") ?? "").trim() || undefined;
    return importPlan(ctx, plan, { buildingName: building, dependencies: form.get("dependencies") !== "0" });
  });
}
