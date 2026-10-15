import { describe, expect, it } from "vitest";
import { Learner, similarity, tokens } from "./learn";

describe("learning from the PM's decisions", () => {
  it("compares meaningful words, ignoring numbers, filler and a leading particle", () => {
    expect(similarity(tokens("תיקון צנרת מזגן בדירה 14"), tokens("תיקון צנרת מזגן בדירה 15"))).toBe(1);
    expect(similarity(tokens("בוקר טוב, תודה"), tokens("תיקון צנרת"))).toBe(0);
  });

  it("proposes what reads like an approved update, and vetoes what reads like a dismissed one", () => {
    const l = new Learner([
      { id: "a", type: "new_task", text: "להחליף משקוף פגום בדירה 15", positive: true },
      { id: "b", type: "material_missing", text: "חסר לי בתשלום הקודם", positive: false },
    ]);
    expect(l.guess("צריך להחליף משקוף פגום בדירה 9")).toMatchObject({ type: "new_task", exampleId: "a" });
    expect(l.guess("מחר יש ישיבה עם הדיירים")).toBeNull();
    expect(l.vetoes("חסר לי בתשלום הקודם 200", "material_missing")).toBe(true);
    expect(l.vetoes("חסר לי בתשלום הקודם 200", "blocker")).toBe(false);
  });
});
