import { describe, expect, it } from "vitest";
import { sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { getConversation, listConversations, markRead, sendMessage } from "./chat";

const direct = (k: string) => sid(`conv:direct:${k}`);

describe("chat access", () => {
  it("contractors only list their own conversations", async () => {
    const ctx = await ctxFor("shor");
    const list = await listConversations(ctx.store, ctx.s);
    expect(list.map((c) => c.id).sort()).toEqual([direct("shor"), sid("conv:group")].sort());
    await expect(getConversation(ctx.store, ctx.s, direct("ahmad"))).rejects.toThrow();
    await expect(sendMessage(ctx, direct("ahmad"), { text: "hi" })).rejects.toThrow();
  });

  it("hides pending AI suggestions from non-PMs", async () => {
    const shor = await ctxFor("shor");
    const conv = await getConversation(shor.store, shor.s, direct("shor"));
    expect(conv.messages.find((m) => m.aiStatus === "suggested")?.ai).toBeNull();
    const pm = await ctxFor("pm", shor.store);
    const pmConv = await getConversation(pm.store, pm.s, direct("shor"));
    expect(pmConv.messages.find((m) => m.aiStatus === "suggested")?.ai?.intent).toBe("new_task");
  });

  it("read receipts follow last_read_at", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const moti = await ctxFor("moti", store);
    const msg = await sendMessage(pm, direct("moti"), { text: "?" });
    let conv = await getConversation(store, pm.s, direct("moti"));
    expect(conv.messages.find((m) => m.id === msg.id)!.readByAll).toBe(false);
    await markRead({ ...moti, now: new Date(NOW.getTime() + 1000) }, direct("moti"));
    conv = await getConversation(store, pm.s, direct("moti"));
    expect(conv.messages.find((m) => m.id === msg.id)!.readByAll).toBe(true);
  });

  it("rejects media keys from another project", async () => {
    const pm = await ctxFor("pm");
    await expect(sendMessage(pm, direct("shor"), { kind: "image", mediaUrl: "media/other-project/x.jpg" })).rejects.toThrow();
  });
});
