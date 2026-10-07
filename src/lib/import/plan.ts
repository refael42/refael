/**
 * Read a work plan spreadsheet (the kind site managers keep in Excel / Google
 * Sheets): a task table with number, work type, location, task, responsible,
 * status, dates and dependencies, plus an optional contacts table.
 *
 * Pure: takes the sheets as rows (from read-excel-file) and returns a plan the
 * import service can write. Columns are found by their Hebrew header, in any
 * order; sheets without a number column (per-apartment detail views of the
 * same tasks) are skipped so nothing is imported twice.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export interface SheetRows {
  sheet: string;
  data: Cell[][];
}

export type PlanStatus = "planned" | "in_progress" | "awaiting_approval" | "done" | "blocked";

export interface PlanTask {
  /** "<sheet>#<number>" — stable across re-imports */
  ref: string;
  sheet: string;
  number: string;
  workType: string;
  location: string;
  title: string;
  responsible: string;
  status: PlanStatus;
  /** the sheet's own status word when it says more than our status (e.g. "לתיאום") */
  statusLabel: string | null;
  percent: number | null;
  start: string | null;
  end: string | null;
  note: string;
  /** refs of the tasks this one waits for */
  dependsOn: string[];
}

export interface PlanPerson {
  name: string;
  role: string;
  company: string;
  phone: string | null;
  note: string;
}

export interface Plan {
  title: string | null;
  tasks: PlanTask[];
  people: PlanPerson[];
  /** sheets that looked like detail views and were skipped */
  skipped: string[];
  warnings: string[];
}

const HEADERS = {
  number: ["מס", "מס׳", "מס'", "מספר", "#"],
  workType: ["סוג עבודה", "תחום", "סוג", "מקצוע"],
  location: ["מיקום", "אזור"],
  title: ["משימה", "דרישה", "פעילות", "תיאור", "עבודה"],
  responsible: ["בעל מקצוע / אחראי", "בעל מקצוע", "אחראי", "מבצע", "קבלן"],
  status: ["סטטוס", "מצב"],
  percent: ["אחוז ביצוע", "% ביצוע", "ביצוע %"],
  start: ["התחלה", "תאריך התחלה"],
  days: ["משך ימים", "משך"],
  end: ["סיום", "תאריך סיום"],
  deps: ["תלויות", "תלוי ב", "אחרי"],
  note: ["חסם / הערה", "הערה", "הערות", "חסם"],
  approval: ["אישור מנהל", "אישור"],
} as const;

const PEOPLE_HEADERS = {
  name: ["שם"],
  role: ["תחום / תפקיד", "תחום", "תפקיד", "מקצוע"],
  company: ["חברה"],
  phone: ["טלפון", "נייד"],
  note: ["הערות", "הערה", "פעולה / שימוש"],
} as const;

const norm = (v: Cell): string =>
  v == null ? "" : v instanceof Date ? v.toISOString() : String(v).replace(/\s+/g, " ").replace(/[״"]/g, '"').replace(/[׳']/g, "'").trim();

const text = (v: Cell): string => (v == null ? "" : v instanceof Date ? isoDate(v) ?? "" : String(v).replace(/\s+/g, " ").trim());

function findColumns<K extends string>(row: Cell[], spec: Record<K, readonly string[]>): Partial<Record<K, number>> {
  const cells = row.map(norm);
  const out: Partial<Record<K, number>> = {};
  for (const key of Object.keys(spec) as K[]) {
    // exact header first, then "starts with" (e.g. "סטטוס ביצוע")
    const names = spec[key].map((h) => norm(h));
    let idx = cells.findIndex((c) => names.includes(c));
    if (idx < 0) idx = cells.findIndex((c) => c && names.some((h) => c.startsWith(h)));
    if (idx >= 0 && !Object.values(out).includes(idx)) out[key] = idx;
  }
  return out;
}

