/**
 * Move a project that was entered locally (demo mode, .data/demo-db.json)
 * into a real Supabase project — so a site captured on a laptop doesn't have
 * to be typed in again.
 *
 *   npm run push-project -- --project "פיילוט" --pm-email you@company.co.il [--company "שם החברה"] [--dry-run]
 *
 * Everything gets fresh ids (no clash with the demo data), the PM's profile
 * gets the given email (they log in with it and are linked automatically),
 * and contractors keep their phones (they're linked on first phone login).
 * Chat history is not copied. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (.env.local / .env or the environment).
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { Area } from "../src/lib/db/types";
import type { MemoryData } from "../src/lib/db/memory-store";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const projectQuery = arg("project");
const pmEmail = arg("pm-email")?.trim().toLowerCase();
const company = arg("company");
const dryRun = process.argv.includes("--dry-run");
const file = arg("file") ?? ".data/demo-db.json";

if (!projectQuery || !pmEmail) {
  console.error('Usage: npm run push-project -- --project "<name>" --pm-email <email> [--company "<name>"] [--dry-run]');
  process.exit(1);
}
const data = (JSON.parse(readFileSync(file, "utf8")) as { data: MemoryData }).data;
const found = data.projects.find((p) => p.id === projectQuery || p.name.includes(projectQuery));
if (!found) {
  console.error(`No project matching "${projectQuery}". Projects: ${data.projects.map((p) => p.name).join(" | ")}`);
  process.exit(1);
}
const project = found;

const ids = new Map<string, string>();
const id = (old: string | null): string | null => (old ? ids.get(old) ?? ids.set(old, randomUUID()).get(old)! : null);
const pid = project.id;

const members = data.project_members.filter((m) => m.project_id === pid);
const pmMember = members.find((m) => m.role === "pm");
const areas = data.areas.filter((a) => a.project_id === pid);
const tasks = data.tasks.filter((t) => t.project_id === pid);
const deps = data.dependencies.filter((d) => d.project_id === pid);
const blockers = data.external_blockers.filter((b) => b.project_id === pid);
const contractorIds = new Set([
  ...tasks.map((t) => t.contractor_id).filter(Boolean),
  ...data.contractors.filter((c) => c.profile_id && members.some((m) => m.profile_id === c.profile_id)).map((c) => c.id),
]);
const contractors = data.contractors.filter((c) => contractorIds.has(c.id));
const profileIds = new Set([...members.map((m) => m.profile_id), ...contractors.map((c) => c.profile_id).filter(Boolean)]);
const profiles = data.profiles.filter((p) => profileIds.has(p.id));
const flow = data.flow_templates.find((f) => f.organization_id === project.organization_id);
const tradeKeys = new Map(data.trades.map((t) => [t.id, t]));
const usedTrades = new Set([...tasks.map((t) => t.trade_id), ...contractors.map((c) => c.trade_id)].filter(Boolean) as string[]);
const org = data.organizations.find((o) => o.id === project.organization_id)!;

console.log(`Project "${project.name}": ${areas.length} areas, ${tasks.length} tasks, ${deps.length} dependencies, ${contractors.length} contractors, ${profiles.length} people`);
if (dryRun) process.exit(0);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function insert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table.padEnd(20)} ${rows.length}`);
}

function byDepth(list: Area[]): Area[] {
  const byId = new Map(list.map((a) => [a.id, a]));
  const depth = (a: Area): number => (a.parent_id && byId.has(a.parent_id) ? 1 + depth(byId.get(a.parent_id)!) : 0);
  return [...list].sort((a, b) => depth(a) - depth(b));
}

async function main() {
  // trades are global, matched by key (created when missing)
  const { data: cloudTrades, error } = await db.from("trades").select("id,key");
  if (error) throw error;
  const tradeId = new Map<string, string>();
  const missing = [];
  for (const tid of usedTrades) {
    const t = tradeKeys.get(tid)!;
    const hit = cloudTrades!.find((x) => x.key === t.key);
    if (hit) tradeId.set(tid, hit.id);
    else {
      const nid = randomUUID();
      tradeId.set(tid, nid);
      missing.push({ ...t, id: nid });
    }
  }
  if (missing.length) await insert("trades", missing);
  const trade = (x: string | null) => (x ? tradeId.get(x) ?? null : null);

  await insert("organizations", [{ id: id(org.id), name: company ?? org.name }]);
  await insert(
    "profiles",
    profiles.map((p) => ({
      id: id(p.id),
      full_name: p.full_name,
      phone: p.phone,
      email: p.id === pmMember?.profile_id ? pmEmail : p.email?.endsWith("@siteflow.demo") ? null : p.email,
      organization_id: id(org.id),
    })),
  );
  await insert("projects", [{ ...project, id: id(pid), organization_id: id(org.id), setup_mode: true }]);
  // contractors with tasks here must be members, or they can't see their tasks
  const memberProfiles = new Set(members.map((m) => m.profile_id));
  const extra = contractors
    .filter((c) => c.profile_id && !memberProfiles.has(c.profile_id) && memberProfiles.add(c.profile_id))
    .map((c) => ({ project_id: pid, profile_id: c.profile_id!, role: "contractor" as const, created_at: new Date().toISOString() }));
  await insert("project_members", [...members, ...extra].map((m) => ({ ...m, project_id: id(pid), profile_id: id(m.profile_id) })));
  await insert("areas", byDepth(areas).map((a) => ({ ...a, id: id(a.id), project_id: id(pid), parent_id: id(a.parent_id) })));
  await insert("contractors", contractors.map((c) => ({ ...c, id: id(c.id), organization_id: id(org.id), profile_id: id(c.profile_id), trade_id: trade(c.trade_id) })));
  await insert(
    "tasks",
    tasks.map((t) => ({
      ...t,
      id: id(t.id),
      project_id: id(pid),
      area_id: id(t.area_id),
      trade_id: trade(t.trade_id),
      contractor_id: id(t.contractor_id),
      created_by: id(t.created_by),
      created_from_message_id: null,
      plan_pin_id: null,
    })),
  );
  await insert("external_blockers", blockers.map((b) => ({ ...b, id: id(b.id), project_id: id(pid), created_from_message_id: null })));
  await insert(
    "dependencies",
    deps.map((d) => ({ ...d, id: id(d.id), project_id: id(pid), from_task_id: id(d.from_task_id), from_blocker_id: id(d.from_blocker_id), to_task_id: id(d.to_task_id), created_by: id(d.created_by) })),
  );
  if (flow) await insert("flow_templates", [{ ...flow, organization_id: id(org.id), updated_by: id(flow.updated_by) }]);
  console.log(`Done. "${project.name}" is in the cloud in setup mode. Log in with ${pmEmail} to continue.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
