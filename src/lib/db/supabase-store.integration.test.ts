/**
 * Integration test of SupabaseStore and the RLS policies against a real
 * Postgres + PostgREST (the REST layer Supabase runs). Skipped unless
 * started through scripts/supabase-test/run.sh (sets SITEFLOW_IT=1).
 */
import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoData, contractorProfileId, DEMO_IDS, sid } from "../seed/demo";
import type { Area } from "./types";
import { SupabaseStore } from "./supabase-store";
import { StoreError } from "./store";

const ENABLED = process.env.SITEFLOW_IT === "1";
const SECRET = process.env.SITEFLOW_IT_SECRET ?? "";
const PGRST = process.env.SITEFLOW_IT_PGRST ?? "";
const PORT = Number(process.env.SITEFLOW_IT_PROXY_PORT ?? 3902);
const URL_ = `http://localhost:${PORT}`;
const NOW = new Date("2026-10-05T09:00:00Z");
const T = (k: string) => sid(`task:${k}`);

function jwt(claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}

function psql(sql: string) {
  execSync(`${process.env.SITEFLOW_IT_PSQL ?? "psql"} -v ON_ERROR_STOP=1 -q -d ${process.env.SITEFLOW_IT_DB} -c "${sql.replace(/"/g, '\\"')}"`);
}

/** supabase-js talks to <url>/rest/v1; PostgREST serves at /. */
function startProxy() {
  const target = new URL(PGRST);
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const p = http.request({ host: target.hostname, port: target.port, path, method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
      res.writeHead(r.statusCode ?? 500, r.headers);
      r.pipe(res);
    });
    req.pipe(p);
  });
  return new Promise<http.Server>((resolve) => server.listen(PORT, () => resolve(server)));
}

