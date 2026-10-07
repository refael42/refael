import { describe, expect, it } from "vitest";
import { dayKey, fmtTime, localDate } from "./index";

describe("project timezone formatting", () => {
  it("formats in Asia/Jerusalem regardless of the server timezone", () => {
    const d = new Date("2026-10-05T22:30:00Z");
    expect(localDate(d)).toBe("2026-10-06");
    expect(fmtTime(d)).toBe("01:30");
    expect(dayKey("2026-10-05")).toBe(dayKey(new Date("2026-10-05T10:00:00Z")));
  });
});