function isoDate(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Excel serial date
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

const DONE = ["הושלם", "בוצע", "גמור", "סגור", "הסתיים"];
const PROGRESS = ["בביצוע", "בעבודה", "בתהליך"];
const BLOCKED = ["חסום", "תקוע"];
const PLANNED = ["טרם התחיל", "מתוכנן", "פתוח", "חדש", ""];
const APPROVED = ["אושר", "נבדק", "תקין", "מאושר", "נבדק ואושר"];

export function mapStatus(raw: string, approval: string, percent: number | null): { status: PlanStatus; label: string | null } {
  const s = raw.trim();
  const approved = APPROVED.some((a) => approval.trim().startsWith(a));
  if (DONE.some((d) => s.startsWith(d)) || (percent !== null && percent >= 1 && !s)) return { status: approved ? "done" : "awaiting_approval", label: null };
  if (PROGRESS.some((d) => s.startsWith(d))) return { status: "in_progress", label: null };
  if (BLOCKED.some((d) => s.startsWith(d))) return { status: "blocked", label: null };
  if (PLANNED.includes(s)) return { status: "planned", label: null };
  // "לתיאום", "ממתין", "דורש בירור"… — not started; keep the word so nothing is lost
  return { status: "planned", label: s };
}

function parsePercent(v: Cell): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", "").trim());
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function headerRow(data: Cell[][], spec: Record<string, readonly string[]>, required: string[]): number {
  for (let i = 0; i < Math.min(data.length, 25); i++) {
    const cols = findColumns(data[i] ?? [], spec);
    if (required.every((k) => k in cols)) return i;
  }
  return -1;
}

export function parseWorkbook(sheets: SheetRows[]): Plan {
  const plan: Plan = { title: null, tasks: [], people: [], skipped: [], warnings: [] };
  for (const { sheet, data } of sheets) {
    if (!plan.title) {
      const first = data.find((r) => r?.some((c) => text(c)));
      const t = first ? text(first.find((c) => text(c))) : "";
      if (t.length > 4 && t.length < 120) plan.title = t;
    }
    // contacts
    const ph = headerRow(data, PEOPLE_HEADERS, ["name", "phone"]);
    if (ph >= 0) {
      const cols = findColumns(data[ph], PEOPLE_HEADERS);
      for (const row of data.slice(ph + 1)) {
        const name = text(row[cols.name!]);
        if (!name) continue;
        const phone = text(row[cols.phone!]).match(/\+?\d[\d\s-]{7,}\d/)?.[0] ?? null;
        plan.people.push({
          name,
          role: cols.role !== undefined ? text(row[cols.role]) : "",
          company: cols.company !== undefined ? text(row[cols.company]) : "",
          phone,
          note: cols.note !== undefined ? text(row[cols.note]) : "",
        });
      }
      continue;
    }
    // task tables
    const th = headerRow(data, HEADERS, ["title", "location"]);
    if (th < 0) continue;
    const cols = findColumns(data[th], HEADERS);
    if (cols.number === undefined || cols.responsible === undefined) {
      plan.skipped.push(sheet);
      continue;
    }
    const tasks: PlanTask[] = [];
    let auto = 0;
    for (const row of data.slice(th + 1)) {
      const title = text(row[cols.title!]);
      if (!title) continue;
      const number = text(row[cols.number]) || `x${++auto}`;
      const get = (k: keyof typeof HEADERS) => (cols[k] !== undefined ? row[cols[k]!] : null);
      const percent = parsePercent(get("percent"));
      const { status, label } = mapStatus(text(get("status")), text(get("approval")), percent);
      let start = isoDate(get("start"));
      let end = isoDate(get("end"));
      const days = Number(text(get("days")));
      if (start && !end && days > 0) end = new Date(Date.parse(start) + (days - 1) * 86_400_000).toISOString().slice(0, 10);
      if (end && !start) start = end;
      if (start && end && end < start) end = start;
      tasks.push({
        ref: `${sheet}#${number}`,
        sheet,
        number,
        workType: text(get("workType")),
        location: text(get("location")),
        title,
        responsible: text(get("responsible")),
        status,
        statusLabel: label,
        percent,
        start,
        end,
        note: text(get("note")),
        dependsOn: text(get("deps"))
          .split(/[,;\s]+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => `${sheet}#${x}`),
      });
    }
    const refs = new Set(tasks.map((t) => t.ref));
    const seen = new Set<string>();
    for (const t of tasks) {
      if (seen.has(t.ref)) plan.warnings.push(`${sheet}: המספר ${t.number} מופיע פעמיים – נלקחה השורה הראשונה`);
      seen.add(t.ref);
      const missing = t.dependsOn.filter((d) => !refs.has(d));
      if (missing.length) plan.warnings.push(`${sheet} #${t.number}: תלוי במשימה שלא קיימת (${missing.map((m) => m.split("#")[1]).join(", ")})`);
      t.dependsOn = t.dependsOn.filter((d) => refs.has(d) && d !== t.ref);
    }
    const unique = tasks.filter((t, i) => tasks.findIndex((x) => x.ref === t.ref) === i);
    plan.tasks.push(...unique);
  }
  return plan;
}

// ───────────────────────── locations ─────────────────────────

export type PlaceKind = "building" | "apartment" | "floor" | "part";
export interface Place {
  kind: PlaceKind;
  /** area name ("דירה 14", "קומה 6", "גג") */
  name: string;
  /** building part feature for shared parts (roof, lobby…) */
  part?: string;
  garden?: boolean;
}

const PART_RULES: Array<{ re: RegExp; name: string; part: string }> = [
  { re: /מעלי(ת|ות)|פיר/, name: "מעלית", part: "elevator" },
  { re: /מכפיל|חני|חניון/, name: "חניה ומכפילי חניה", part: "parking" },
  { re: /מאגר|משאבות/, name: "מאגר מים ומשאבות", part: "systems" },
  { re: /גג/, name: "גג", part: "roof" },
  { re: /לובי/, name: "לובי", part: "lobby" },
  { re: /חדר(י)? מדרגות|כניס(ה|ות) [אב]|פודסט/, name: "חדרי מדרגות", part: "stairwell" },
  { re: /חיפוי|חזית|מרפסות הבניין|קיר חיצוני/, name: "חזיתות", part: "facade" },
  { re: /פיתוח|חצר|שטחי חוץ|חומה|גינה/, name: "פיתוח וחוץ", part: "site" },
];

const WHOLE = /^(כל|אתר|הפרויקט|עיריי|מערכת ראשית|הזנה ראשית|דירות (רלוונטיות|חדשות|בעלים)|יתר|כלל)/;

/** Where a location string goes in the building. */
export function classifyLocation(raw: string): Place {
  const loc = raw.replace(/\s+/g, " ").trim();
  if (!loc || WHOLE.test(loc)) return { kind: "building", name: "" };
  // a single numbered apartment ("דירה 14 - כניסה", "דירת מרינה (דירה 3)", "קומה 4 - דירה 4, איריס")
  const nums = [...loc.matchAll(/דירה\s*(\d+)/g)].map((m) => m[1]);
  if (nums.length === 1 && !/^דירות/.test(loc)) return { kind: "apartment", name: `דירה ${nums[0]}` };
  if (/דירת (ה)?גן/.test(loc)) return { kind: "apartment", name: "דירת גן", garden: true };
  if (/^דירת /.test(loc)) return { kind: "apartment", name: loc.split(/\s+-\s+|,/)[0].trim() };
  if (/^דירות/.test(loc)) return { kind: "building", name: "" };
  for (const r of PART_RULES) if (r.re.test(loc)) return { kind: "part", name: r.name, part: r.part };
  const floor = loc.match(/^קומ(ה|ת) ?(\d+|קרקע|ראשונה)/);
  if (floor) return { kind: "floor", name: floor[2] === "קרקע" ? "קומת קרקע" : floor[2] === "ראשונה" ? "קומה 1" : `קומה ${floor[2]}` };
  if (/פנטהאוז/.test(loc)) return { kind: "floor", name: "פנטהאוזים" };
  // anything else ("ארונות חשמל", "צנרת פלסטיק"…) is on the building; the task keeps the location text
  return { kind: "building", name: "" };
}

// ───────────────────────── trades ─────────────────────────

/** Work type → trade key (known trades), else a new trade named after the work type. */
const TRADE_RULES: Array<{ re: RegExp; key: string }> = [
  { re: /ממ"?ד|ממ״ד/, key: "mamad" },
  { re: /מכפיל/, key: "parking_lifts" },
  { re: /ספרינקלר|כיבוי|איטום אש|מיגון אש|מילוט|בטיחות אש/, key: "fire" },
  { re: /סולר|אינסטלציה|מאגר|ניקוז/, key: "plumbing" },
  { re: /חשמל/, key: "electrical" },
  { re: /מיזוג|אוורור/, key: "hvac" },
  { re: /אלומיניום/, key: "aluminum" },
  { re: /מסגר/, key: "metalwork" },
  { re: /מעלי/, key: "elevator" },
  { re: /גז/, key: "gas" },
  { re: /תקשורת/, key: "communications" },
  { re: /פיתוח|גינון/, key: "landscaping" },
  { re: /חיפוי/, key: "cladding" },
  { re: /בנייה|בניה|שלד|טיח|צבע/, key: "structure" },
  { re: /ניקיון|מסירה|רישוי|טופס/, key: "general" },
];

export const EXTRA_TRADES: Record<string, { name: string; color: string }> = {
  mamad: { name: 'ממ"ד', color: "#7c3aed" },
  parking_lifts: { name: "מכפילי חניה", color: "#0891b2" },
};

export function tradeKeyFor(workType: string): string | null {
  const w = workType.replace(/[״"]/g, '"');
  return TRADE_RULES.find((r) => r.re.test(w))?.key ?? null;
}

// ───────────────────────── people ─────────────────────────

/** "פועלי עז סמארה + מג׳די" → ["עז סמארה", "מג׳די"] */
export function splitResponsible(raw: string): string[] {
  return raw
    .split(/\s*\+\s*/)
    .map((p) =>
      p
        .replace(/^(פועלי|צוות|לתיאום מול)\s+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Match a responsible name to the contacts table: "מג׳די האינסטלטור" → מג׳די.
 * A bare first name is matched only when nobody else in the plan uses it with
 * a descriptor (so "יוסי" and "יוסי אלומיניום" stay two people).
 */
export function matchPerson(name: string, people: PlanPerson[], allNames: string[]): PlanPerson | null {
  const n = norm(name);
  const exact = people.find((p) => norm(p.name) === n);
  const longer = allNames.some((x) => norm(x) !== n && norm(x).startsWith(`${n} `));
  if (exact && !longer) return exact;
  const prefix = people.filter((p) => n.startsWith(`${norm(p.name)} `));
  if (prefix.length === 1) return prefix[0];
  return null;
}
