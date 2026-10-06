import type { Area, Contractor, Rule, Task, Trade } from "../db/types";
import { areaLabel } from "../services/snapshot";

/** What the parsers know about the project when reading a message. */
export interface ParseContext {
  areas: Area[];
  trades: Trade[];
  contractors: Contractor[];
  /** open (not done) tasks */
  tasks: Task[];
  rules: Rule[];
  sender: { profileId: string | null; name: string; role: "pm" | "contractor" | "viewer" | null; contractorId: string | null };
  /** other participants of the conversation (for "addressee" in a 1:1 chat) */
  addressees: Array<{ name: string; contractorId: string | null }>;
  now: Date;
}

/** Compact text rendering of the context for the Claude prompt. */
export function renderContext(c: ParseContext): string {
  const areaById = new Map(c.areas.map((a) => [a.id, a]));
  const tradeName = (id: string | null) => c.trades.find((t) => t.id === id)?.name ?? "";
  const contractorName = (id: string | null) => c.contractors.find((x) => x.id === id)?.name ?? "";
  const lines: string[] = [];
  lines.push(`today: ${c.now.toISOString().slice(0, 10)}`);
  lines.push(`sender: ${c.sender.name} (${c.sender.role ?? "unknown"}${c.sender.contractorId ? `, ${tradeName(c.contractors.find((x) => x.id === c.sender.contractorId)?.trade_id ?? null)}` : ""})`);
  if (c.addressees.length) lines.push(`other participants: ${c.addressees.map((a) => a.name).join(", ")}`);
  lines.push("", "## areas");
  lines.push(c.areas.filter((a) => a.type !== "room").map((a) => areaLabel(areaById, a.id)).join(" | "));
  lines.push("", "## trades");
  lines.push(c.trades.map((t) => t.name).join(" | "));
  lines.push("", "## contractors (name — trade — company)");
  for (const x of c.contractors) lines.push(`${x.name} — ${tradeName(x.trade_id)} — ${x.company ?? ""}`);
  lines.push("", "## dependency rules (predecessor trade → successor trade)");
  for (const r of c.rules.filter((r) => r.active)) lines.push(`${r.name}: ${tradeName(r.predecessor_trade_id)} → ${tradeName(r.successor_trade_id)}`);
  lines.push("", "## open tasks (id | title | area | contractor | status)");
  for (const t of c.tasks) lines.push(`${t.id} | ${t.title} | ${areaLabel(areaById, t.area_id)} | ${contractorName(t.contractor_id)} | ${t.status}`);
  return lines.join("\n");
}
