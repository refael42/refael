import { describe, expect, it } from "vitest";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { importPlan } from "../services/import-plan";
import { loadSnapshot } from "../services/snapshot";
import { classifyLocation, mapStatus, matchPerson, parseWorkbook, splitResponsible, type SheetRows } from "./plan";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const SHEETS: SheetRows[] = [
  {
    sheet: "תוכנית השלמה",
    data: [
      ["תוכנית עבודה רשמית להשלמת פרויקט - בית הדקל 7"],
      [],
      ["מס", "סוג עבודה", "מיקום", "משימה", "בעל מקצוע / אחראי", "סטטוס", "אחוז ביצוע", "התחלה", "משך ימים", "סיום", "תלויות", "חסם / הערה", "אישור מנהל"],
      [1, "בנייה", "דירה 14 - כניסה", "פתח שירות בכניסה", "עז סמארה", "הושלם", 1, d("2026-09-20"), 2, d("2026-09-21"), null, "בוצע", "לא נבדק"],
      [2, "אינסטלציה", "דירה 14", "סיום אינסטלציה בשירותים", "מג׳די האינסטלטור + עז סמארה", "לתיאום", null, "22.09.2026", 3, null, "1", "לתאם עם הדייר", "לא נבדק"],
      [3, "חשמל", "קומה 7 - מעלית", "פאקט 32 אמפר", "אחמד החשמלאי", "בביצוע", 0.3, null, null, null, "", "", "לא נבדק"],
      [4, "מעליות", "שתי המעליות", "המשך שלב ב׳ במעליות", "עידו", "ממתין", null, null, null, null, "2,3,99", "", "לא נבדק"],
      [5, "בנייה", "חיפויי הבניין", "השלמת חיפוי", "ודים", "חסום", null, null, null, null, "", "חסם: אין מעליות פעילות", "לא נבדק"],
      [6, "ממ\"ד", "דירה 15", "דלת ממ\"ד", "יוסי", "טרם התחיל", null, null, null, null, "", "", ""],
      [7, "אלומיניום", "דירה 15", "חלון שירותים", "יוסי אלומיניום", "הושלם", 1, null, null, null, "", "", "אושר"],
    ],
  },
  // a per-apartment detail view of the same tasks: no number column → skipped
  { sheet: "דירה 14", data: [["מיקום", "פעילות", "מבצע", "הערות"], ["דירה 14", "פתח שירות בכניסה", "עז סמארה", ""]] },
  {
    sheet: "בעלי מקצוע ושירותים",
    data: [
      ["בעלי מקצוע ושירותים"],
      ["שם", "תחום / תפקיד", "חברה", "טלפון", "פעולה / שימוש", "הערות"],
      ["אחמד", "חשמלאי", "", "050-4815724", "", ""],
      ["עז סמארה", "קבלן בנייה", "", "052-7598488", "", ""],
      ["יוסי", "אלומיניום", "גרובר", "", "", ""],
    ],
  },
];

