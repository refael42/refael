import { describe, expect, it } from "vitest";
import { contractorProfileId, DEMO_IDS, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, T } from "@/test/fixtures";
import { approveReport, rejectReport, submitReport } from "./completion";

const key = (n = "a") => `media/${DEMO_IDS.project}/${n}.jpg`;

describe("completion reports", () => {
  it("contractor reports with a photo → awaiting approval → PM approves → successor released", async () => {
    const store = demoStore();
    const nik = await ctxFor("nikolai", store);
    await expect(submitReport(nik, { taskId: T("D10"), photoKeys: [] })).rejects.toThrow();
    const report = await submitReport(nik, { taskId: T("D10"), photoKeys: [key()] });
    expect((await store.byId("tasks", T("D10")))!.status).toBe("awaiting_approval");
    expect(store.data.notifications.some((n) => n.profile_id === DEMO_IDS.pm && n.kind === "report")).toBe(true);

    const pm = await ctxFor("pm", store);
    const res = await approveReport(pm, report.id);
    expect(res.released).toEqual([T("PL10")]);
    expect((await store.byId("tasks", T("D10")))!.status).toBe("done");
    expect(store.data.notifications.some((n) => n.profile_id === contractorProfileId("samer") && n.kind === "released")).toBe(true);
  });

  it("only the assigned contractor (or PM) may report, and only the PM approves", async () => {
    const store = demoStore();
    const avi = await ctxFor("avi", store);
    await expect(submitReport(avi, { taskId: T("D10"), photoKeys: [key()] })).rejects.toThrow();
    const nik = await ctxFor("nikolai", store);
    const r = await submitReport(nik, { taskId: T("D10"), photoKeys: [key()] });
    await expect(approveReport(nik, r.id)).rejects.toThrow();
    await expect(submitReport(nik, { taskId: T("D10"), photoKeys: ["media/other/x.jpg"] })).rejects.toThrow();
  });

  it("reject sends the task back with the PM's comment", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    await rejectReport(pm, sid("report:D9"), "חסר פתח ביקורת בתקרה");
    expect((await store.byId("tasks", T("D9")))!.status).toBe("in_progress");
    const msg = store.data.messages.find((m) => m.meta?.action === "report_rejected");
    expect(msg?.text).toContain("חסר פתח ביקורת בתקרה");
  });
});
