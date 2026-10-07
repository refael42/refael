import { describe, expect, it } from "vitest";
import { DEMO_IDS, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore } from "@/test/fixtures";
import { listConversations } from "./chat";
import { addMember, createAreas, createContractor, deleteArea, expandNames, normalizePhone } from "./settings";

describe("project setup", () => {
  it("expands ranges and normalises phones", () => {
    expect(expandNames(["דירה 21-23", "גג"])).toEqual(["דירה 21", "דירה 22", "דירה 23", "גג"]);
    expect(normalizePhone("050-123 4567")).toBe("+972501234567");
    expect(normalizePhone("+972 50 1234567")).toBe("+972501234567");
    expect(normalizePhone("12")).toBeNull();
  });

  it("adds a floor with apartments, refuses wrong nesting, deletes only empty areas", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [floor] = await createAreas(pm, { parentId: sid("area:building"), type: "floor", names: ["קומה 5"] });
    const apts = await createAreas(pm, { parentId: floor.id, type: "apartment", names: ["דירה 21-25"] });
    expect(apts.map((a) => a.name)).toEqual(["דירה 21", "דירה 22", "דירה 23", "דירה 24", "דירה 25"]);
    await expect(createAreas(pm, { parentId: apts[0].id, type: "floor", names: ["x"] })).rejects.toThrow();
    await expect(deleteArea(pm, sid("area:apt17"))).rejects.toThrow("משימות");
    await deleteArea(pm, floor.id);
    expect(store.data.areas.some((a) => a.parent_id === floor.id || a.id === floor.id)).toBe(false);
  });

  it("a new contractor gets a profile, membership and a chat with the PM", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const c = await createContractor(pm, { name: "סרגיי", phone: "052-7654321", trade_id: sid("trade:tiling") });
    expect(c.phone).toBe("+972527654321");
    const member = store.data.project_members.find((m) => m.profile_id === c.profile_id);
    expect(member?.role).toBe("contractor");
    const convs = await listConversations(store, pm.s);
    expect(convs.some((x) => x.title === "סרגיי")).toBe(true);
    await expect(createContractor(pm, { name: "כפול", phone: "0527654321" })).rejects.toThrow();
    await expect(createContractor(pm, { name: "בלי פרטים" })).rejects.toThrow();
  });

  it("only the PM manages the project", async () => {
    const store = demoStore();
    const shor = await ctxFor("shor", store);
    await expect(createAreas(shor, { parentId: null, type: "building", names: ["B"] })).rejects.toThrow();
    const pm = await ctxFor("pm", store);
    await addMember(pm, { name: "יועץ", email: "consult@x.co", role: "viewer" });
    expect(store.data.project_members.filter((m) => m.project_id === DEMO_IDS.project && m.role === "viewer")).toHaveLength(2);
  });
});
