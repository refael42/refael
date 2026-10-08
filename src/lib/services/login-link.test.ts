import { describe, expect, it } from "vitest";
import { contractorProfileId } from "@/lib/seed/demo";
import { ctxFor, demoStore } from "@/test/fixtures";
import { createLoginLink, type LinkAuth } from "./login-link";

/** In-memory stand-in for the Supabase Auth admin API. */
function fakeAuth(users: Record<string, string | null> = {}): LinkAuth & { users: Record<string, string | null> } {
  return {
    users,
    async userEmail(id) {
      return users[id] ?? null;
    },
    async setUserEmail(id, email) {
      users[id] = email;
    },
    async magicLink(email) {
      const id = Object.keys(users).find((k) => users[k] === email) ?? `auth-${email}`;
      users[id] = email;
      return { userId: id, hashedToken: `tok-${id}` };
    },
  };
}

describe("login link", () => {
  it("links the member's profile to an auth user and returns a token", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const id = contractorProfileId("shor");
    const { token } = await createLoginLink(pm, fakeAuth(), id);
    expect(token).toBe("tok-auth-shor@siteflow.demo");
    expect((await store.byId("profiles", id))!.auth_user_id).toBe("auth-shor@siteflow.demo");
  });

  it("takes the account over from an empty profile made by an earlier sign-up", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [orphan] = await store.insert("profiles", { full_name: "x", email: "shor@siteflow.demo", auth_user_id: "auth-1" });
    await createLoginLink(pm, fakeAuth({ "auth-1": "shor@siteflow.demo" }), contractorProfileId("shor"));
    expect((await store.byId("profiles", orphan.id))!.auth_user_id).toBeNull();
    expect((await store.byId("profiles", contractorProfileId("shor")))!.auth_user_id).toBe("auth-1");
  });

  it("needs an email, a project member and a PM", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const id = contractorProfileId("shor");
    await store.update("profiles", { id }, { email: null });
    await expect(createLoginLink(pm, fakeAuth(), id)).rejects.toThrow("אימייל");
    const [stranger] = await store.insert("profiles", { full_name: "y", email: "y@x.co" });
    await expect(createLoginLink(pm, fakeAuth(), stranger.id)).rejects.toThrow();
    const viewer = await ctxFor("viewer", store);
    await expect(createLoginLink(viewer, fakeAuth(), contractorProfileId("paz"))).rejects.toThrow();
  });
});