describe("work plan spreadsheet", () => {
  it("reads tasks, contacts and dependencies, skipping detail sheets", () => {
    const plan = parseWorkbook(SHEETS);
    expect(plan.title).toContain("בית הדקל 7");
    expect(plan.tasks).toHaveLength(7);
    expect(plan.people.map((p) => p.name)).toEqual(["אחמד", "עז סמארה", "יוסי"]);
    expect(plan.skipped).toEqual(["דירה 14"]);
    const [t1, t2, t3, t4, t5, , t7] = plan.tasks;
    expect(t1).toMatchObject({ ref: "תוכנית השלמה#1", status: "awaiting_approval", start: "2026-09-20", end: "2026-09-21" });
    expect(t2).toMatchObject({ status: "planned", statusLabel: "לתיאום", start: "2026-09-22", end: "2026-09-24", dependsOn: ["תוכנית השלמה#1"] });
    expect(t3).toMatchObject({ status: "in_progress", percent: 0.3 });
    expect(t4.dependsOn).toEqual(["תוכנית השלמה#2", "תוכנית השלמה#3"]); // 99 doesn't exist
    expect(plan.warnings.join()).toContain("99");
    expect(t5.status).toBe("blocked");
    expect(t7.status).toBe("done"); // approved by the manager
  });

  it("places locations in the building", () => {
    expect(classifyLocation("דירה 14 - כניסה")).toMatchObject({ kind: "apartment", name: "דירה 14" });
    expect(classifyLocation("דירת מרינה (דירה 3)")).toMatchObject({ kind: "apartment", name: "דירה 3" });
    expect(classifyLocation("דירת הגן - החצר")).toMatchObject({ kind: "apartment", name: "דירת גן", garden: true });
    expect(classifyLocation("דירות 17-18").kind).toBe("building");
    expect(classifyLocation("קומה 7 - מעלית")).toMatchObject({ kind: "part", part: "elevator" });
    expect(classifyLocation("מכפילי חניה")).toMatchObject({ kind: "part", part: "parking" }); // parking stacker, not a duplex
    expect(classifyLocation("גג כניסה א")).toMatchObject({ kind: "part", part: "roof" });
    expect(classifyLocation("כניסות א וב")).toMatchObject({ kind: "part", part: "stairwell" });
    expect(classifyLocation("קומה 6")).toMatchObject({ kind: "floor", name: "קומה 6" });
    expect(classifyLocation("כל הפרויקט").kind).toBe("building");
  });

  it("matches people without merging two different Yossis", () => {
    const plan = parseWorkbook(SHEETS);
    const names = [...new Set(plan.tasks.flatMap((t) => splitResponsible(t.responsible)))];
    expect(splitResponsible("פועלי עז סמארה + מג׳די")).toEqual(["עז סמארה", "מג׳די"]);
    expect(matchPerson("אחמד החשמלאי", plan.people, names)?.phone).toBe("050-4815724");
    expect(matchPerson("יוסי אלומיניום", plan.people, names)?.company).toBe("גרובר");
    expect(matchPerson("יוסי", plan.people, names)).toBeNull();
    expect(mapStatus("הושלם", "לא נבדק", 1).status).toBe("awaiting_approval");
  });

  it("imports into a project and re-imports without duplicating", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const plan = parseWorkbook(SHEETS);
    const before = store.data.messages.length;
    const r = await importPlan(pm, plan);
    expect(r).toMatchObject({ created: 7, updated: 0, dependencies: 3, awaitingApproval: 1 });
    expect(store.data.messages.length).toBe(before); // nobody is messaged

    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const task = (n: number) => snap.tasks.find((t) => t.external_ref === `תוכנית השלמה#${n}`)!;
    expect(snap.areaById.get(task(1).area_id!)!.name).toBe("דירה 14");
    expect(task(1).status).toBe("awaiting_approval");
    expect(store.data.completion_reports.some((x) => x.task_id === task(1).id && x.status === "pending")).toBe(true);
    expect(snap.analysis.byTask[task(2).id].effective).toBe("blocked"); // waits for #1's approval
    expect(task(5)).toMatchObject({ status: "blocked_manual", blocked_reason: "חסם: אין מעליות פעילות" });
    expect(task(2).description).toContain("סטטוס בגיליון: לתיאום");
    expect(task(2).description).toContain("גם: עז סמארה");
    const ahmad = snap.contractorById.get(task(3).contractor_id!)!;
    expect(ahmad).toMatchObject({ name: "אחמד החשמלאי", phone: "+972504815724" });
    expect(snap.contractorById.get(task(6).contractor_id!)!.name).toBe("יוסי");
    expect(snap.contractorById.get(task(7).contractor_id!)!.name).toBe("יוסי אלומיניום");

    // the sheet is updated: #3 is done now, a new task #8 — import again
    const next = structuredClone(SHEETS);
    next[0].data[5][5] = "הושלם";
    next[0].data.push([8, "בנייה", "לובי", "צבע בלובי", "עז סמארה", "טרם התחיל", null, null, null, null, "", "", ""]);
    const r2 = await importPlan(pm, parseWorkbook(next));
    expect(r2).toMatchObject({ created: 1, updated: 7, dependencies: 0 });
    expect(store.data.tasks.filter((t) => t.external_ref?.startsWith("תוכנית השלמה#")).length).toBe(8);
    expect(store.data.tasks.find((t) => t.external_ref === "תוכנית השלמה#3")!.status).toBe("awaiting_approval");

    // the dependency numbers are fixed in the sheet: #4 no longer waits for #3 → removed; a manual one stays
    const t = (n: number) => store.data.tasks.find((x) => x.external_ref === `תוכנית השלמה#${n}`)!;
    store.data.dependencies.push({ ...store.data.dependencies.find((d) => d.source === "import")!, id: "manual-dep", from_task_id: t(8).id, to_task_id: t(6).id, source: "manual" });
    next[0].data[6][10] = "2";
    const r3 = await importPlan(pm, parseWorkbook(next));
    expect(r3).toMatchObject({ created: 0, removedDependencies: 1, dependencies: 0 });
    expect(store.data.dependencies.some((d) => d.from_task_id === t(3).id && d.to_task_id === t(4).id)).toBe(false);
    expect(store.data.dependencies.some((d) => d.id === "manual-dep")).toBe(true);
    // importing without dependencies removes all imported ones
    const r4 = await importPlan(pm, parseWorkbook(next), { dependencies: false });
    expect(r4.removedDependencies).toBe(2);
    expect(store.data.dependencies.filter((d) => d.source === "import")).toHaveLength(0);
  });
});
