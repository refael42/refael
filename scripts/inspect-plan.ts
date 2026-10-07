/**
 * Show what importing a work-plan spreadsheet would do, without changing anything.
 *   npm run inspect-plan -- path/to/plan.xlsx
 */
import readXlsxFile from "read-excel-file/node";
import { classifyLocation, matchPerson, parseWorkbook, splitResponsible, type SheetRows } from "../src/lib/import/plan";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run inspect-plan -- <file.xlsx>");
    process.exit(1);
  }
  const plan = parseWorkbook((await readXlsxFile(file)) as SheetRows[]);
  console.log(`"${plan.title}": ${plan.tasks.length} tasks, ${plan.people.length} contacts; skipped sheets: ${plan.skipped.join(", ") || "—"}`);
  const byStatus: Record<string, number> = {};
  for (const t of plan.tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  console.log("statuses:", byStatus, "· dependencies:", plan.tasks.reduce((n, t) => n + t.dependsOn.length, 0));
  const places = new Map<string, number>();
  for (const t of plan.tasks) {
    const p = classifyLocation(t.location);
    const k = p.kind === "building" ? "(building)" : `${p.kind}: ${p.name}`;
    places.set(k, (places.get(k) ?? 0) + 1);
  }
  console.log("\nplaces:\n" + [...places.entries()].sort().map(([k, v]) => `  ${k} — ${v}`).join("\n"));
  const names = [...new Set(plan.tasks.flatMap((t) => splitResponsible(t.responsible)))];
  console.log("\nresponsible → contact:\n" + names.map((n) => `  ${n} → ${matchPerson(n, plan.people, names)?.name ?? "—"}`).join("\n"));
  if (plan.warnings.length) console.log("\nwarnings:\n  " + plan.warnings.join("\n  "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
