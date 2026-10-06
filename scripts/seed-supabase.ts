/**
 * Seed the demo project into a real Supabase project.
 *
 *   npm run seed            # upsert demo data (idempotent — stable ids)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
 * .env.local / .env or the environment). Also creates login users:
 *   pm@siteflow.demo / owner@siteflow.demo / <contractor>@siteflow.demo
 * all with password "siteflow-demo" (and their phone numbers for OTP).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { buildDemoData, DEMO_PASSWORD } from "../src/lib/seed/demo";
import type { Area } from "../src/lib/db/types";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function upsert(table: string, rows: object[], onConflict = "id") {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table.padEnd(26)} ${rows.length}`);
}

function byDepth(areas: Area[]): Area[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const depth = (a: Area): number => (a.parent_id ? 1 + depth(byId.get(a.parent_id)!) : 0);
  return [...areas].sort((a, b) => depth(a) - depth(b));
}

async function main() {
  const d = buildDemoData(new Date());
  console.log("Seeding demo project…");

  // trades are global and keyed by `key`; reuse existing ids if present
  const { data: existingTrades } = await db.from("trades").select("id,key");
  const tradeIdMap = new Map<string, string>();
  for (const tr of d.trades) {
    const found = existingTrades?.find((x) => x.key === tr.key);
    tradeIdMap.set(tr.id, found?.id ?? tr.id);
  }
  const tid = (id: string | null) => (id ? tradeIdMap.get(id) ?? id : id);
  await upsert("trades", d.trades.map((t) => ({ ...t, id: tid(t.id) })), "key");

  await upsert("organizations", d.organizations);
  await upsert("profiles", d.profiles.map(({ auth_user_id: _ignored, ...p }) => p));
  await upsert("projects", d.projects);
  await upsert("project_members", d.project_members, "project_id,profile_id");
  await upsert("areas", byDepth(d.areas));
  await upsert("contractors", d.contractors.map((c) => ({ ...c, trade_id: tid(c.trade_id) })));
  await upsert("external_blockers", d.external_blockers);
  await upsert("plan_files", d.plan_files);
  await upsert("plan_pins", d.plan_pins);
  await upsert(
    "tasks",
    d.tasks.map((t) => ({ ...t, trade_id: tid(t.trade_id), created_from_message_id: null })),
  );
  // Dependencies: delete + insert so the cycle trigger sees a consistent graph
  await db.from("dependencies").delete().eq("project_id", d.projects[0].id);
  await upsert("dependencies", d.dependencies);
  await upsert(
    "rules",
    d.rules.map((r) => ({ ...r, predecessor_trade_id: tid(r.predecessor_trade_id), successor_trade_id: tid(r.successor_trade_id) })),
  );
  await upsert("conversations", d.conversations);
  await upsert("conversation_participants", d.conversation_participants, "conversation_id,profile_id");
  await upsert(
    "messages",
    d.messages.map((m) => {
      if (!m.ai_parsed_json?.resolved) return m;
      const r = m.ai_parsed_json.resolved;
      return {
        ...m,
        ai_parsed_json: { ...m.ai_parsed_json, resolved: { ...r, tasks: r.tasks.map((x) => ({ ...x, trade_id: tid(x.trade_id) })) } },
      };
    }),
  );
  for (const t of d.tasks.filter((x) => x.created_from_message_id)) {
    await db.from("tasks").update({ created_from_message_id: t.created_from_message_id }).eq("id", t.id);
  }
  await upsert("message_links", d.message_links, "message_id,task_id");
  await upsert("completion_reports", d.completion_reports);
  await upsert("audit_log", d.audit_log);

  console.log("Creating login users (password: %s)…", DEMO_PASSWORD);
  for (const p of d.profiles) {
    if (!p.email) continue;
    const { error } = await db.auth.admin.createUser({
      email: p.email,
      phone: p.phone ?? undefined,
      password: DEMO_PASSWORD,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: p.full_name },
    });
    if (error && !/already/i.test(error.message)) console.warn(`  ${p.email}: ${error.message}`);
  }
  // The on_auth_user_created trigger links users to these profiles by email/phone.
  const { data: linked } = await db.from("profiles").select("id").not("auth_user_id", "is", null);
  console.log(`  linked profiles: ${linked?.length ?? 0}/${d.profiles.length}`);
  console.log("Done. Log in as pm@siteflow.demo / %s", DEMO_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
