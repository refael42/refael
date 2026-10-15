/**
 * The project's work plan as an Excel file, in the same layout the importer
 * reads: one row per task (number, work type, location, task, responsible,
 * status, dates, dependencies, notes, manager's approval) and a contacts
 * sheet. A hidden "מזהה" column carries each task's id, so the file can be
 * edited and imported back — even re-sorted — without duplicating tasks.
 */
import type { Task, TaskStatus } from "../db/types";
import type { XCell, XSheet } from "../export/xlsx";
import { localDate, t } from "../i18n";
import type { ProjectSnapshot } from "./snapshot";
import { taskCard } from "./views";

const MAIN_SHEET = "תוכנית עבודה";

const STATUS: Record<TaskStatus, string> = {
  planned: "טרם התחיל",
  ready: "טרם התחיל",
  in_progress: "בביצוע",
  blocked_manual: "חסום",
  awaiting_approval: "הושלם",
  done: "הושלם",
};
const APPROVAL: Partial<Record<TaskStatus, string>> = { awaiting_approval: "לא נבדק", done: "אושר" };

export const EXPORT_HEADERS = [
  "מס",
  "סוג עבודה",
  "מיקום",
  "משימה",
  "בעל מקצוע / אחראי",
  "סטטוס",
  "התחלה",
  "סיום",
  "תלויות",
  "חסם / הערה",
  "אישור מנהל",
  "SiteFlow – מצב בפועל",
  "מזהה",
];

const day = (iso: string | null): XCell => (iso ? { date: iso.slice(0, 10) } : null);

/** sheet + number of a task: the ones it came with, or the next free number on the main sheet. */
function placeTasks(tasks: Task[]): Map<string, { sheet: string; number: string }> {
  const place = new Map<string, { sheet: string; number: string }>();
  const count = new Map<string, number>();
  for (const task of tasks) {
    const m = task.external_ref?.match(/^(.*)#([^#]+)$/);
    if (m) {
      place.set(task.id, { sheet: m[1], number: m[2] });
      count.set(m[1], (count.get(m[1]) ?? 0) + 1);
    }
  }
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? MAIN_SHEET;
  let next = Math.max(0, ...[...place.values()].filter((p) => p.sheet === main).map((p) => Number(p.number)).filter(Number.isFinite));
  for (const task of tasks) if (!place.has(task.id)) place.set(task.id, { sheet: main, number: String(++next) });
  return place;
}

export function buildPlanExport(s: ProjectSnapshot): { fileName: string; sheets: XSheet[] } {
  const tasks = [...s.tasks].sort(
    (a, b) => (a.planned_start ?? "9999").localeCompare(b.planned_start ?? "9999") || a.created_at.localeCompare(b.created_at),
  );
  const place = placeTasks(tasks);
  const sheetsOrder = [...new Set(tasks.map((x) => place.get(x.id)!.sheet))];
  const today = localDate(s.now);

  const sheets: XSheet[] = sheetsOrder.map((sheet) => {
    const mine = tasks.filter((x) => place.get(x.id)!.sheet === sheet).sort((a, b) => num(place.get(a.id)!.number) - num(place.get(b.id)!.number));
    const rows: XCell[][] = [[`${s.project.name} – ${sheet}`], [`${t.exportPlan.exported} ${today.split("-").reverse().join(".")}`], EXPORT_HEADERS];
    for (const task of mine) {
      const p = place.get(task.id)!;
      const card = taskCard(s, task.id);
      const deps = s.dependencies
        .filter((d) => d.to_task_id === task.id && d.from_task_id && place.get(d.from_task_id)?.sheet === sheet)
        .map((d) => place.get(d.from_task_id!)!.number);
      const contractor = task.contractor_id ? s.contractorById.get(task.contractor_id) : undefined;
      const area = task.area_id ? s.areaById.get(task.area_id) : undefined;
      rows.push([
        num(p.number) || p.number,
        task.trade_id ? s.tradeById.get(task.trade_id)?.name ?? "" : "",
        area?.name ?? "",
        task.title,
        contractor?.name ?? "",
        STATUS[task.status],
        day(task.planned_start),
        day(task.planned_end),
        deps.join(", "),
        task.blocked_reason ?? "",
        APPROVAL[task.status] ?? "",
        `${t.effective[card.state]}${card.reason ? ` – ${card.reason}` : ""}${card.overdue ? ` · ${t.tasks.overdue}` : ""}`,
        task.id,
      ]);
    }
    return { name: sheet, rows, headerRow: 2, widths: [6, 14, 16, 42, 20, 12, 12, 12, 10, 28, 12, 36, 38], hidden: [12] };
  });

  const people = s.contractors
    .filter((c) => s.tasks.some((x) => x.contractor_id === c.id))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  sheets.push({
    name: "בעלי מקצוע ושירותים",
    headerRow: 0,
    rows: [["שם", "תחום / תפקיד", "חברה", "טלפון"], ...people.map((c) => [c.name, c.trade_id ? s.tradeById.get(c.trade_id)?.name ?? "" : "", c.company ?? "", c.phone ?? ""])],
    widths: [22, 18, 18, 16],
  });

  const safe = s.project.name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "project";
  return { fileName: `${safe} – ${today}.xlsx`, sheets };
}

function num(x: string): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