const admin = () =>
  createClient(URL_, jwt({ role: "service_role" }), { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!ENABLED)("SupabaseStore against Postgres + PostgREST", () => {
  let server: http.Server;
  let store: SupabaseStore;

  beforeAll(async () => {
    server = await startProxy();
    store = new SupabaseStore(admin());
    // seed through the store itself (exercises inserts, FKs, checks, the cycle trigger)
    const d = buildDemoData(NOW);
    const depth = (a: Area): number => (a.parent_id ? 1 + depth(d.areas.find((x) => x.id === a.parent_id)!) : 0);
    await store.insert("trades", d.trades);
    await store.insert("organizations", d.organizations);
    await store.insert("profiles", d.profiles);
    await store.insert("projects", d.projects);
    await store.insert("project_members", d.project_members);
    await store.insert("areas", [...d.areas].sort((a, b) => depth(a) - depth(b)));
    await store.insert("contractors", d.contractors);
    await store.insert("external_blockers", d.external_blockers);
    await store.insert("plan_files", d.plan_files);
    await store.insert("plan_pins", d.plan_pins);
    await store.insert("tasks", d.tasks.map((t) => ({ ...t, created_from_message_id: null })));
    await store.insert("dependencies", d.dependencies);
    await store.insert("rules", d.rules);
    await store.insert("conversations", d.conversations);
    await store.insert("conversation_participants", d.conversation_participants);
    await store.insert("messages", d.messages);
    await store.insert("message_links", d.message_links);
    await store.insert("completion_reports", d.completion_reports);
  }, 60_000);

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("reads with filters, ordering, limits and operators", async () => {
    const tasks = await store.select("tasks", { where: { project_id: DEMO_IDS.project } });
    expect(tasks).toHaveLength(131);
    const blocked = await store.select("tasks", { where: { status: { in: ["in_progress", "awaiting_approval"] } }, order: [["title", "asc"]] });
    expect(blocked.length).toBe(13);
    expect(blocked.map((t) => t.title)).toEqual([...blocked.map((t) => t.title)].sort((a, b) => (a < b ? -1 : 1)));
    expect(await store.select("tasks", { where: { id: { in: [] } } })).toEqual([]);
    const notDone = await store.select("tasks", { where: { status: { neq: "done" } } });
    expect(notDone.length).toBe(131 - 42);
    const noArea = await store.select("plan_pins", { where: { label: null } });
    expect(noArea).toEqual([]);
    expect(await store.first("tasks", { where: { id: T("D9") } })).toMatchObject({ status: "awaiting_approval" });
    expect((await store.byId("tasks", T("D9")))!.title).toContain("דירה 9");
  });

  it("pages past the 1000-row PostgREST limit", async () => {
    const rows = Array.from({ length: 1250 }, (_, i) => ({
      project_id: DEMO_IDS.project,
      entity_type: "task" as const,
      entity_id: T("D9"),
      action: `bulk-${i}`,
      source: "system" as const,
    }));
    await store.insert("audit_log", rows);
    const all = await store.select("audit_log", { where: { project_id: DEMO_IDS.project } });
    expect(all.length).toBe(1250);
    expect((await store.select("audit_log", { limit: 5 })).length).toBe(5);
  });

  it("maps the DB cycle guard and unique violations to StoreError codes", async () => {
    const err = await store
      .insert("dependencies", { project_id: DEMO_IDS.project, from_task_id: T("PA1"), to_task_id: T("E1") })
      .catch((e) => e);
    expect(err).toBeInstanceOf(StoreError);
    expect(err.code).toBe("cycle");
    const dup = await store
      .insert("dependencies", { project_id: DEMO_IDS.project, from_task_id: T("E1"), to_task_id: T("D1") })
      .catch((e) => e);
    expect(dup.code).toBe("unique");
  });

  it("runs the full completion → release flow through the services", async () => {
    const { loadSnapshot } = await import("../services/snapshot");
    const { approveReport } = await import("../services/completion");
    const pm = (await store.byId("profiles", DEMO_IDS.pm))!;
    const project = (await store.byId("projects", DEMO_IDS.project))!;
    const ctx = {
      store,
      now: NOW,
      s: { profile: pm, memberships: [], project, role: "pm" as const, contractorIds: [], isDemo: false },
    };
    const before = await loadSnapshot(store, project.id, NOW);
    expect(before.analysis.byTask[T("PL9")].effective).toBe("blocked");
    const res = await approveReport(ctx, sid("report:D9"));
    expect(res.released).toEqual([T("PL9")]);
    expect((await store.byId("tasks", T("PL9")))!.status).toBe("ready");
    const notes = await store.select("notifications", { where: { profile_id: contractorProfileId("samer") } });
    expect(notes.some((n) => n.kind === "released")).toBe(true);
  });

  it("stores the company process (jsonb) and falls back after reset", async () => {
    const { loadFlow, saveFlow, resetFlow } = await import("../services/flow-template");
    const { APARTMENT_FLOW } = await import("../flow/process");
    const pm = (await store.byId("profiles", DEMO_IDS.pm))!;
    const project = (await store.byId("projects", DEMO_IDS.project))!;
    const ctx = { store, now: NOW, s: { profile: pm, memberships: [], project, role: "pm" as const, contractorIds: [], isDemo: false } };
    const custom = APARTMENT_FLOW.slice(0, 3).map((st, i) => ({ ...st, after: i ? [{ key: APARTMENT_FLOW[i - 1].key, lag: 12 }] : [] }));
    await saveFlow(ctx, custom);
    await saveFlow(ctx, custom); // second save updates the same row
    const loaded = await loadFlow(store, project.organization_id);
    expect(loaded.custom).toBe(true);
    expect(loaded.stages.map((x) => x.key)).toEqual(custom.map((x) => x.key));
    expect(loaded.stages[1].after[0].lag).toBe(12);
    await resetFlow(ctx);
    expect((await loadFlow(store, project.organization_id)).custom).toBe(false);
  });

  it("opens a project in setup mode and captures apartments already under way", async () => {
    const { createProject } = await import("../services/project");
    const { captureExisting, flowStatus } = await import("../services/flow");
    const { loadSnapshot } = await import("../services/snapshot");
    const pm = (await store.byId("profiles", DEMO_IDS.pm))!;
    const memberships = await store.select("project_members", { where: { profile_id: pm.id } });
    const s = { profile: pm, memberships, project: null, role: null, contractorIds: [], isDemo: false };
    const project = await createProject(store, s, {
      name: "פיילוט",
      structure: { buildingName: "בניין C", floorFrom: 1, floorTo: 1, aptsPerFloor: 2, firstApt: 1 },
    });
    expect(project.setup_mode).toBe(true);
    const apts = await store.select("areas", { where: { project_id: project.id, type: "apartment" } });
    expect(apts).toHaveLength(2);
    const ctx = { store, now: NOW, s: { ...s, project, role: "pm" as const } };
    const res = await captureExisting(ctx, { areaIds: apts.map((a) => a.id), doneUpTo: "plaster", rescheduleFrom: "2026-10-12" });
    expect(res.marked).toBe(20);
    const snap = await loadSnapshot(store, project.id, NOW);
    const { APARTMENT_FLOW } = await import("../flow/process");
    expect(flowStatus(snap, apts[0].id, APARTMENT_FLOW).waterproofing.state).toBe("ready");
    const audits = await store.select("audit_log", { where: { project_id: project.id, entity_type: "project" } });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("runs the reminders tick (checks, overdue, no-response, digest) idempotently", async () => {
    const { runTick } = await import("../services/reminders");
    const first = await runTick(store, NOW);
    expect(first.reminders).toBeGreaterThan(5);
    const kinds = new Set((await store.select("reminders")).map((r) => r.kind));
    expect([...kinds]).toEqual(expect.arrayContaining(["check", "overdue", "no_response", "digest"]));
    expect((await runTick(store, new Date(NOW.getTime() + 60_000))).reminders).toBe(0);
  });

  it("RLS: a contractor's JWT only sees and changes his own data", async () => {
    const authId = "11111111-1111-1111-1111-111111111111";
    psql(`insert into auth.users(id, phone) values ('${authId}', '972501110002')`); // Shor → linked by trigger
    expect((await store.byId("profiles", contractorProfileId("shor")))!.auth_user_id).toBe(authId);

    const shor = createClient(URL_, jwt({ role: "anon" }), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt({ role: "authenticated", sub: authId })}` } },
    });
    const { data: tasks } = await shor.from("tasks").select("title");
    expect(tasks!.map((t) => t.title).sort()).toEqual(["התקנת דלתות אש – חדר מדרגות", "התקנת מעקות מרפסות"].sort());
    const { data: deps } = await shor.from("dependencies").select("id");
    expect(deps).toEqual([]);
    const { data: convs } = await shor.from("conversations").select("id");
    expect(convs!.map((c) => c.id).sort()).toEqual([sid("conv:direct:shor"), sid("conv:group")].sort());
    const { data: upd } = await shor.from("tasks").update({ status: "done", completed_at: NOW.toISOString() }).eq("id", T("RL")).select();
    expect(upd).toEqual([]);
    // may post in his own chat, not as someone else and not with an AI verdict
    const ok = await shor.from("messages").insert({
      conversation_id: sid("conv:direct:shor"),
      project_id: DEMO_IDS.project,
      sender_profile_id: contractorProfileId("shor"),
      text: "בדיקה",
    });
    expect(ok.error).toBeNull();
    const forged = await shor.from("messages").insert({
      conversation_id: sid("conv:direct:ahmad"),
      project_id: DEMO_IDS.project,
      sender_profile_id: contractorProfileId("shor"),
      text: "x",
    });
    expect(forged.error).not.toBeNull();
    // anonymous: nothing
    const anon = createClient(URL_, jwt({ role: "anon" }), { auth: { persistSession: false } });
    expect((await anon.from("tasks").select("id")).data).toEqual([]);
  });
});
