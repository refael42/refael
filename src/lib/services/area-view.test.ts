import { describe, expect, it } from "vitest";
import { mentionsArea } from "./area-view";

describe("mentionsArea", () => {
  it("matches names with Hebrew prefixes but not longer numbers", () => {
    expect(mentionsArea("קורת בטון מעל המשקוף בדירה 17, מתחילים", "דירה 17")).toBe(true);
    expect(mentionsArea("דירה 17", "דירה 17")).toBe(true);
    expect(mentionsArea("בדירה 17", "דירה 1")).toBe(false);
    expect(mentionsArea("סיימתי בקומה 2", "קומה 2")).toBe(true);
    expect(mentionsArea("קומה 22", "קומה 2")).toBe(false);
  });
});
