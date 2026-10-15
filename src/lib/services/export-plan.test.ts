import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { writeXlsx } from "../export/xlsx";
import { parseWorkbook, type SheetRows } from "../import/plan";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { buildPlanExport } from "./export-plan";
import { checkReimport, importPlan } from "./import-plan";
import { loadSnapshot } from "./snapshot";

async function exported(store: ReturnType<typeof demoStore>, projectId: string) {
  const snap = await loadSnapshot(store, projectId, NOW);
  const { sheets, fileName } = buildPlanExport(snap);
  const read = (await readXlsxFile(Buffer.from(writeXlsx(sheets)))) as unknown as SheetRows[];
  return { read, fileName, snap };
}

describe("export the work plan to Excel", () => {
  it("round-trips: importing the exported file changes nothing and duplicates nothing", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const { read, fileName, snap } = await exported(store, pm.s.project.id);
    expect(fileName).toMatch(/\.xlsx$/);
    expect(read.map((s) => s.sheet)).toContain("בעלי מקצוע ושירותים");

    const plan = parseWorkbook(read);
    expect(plan.tasks).toHaveLength(snap.tasks.length);
    expect(plan.tasks.every((t) => t.id)).toBe(true);
    expect(checkReimport(plan, store.data.tasks)).toMatchObject({ update: snap.tasks.length, created: 0, suspicious: false });

    const before = {
      tasks: structuredClone(store.data.tasks),
      areas: store.data.areas.length,
      trades: store.data.trades.length,
    };
    const r = await importPlan(pm, plan);
    expect(r).toMatchObject({ created: 0, updated: snap.tasks.length, areas: 0 });
    expect(store.data.tasks).toHaveLength(before.tasks.length);
    expect(store.data.areas).toHaveLength(before.areas);
    expect(store.data.trades).toHaveLength(before.trades);
    // (an import also releases planned tasks whose prerequisites are done: planned → ready)
    const st = (x: string) => (x === "ready" ? "planned" : x);
    for (const was of before.tasks) {
      const now = store.data.tasks.find((x) => x.id === was.id)!;
      expect({ title: now.title, status: st(now.status), area: now.area_id, trade: now.trade_id, description: now.description }).toEqual({
        title: was.title,
        status: st(was.status),
        area: was.area_id,
        trade: was.trade_id,
        description: was.description,
      });
      expect(now.external_ref).toBeTruthy();
    }
  });

  it("an exported file re-sorted and renumbered still updates the same tasks", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const { read } = await exported(store, pm.s.project.id);
    await importPlan(pm, parseWorkbook(read));
    const count = store.data.tasks.length;

    const { read: again } = await exported(store, pm.s.project.id);
    const main = again[0];
    const body = main.data.slice(3).reverse();
    body.forEach((row, i) => (row[0] = i + 1));
    main.data = [...main.data.slice(0, 3), ...body];
    const plan = parseWorkbook(again);
    expect(checkReimport(plan, store.data.tasks)).toMatchObject({ created: 0, suspicious: false });
    const r = await importPlan(pm, plan);
    expect(r.created).toBe(0);
    expect(store.data.tasks).toHaveLength(count);
    expect(new Set(store.data.tasks.map((t) => t.external_ref)).size).toBe(count);
  });
});
