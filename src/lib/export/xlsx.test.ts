import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { parseWorkbook, type SheetRows } from "../import/plan";
import { sheetNames, writeXlsx } from "./xlsx";

describe("xlsx writer", () => {
  it("writes sheets that Excel readers (and our importer) read back", async () => {
    const bytes = writeXlsx([
      {
        name: "תוכנית השלמה",
        headerRow: 2,
        rows: [
          ["תוכנית עבודה – בדיקה"],
          [],
          ["מס", "מיקום", "משימה", "בעל מקצוע / אחראי", "סטטוס", "התחלה", "תלויות"],
          [1, "דירה 14", "פתח שירות <בכניסה> & \"מרפסת\"", "עז סמארה", "הושלם", { date: "2026-09-20" }, null],
          [2, "דירה 14", "סיום אינסטלציה", "מג׳די", "בביצוע", null, "1"],
        ],
      },
    ]);
    // the same call the importer makes: every sheet with its rows
    const sheets = (await readXlsxFile(Buffer.from(bytes))) as unknown as SheetRows[];
    expect(sheets.map((s) => s.sheet)).toEqual(["תוכנית השלמה"]);
    const data = sheets[0].data;
    expect(data[3][2]).toBe('פתח שירות <בכניסה> & "מרפסת"');
    expect(data[3][5]).toBeInstanceOf(Date);
    const plan = parseWorkbook(sheets);
    expect(plan.tasks.map((t) => [t.ref, t.status, t.start])).toEqual([
      ["תוכנית השלמה#1", "awaiting_approval", "2026-09-20"],
      ["תוכנית השלמה#2", "in_progress", null],
    ]);
    expect(plan.tasks[1].dependsOn).toEqual(["תוכנית השלמה#1"]);
  });

  it("keeps sheet names valid and unique", () => {
    expect(sheetNames(["a/b", "a/b", "x".repeat(40)])).toEqual(["a b", "a b 2", "x".repeat(31)]);
  });
});
