import { describe, expect, it } from "vitest";
import { demoStore } from "@/test/fixtures";
import { analyzePlanText, disciplineOf, readingOrder, textChanges } from "./analyze";

const areas = demoStore().data.areas;
const name = (id: string) => areas.find((a) => a.id === id)!.name;

describe("reading a plan's PDF text", () => {
  it("finds discipline, sheet, revision and the apartments it shows", () => {
    const r = analyzePlanText("תוכנית חשמל – קומה 4\nדירה 13   דירה 14\nלוח חשמל דירתי\nגיליון: e-104   מהדורה ג", "", areas);
    expect(r).toMatchObject({ discipline: "electrical", sheet: "E-104", revision: "ג" });
    expect(r.areaIds.map(name).sort()).toEqual(["דירה 13", "דירה 14", "קומה 4"]);
  });

  it("reads Hebrew stored in visual order (CAD exports)", () => {
    expect(readingOrder("13 הריד")).toBe("דירה 13");
    const r = analyzePlanText("היצלטסניא תינכות\n13 הריד", "", areas);
    expect(r.discipline).toBe("plumbing");
    expect(r.areaIds.map(name)).toContain("דירה 13");
  });

  it("uses the title when the PDF has no text, and says nothing when unsure", () => {
    expect(disciplineOf("תוכנית קונסטרוקציה קומה 3")).toBe("structure");
    expect(analyzePlanText("", "תוכנית מיזוג", areas).discipline).toBe("hvac");
    expect(analyzePlanText("", "תוכנית", areas)).toEqual({ discipline: null, sheet: null, revision: null, areaIds: [] });
  });

  it("lists words added and removed between versions, ignoring flipped duplicates", () => {
    const c = textChanges("דלת 90 מטבח\nהריד 13", "דלת 100 מטבח\nדירה 13\nארון חשמל");
    expect(c.added).toEqual(expect.arrayContaining(["100", "ארון", "חשמל"]));
    expect(c.removed).toEqual(["90"]);
  });
});
