/**
 * Deterministic demo project: "מגדלי הגליל – בניין A".
 * 1 building · 4 floors · 20 apartments · ~130 tasks · realistic dependencies,
 * contractors, external blockers and chat history that produces AI suggestions.
 *
 * All timestamps are relative to `now`, so the project looks alive whenever it
 * is seeded. IDs are derived from stable keys (sid), so reseeding is idempotent.
 */
import { createHash } from "node:crypto";
import { emptyData, type MemoryData } from "../db/memory-store";
import type {
  AiParsedJson,
  Area,
  Contractor,
  Dependency,
  Message,
  Task,
  TaskStatus,
} from "../db/types";
import { normCentre, PLAN_APARTMENTS, PLAN_BALCONIES } from "./plan-layout";

/** Stable UUID from a key (sha1 → RFC-4122-shaped, version nibble 5). */
export function sid(key: string): string {
  const h = createHash("sha1").update(`siteflow:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const DEMO_IDS = {
  org: sid("org"),
  project: sid("project"),
  pm: sid("profile:pm"),
  viewer: sid("profile:viewer"),
};

export const DEMO_PASSWORD = "siteflow-demo";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const TRADES = [
  { key: "structure", name: "שלד", color: "#78716c" },
  { key: "electrical", name: "חשמל", color: "#eab308" },
  { key: "plumbing", name: "אינסטלציה", color: "#0ea5e9" },
  { key: "hvac", name: "מיזוג אוויר", color: "#06b6d4" },
  { key: "drywall", name: "גבס", color: "#a3a3a3" },
  { key: "plaster", name: "טיח", color: "#d6a77a" },
  { key: "paint", name: "צבע", color: "#ec4899" },
  { key: "waterproofing", name: "איטום", color: "#6366f1" },
  { key: "tiling", name: "ריצוף וחיפוי", color: "#f97316" },
  { key: "aluminum", name: "אלומיניום", color: "#94a3b8" },
  { key: "metalwork", name: "מסגרות", color: "#475569" },
  { key: "cladding", name: "חיפוי חוץ", color: "#a16207" },
  { key: "fire", name: "בטיחות אש", color: "#dc2626" },
  { key: "landscaping", name: "פיתוח וגינון", color: "#16a34a" },
] as const;
export type TradeKey = (typeof TRADES)[number]["key"];

const CONTRACTORS: Array<{ key: string; name: string; company: string; trade: TradeKey; phone: string }> = [
  { key: "ahmad", name: "אחמד", company: "אחמד עבודות שלד בע״מ", trade: "structure", phone: "+972501110001" },
  { key: "shor", name: "שור", company: "שור מסגרות", trade: "metalwork", phone: "+972501110002" },
  { key: "vadim", name: "ואדים", company: "ואדים חיפויים", trade: "cladding", phone: "+972501110003" },
  { key: "paz", name: "פז", company: "פז מיזוג אוויר", trade: "hvac", phone: "+972501110004" },
  { key: "yossi", name: "יוסי", company: "י.ל. חשמל", trade: "electrical", phone: "+972501110005" },
  { key: "moti", name: "מוטי", company: "מוטי אינסטלציה", trade: "plumbing", phone: "+972501110006" },
  { key: "nikolai", name: "ניקולאי", company: "ניקולאי גבס ותקרות", trade: "drywall", phone: "+972501110007" },
  { key: "samer", name: "סאמר", company: "סאמר טיח", trade: "plaster", phone: "+972501110008" },
  { key: "avi", name: "אבי", company: "אבי צבע וגמרים", trade: "paint", phone: "+972501110009" },
  { key: "dani", name: "דני", company: "איטום הנגב", trade: "waterproofing", phone: "+972501110010" },
  { key: "ron", name: "רון", company: "רון ריצוף", trade: "tiling", phone: "+972501110011" },
  { key: "eli", name: "אלי", company: "אלומיניום הצפון", trade: "aluminum", phone: "+972501110012" },
  { key: "lior", name: "ליאור", company: "ל.ב. מערכות כיבוי אש", trade: "fire", phone: "+972501110013" },
  { key: "gil", name: "גיל", company: "גיל פיתוח נוף", trade: "landscaping", phone: "+972501110014" },
];

/** Login identities for the demo personas (also used by the Supabase seeder). */
export const DEMO_PEOPLE = {
  pm: { name: "רפאל כהן", email: "pm@siteflow.demo", phone: "+972500000001" },
  viewer: { name: "מיכל לוי – נציגת היזם", email: "owner@siteflow.demo", phone: "+972500000002" },
};

export function contractorProfileId(key: string) {
  return sid(`profile:${key}`);
}
export function contractorId(key: string) {
  return sid(`contractor:${key}`);
}

export function buildDemoData(now: Date = new Date()): MemoryData {
  const db = emptyData();
  const t0 = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const ago = (hours: number) => iso(t0 - hours * HOUR);
  const inH = (hours: number) => iso(t0 + hours * HOUR);
  const day = (offset: number) => new Date(t0 + offset * DAY).toISOString().slice(0, 10);
  const created = ago(24 * 130);

  // ── organization, people, project ───────────────────────────
  db.organizations.push({ id: DEMO_IDS.org, name: "רפאל הנדסה ובנייה", created_at: created });
  db.projects.push({
    id: DEMO_IDS.project,
    organization_id: DEMO_IDS.org,
    name: "מגדלי הגליל – בניין A",
    address: "רח׳ הזית 12, כרמיאל",
    start_date: day(-120),
    target_date: day(150),
    setup_mode: false,
    created_at: created,
  });

  const person = (id: string, name: string, email: string | null, phone: string | null) =>
    db.profiles.push({
      id,
      auth_user_id: null,
      organization_id: DEMO_IDS.org,
      full_name: name,
      phone,
      email,
      created_at: created,
    });
  person(DEMO_IDS.pm, DEMO_PEOPLE.pm.name, DEMO_PEOPLE.pm.email, DEMO_PEOPLE.pm.phone);
  person(DEMO_IDS.viewer, DEMO_PEOPLE.viewer.name, DEMO_PEOPLE.viewer.email, DEMO_PEOPLE.viewer.phone);
  db.project_members.push(
    { project_id: DEMO_IDS.project, profile_id: DEMO_IDS.pm, role: "pm", created_at: created },
    { project_id: DEMO_IDS.project, profile_id: DEMO_IDS.viewer, role: "viewer", created_at: created },
  );

  // ── trades & contractors ─────────────────────────────────────
  const tradeId = (k: TradeKey) => sid(`trade:${k}`);
  TRADES.forEach((t, i) => db.trades.push({ id: tradeId(t.key), key: t.key, name: t.name, color: t.color, sort_order: i }));

  for (const c of CONTRACTORS) {
    person(contractorProfileId(c.key), c.name, `${c.key}@siteflow.demo`, c.phone);
    db.contractors.push({
      id: contractorId(c.key),
      organization_id: DEMO_IDS.org,
      profile_id: contractorProfileId(c.key),
      name: c.name,
      phone: c.phone,
      trade_id: tradeId(c.trade),
      company: c.company,
      created_at: created,
    } satisfies Contractor);
    db.project_members.push({
      project_id: DEMO_IDS.project,
      profile_id: contractorProfileId(c.key),
      role: "contractor",
      created_at: created,
    });
  }
  const cid = contractorId;

  // ── areas ────────────────────────────────────────────────────
  const area = (key: string, parent: string | null, type: Area["type"], name: string, sort: number) => {
    db.areas.push({
      id: sid(`area:${key}`),
      project_id: DEMO_IDS.project,
      parent_id: parent ? sid(`area:${parent}`) : null,
      type,
      name,
      sort_order: sort,
      created_at: created,
    });
    return sid(`area:${key}`);
  };
  const A = (key: string) => sid(`area:${key}`);
  area("building", null, "building", "בניין A", 0);
  for (let f = 1; f <= 4; f++) {
    area(`floor${f}`, "building", "floor", `קומה ${f}`, f);
    for (let k = 1; k <= 5; k++) {
      const n = (f - 1) * 5 + k;
      area(`apt${n}`, `floor${f}`, "apartment", `דירה ${n}`, n);
    }
  }
  ["סלון", "מטבח", "חדר רחצה", "מרפסת"].forEach((r, i) => area(`apt17:room${i}`, "apt17", "room", r, i));
  ["סלון", "חדר רחצה"].forEach((r, i) => area(`apt9:room${i}`, "apt9", "room", r, i));
  area("roof", "building", "common", "גג", 10);
  area("stairs", "building", "common", "חדר מדרגות", 11);
  area("balconies", "building", "common", "מרפסות – חזית", 12);
  area("lobby", "building", "common", "לובי כניסה", 13);
  area("site", "building", "common", "פיתוח שטח", 14);

  // ── external blockers ────────────────────────────────────────
  const fireId = sid("blocker:fire");
  const elecCoId = sid("blocker:electric-co");
  db.external_blockers.push(
    {
      id: fireId,
      project_id: DEMO_IDS.project,
      title: "אישור יועץ בטיחות אש",
      owner_name: "אינג׳ רוני לוי – יועץ בטיחות",
      owner_phone: "+972541234567",
      status: "open",
      notes: "ממתינים לאישור תוכניות גילוי וכיבוי לפני ביצוע בחדר המדרגות",
      expected_date: day(5),
      resolved_at: null,
      created_from_message_id: null,
      created_at: ago(24 * 9),
    },
    {
      id: elecCoId,
      project_id: DEMO_IDS.project,
      title: "אישור חיבור – חברת החשמל",
      owner_name: "חברת החשמל – מוקד קבלנים",
      owner_phone: null,
      status: "open",
      notes: "בקשה הוגשה, ממתינים לתיאום טכנאי",
      expected_date: day(12),
      resolved_at: null,
      created_from_message_id: null,
      created_at: ago(24 * 20),
    },
    {
      id: sid("blocker:municipal"),
      project_id: DEMO_IDS.project,
      title: "פיקוח עירוני – אישור שלד",
      owner_name: "עיריית כרמיאל",
      owner_phone: null,
      status: "resolved",
      notes: null,
      expected_date: null,
      resolved_at: ago(24 * 22),
      created_from_message_id: null,
      created_at: ago(24 * 40),
    },
  );

  // ── tasks ────────────────────────────────────────────────────
  type Spec = {
    title: string;
    area: string;
    trade: TradeKey;
    contractor: string;
    status: TaskStatus;
    /** planned window, day offsets from today */
    ps?: number;
    pe?: number;
    /** completed N hours ago (done / awaiting tasks) */
    doneH?: number;
    startedH?: number;
    checkInH?: number;
    reason?: string;
    critical?: boolean;
    description?: string;
  };
  const T = (key: string) => sid(`task:${key}`);
  const addTask = (key: string, s: Spec) => {
    const done = s.status === "done";
    // realistic history: most finished work landed by its planned end, about a quarter ran late
    let plannedEnd = s.pe !== undefined ? day(s.pe) : null;
    if (done && plannedEnd) {
      const doneDay = ago(s.doneH ?? 24).slice(0, 10);
      const late = [...key].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 4 === 0;
      if (doneDay > plannedEnd && !late) plannedEnd = doneDay;
    }
    const startedH = s.startedH ?? (s.status === "in_progress" || s.status === "awaiting_approval" || done ? (s.doneH ?? 0) + 72 : undefined);
    db.tasks.push({
      id: T(key),
      project_id: DEMO_IDS.project,
      area_id: A(s.area),
      trade_id: tradeId(s.trade),
      contractor_id: cid(s.contractor),
      title: s.title,
      description: s.description ?? null,
      status: s.status,
      is_critical: s.critical ?? false,
      planned_start: s.ps !== undefined ? day(s.ps) : null,
      planned_end: plannedEnd,
      check_at: s.checkInH !== undefined ? inH(s.checkInH) : null,
      started_at: startedH !== undefined ? ago(startedH) : null,
      completed_at: done ? ago(s.doneH ?? 24) : null,
      blocked_reason: s.reason ?? null,
      created_from_message_id: null,
      plan_pin_id: null,
      flow_stage: null,
      created_by: DEMO_IDS.pm,
      created_at: ago(24 * 100),
      updated_at: done ? ago(s.doneH ?? 24) : ago(12),
    } satisfies Task);
  };

  const deps: Dependency[] = [];
  const dep = (from: string, to: string, lag = 0, source: Dependency["source"] = "template") =>
    deps.push({
      id: sid(`dep:${from}->${to}`),
      project_id: DEMO_IDS.project,
      from_task_id: T(from),
      from_blocker_id: null,
      to_task_id: T(to),
      type: lag > 0 ? "finish_plus_lag" : "finish_to_start",
      lag_hours: lag,
      source,
      created_by: DEMO_IDS.pm,
      created_at: ago(24 * 90),
    });
  const blockerDep = (blockerId: string, to: string) =>
    deps.push({
      id: sid(`dep:${blockerId}->${to}`),
      project_id: DEMO_IDS.project,
      from_task_id: null,
      from_blocker_id: blockerId,
      to_task_id: T(to),
      type: "finish_to_start",
      lag_hours: 0,
      source: "manual",
      created_by: DEMO_IDS.pm,
      created_at: ago(24 * 9),
    });

  // Building-level structure
  addTask("ST1", { title: "יציקת תקרת גג", area: "roof", trade: "structure", contractor: "ahmad", status: "done", ps: -32, pe: -26, doneH: 24 * 25 });
  addTask("ST4", {
    title: "בניית מחיצות בלוקים – קומה 4",
    area: "floor4",
    trade: "structure",
    contractor: "ahmad",
    status: "in_progress",
    ps: -10,
    pe: 2,
    startedH: 24 * 10,
    checkInH: -3,
    critical: true,
  });

  // Per floor
  const floorStatus: Record<number, Partial<Record<"H" | "W" | "T", Spec["status"]>>> = {
    1: { H: "done", W: "done", T: "in_progress" },
    2: { H: "done", W: "done", T: "planned" },
    3: { H: "in_progress", W: "in_progress", T: "planned" },
    4: { H: "planned", W: "planned", T: "planned" },
  };
  for (let f = 1; f <= 4; f++) {
    const fs = floorStatus[f];
    const base = (f - 1) * 12 - 60; // floors progress ~12 days apart
    addTask(`H${f}`, {
      title: `צנרת מיזוג VRF – קומה ${f}`,
      area: `floor${f}`,
      trade: "hvac",
      contractor: "paz",
      status: fs.H!,
      ps: f === 3 ? -8 : f === 4 ? 4 : base + 4,
      pe: f === 3 ? -2 : f === 4 ? 9 : base + 9,
      doneH: fs.H === "done" ? 24 * (40 - f * 6) : undefined,
      startedH: f === 3 ? 24 * 8 : undefined,
      checkInH: f === 3 ? -24 : undefined,
    });
    addTask(`W${f}`, {
      title: `איטום חדרים רטובים – קומה ${f}`,
      area: `floor${f}`,
      trade: "waterproofing",
      contractor: "dani",
      status: fs.W!,
      ps: f === 3 ? -2 : f === 4 ? 4 : base + 14,
      pe: f === 3 ? 2 : f === 4 ? 7 : base + 17,
      doneH: fs.W === "done" ? 24 * (30 - f * 6) : undefined,
    });
    addTask(`T${f}`, {
      title: `ריצוף וחיפוי חדרים רטובים – קומה ${f}`,
      area: `floor${f}`,
      trade: "tiling",
      contractor: "ron",
      status: fs.T!,
      ps: f === 1 ? -3 : f === 2 ? 0 : 8 + f * 3,
      pe: f === 1 ? 3 : f === 2 ? 6 : 14 + f * 3,
    });
    dep(`W${f}`, `T${f}`);
    addTask(`FD${f}`, {
      title: `מערכת גילוי אש בחדר מדרגות – קומה ${f}`,
      area: "stairs",
      trade: "fire",
      contractor: "lior",
      status: "planned",
      ps: 3 + f,
      pe: 5 + f,
    });
    blockerDep(fireId, `FD${f}`);
  }
  dep("ST4", "H4");
  dep("ST4", "W4");

  // Per apartment: infra → drywall → plaster → (dry 72h) → paint
  type AptPlan = { E: Spec["status"]; P: Spec["status"]; D: Spec["status"]; PL: Spec["status"]; PA: Spec["status"] };
  const plan: Record<number, AptPlan & { pReason?: string; doneH?: Partial<Record<keyof AptPlan, number>> }> = {};
  for (let n = 1; n <= 5; n++)
    plan[n] = {
      E: "done",
      P: "done",
      D: "done",
      PL: n <= 4 ? "done" : "in_progress",
      PA: n === 1 ? "in_progress" : n === 2 ? "ready" : "planned",
      doneH: { PL: n === 4 ? 20 : 24 * 6 },
    };
  for (let n = 6; n <= 10; n++)
    plan[n] = {
      E: "done",
      P: "done",
      D: n <= 7 ? "done" : n === 8 ? "in_progress" : n === 9 ? "awaiting_approval" : "ready",
      PL: n === 6 ? "in_progress" : "planned",
      PA: "planned",
      doneH: { D: n === 6 ? 24 * 12 : 24 * 10 },
    };
  for (let n = 11; n <= 15; n++)
    plan[n] = {
      E: n <= 13 ? "done" : n === 14 ? "in_progress" : "planned",
      P: n <= 12 ? "done" : n === 13 ? "in_progress" : n === 14 ? "planned" : "blocked_manual",
      D: "planned",
      PL: "planned",
      PA: "planned",
      pReason: n === 15 ? "חסרים צינורות מולטילייר – ממתין לספק" : undefined,
      doneH: { E: 24 * (27 - n), P: 24 * (25 - n) },
    };
  for (let n = 16; n <= 20; n++) plan[n] = { E: "planned", P: "planned", D: "planned", PL: "planned", PA: "planned" };

  for (let n = 1; n <= 20; n++) {
    const f = Math.ceil(n / 5);
    const p = plan[n];
    const off = (f - 1) * 12 - 60 + (n % 5);
    const win = (s: Spec["status"], start: number, len: number, overdueShift = 0) => {
      if (s === "done") return { ps: start, pe: start + len };
      if (s === "in_progress" || s === "awaiting_approval") return { ps: -3 + overdueShift, pe: 1 + overdueShift };
      if (s === "ready") return { ps: 0, pe: len };
      return { ps: Math.max(start, 1), pe: Math.max(start, 1) + len };
    };
    const fut = f >= 3 ? (f - 2) * 10 + (n % 5) : 2 + (n % 5);
    addTask(`E${n}`, {
      title: `תשתיות חשמל – דירה ${n}`,
      area: `apt${n}`,
      trade: "electrical",
      contractor: "yossi",
      status: p.E,
      ...win(p.E, f === 4 ? 4 + (n % 5) : off, 4, n === 14 ? -2 : 0),
      doneH: p.doneH?.E ?? 24 * (60 - f * 8),
    });
    addTask(`P${n}`, {
      title: `תשתיות אינסטלציה ובדיקת לחץ – דירה ${n}`,
      area: `apt${n}`,
      trade: "plumbing",
      contractor: "moti",
      status: p.P,
      ...win(p.P, f === 4 ? 4 + (n % 5) : off + 1, 4),
      doneH: p.doneH?.P ?? 24 * (58 - f * 8),
      reason: p.pReason,
    });
    addTask(`D${n}`, {
      title: `סגירת קירות ותקרות גבס – דירה ${n}`,
      area: `apt${n}`,
      trade: "drywall",
      contractor: "nikolai",
      status: p.D,
      ...win(p.D, f <= 2 ? off + 8 : fut + 3, 5),
      doneH: p.doneH?.D ?? 24 * (45 - f * 6),
      checkInH: n === 8 ? 24 : undefined,
    });
    addTask(`PL${n}`, {
      title: `טיח פנים – דירה ${n}`,
      area: `apt${n}`,
      trade: "plaster",
      contractor: "samer",
      status: p.PL,
      ...win(p.PL, f <= 1 ? off + 16 : fut + 9, 4),
      doneH: p.doneH?.PL ?? 24 * 8,
    });
    addTask(`PA${n}`, {
      title: `צבע – דירה ${n}`,
      area: `apt${n}`,
      trade: "paint",
      contractor: "avi",
      status: p.PA,
      ...win(p.PA, f <= 1 ? 1 + (n % 5) : fut + 16, 3),
    });
    dep(`E${n}`, `D${n}`);
    dep(`P${n}`, `D${n}`);
    dep(`H${f}`, `D${n}`);
    dep(`D${n}`, `PL${n}`);
    dep(`PL${n}`, `PA${n}`, 72);
    if (f === 4) {
      dep("ST4", `E${n}`);
      dep("ST4", `P${n}`);
    }
  }

  // Roof waterproofing — overdue, holds the top-floor plaster
  addTask("RW", {
    title: "איטום גג",
    area: "roof",
    trade: "waterproofing",
    contractor: "dani",
    status: "in_progress",
    ps: -7,
    pe: -2,
    startedH: 24 * 7,
  });
  dep("ST1", "RW");
  for (const n of [17, 18, 19, 20]) dep("RW", `PL${n}`);

  // Facade & balconies: waterproofing → railings → scaffolding → landscaping
  addTask("BW", { title: "איטום מרפסות חזית", area: "balconies", trade: "waterproofing", contractor: "dani", status: "planned", ps: 1, pe: 3 });
  addTask("RL", { title: "התקנת מעקות מרפסות", area: "balconies", trade: "metalwork", contractor: "shor", status: "planned", ps: 8, pe: 12 });
  addTask("SCAF", { title: "פירוק פיגומים חזית", area: "building", trade: "structure", contractor: "ahmad", status: "planned", ps: 13, pe: 15 });
  addTask("LAND", { title: "פיתוח שטח וגינון", area: "site", trade: "landscaping", contractor: "gil", status: "planned", ps: 16, pe: 30 });
  addTask("VC1", { title: "חיפוי אבן – לובי כניסה", area: "lobby", trade: "cladding", contractor: "vadim", status: "in_progress", ps: -4, pe: 3, startedH: 24 * 4 });
  dep("ST1", "BW");
  dep("BW", "RL");
  dep("RL", "SCAF");
  dep("RW", "SCAF");
  dep("SCAF", "LAND");

  // Aluminium
  addTask("AL12", { title: "התקנת חלונות אלומיניום – קומות 1-2", area: "building", trade: "aluminum", contractor: "eli", status: "done", ps: -40, pe: -33, doneH: 24 * 33 });
  addTask("AL34", { title: "התקנת חלונות אלומיניום – קומות 3-4", area: "building", trade: "aluminum", contractor: "eli", status: "ready", ps: 0, pe: 7 });
  dep("ST1", "AL34");

  // Fire-consultant-dependent work (7 tasks with the 4 detection systems above)
  addTask("FDOOR", { title: "התקנת דלתות אש – חדר מדרגות", area: "stairs", trade: "metalwork", contractor: "shor", status: "planned", ps: 6, pe: 9 });
  addTask("SPR", { title: "בדיקת מערכת ספרינקלרים", area: "building", trade: "fire", contractor: "lior", status: "planned", ps: 9, pe: 10 });
  addTask("SHAFT", { title: "סגירת פירים בגבס אש – קומות 1-4", area: "stairs", trade: "drywall", contractor: "nikolai", status: "planned", ps: 7, pe: 11 });
  for (const k of ["FDOOR", "SPR", "SHAFT"]) blockerDep(fireId, k);

  // Electric company connection → HVAC commissioning
  addTask("MB", { title: "חיבור לוח חשמל ראשי לרשת", area: "building", trade: "electrical", contractor: "yossi", status: "planned", ps: 12, pe: 13 });
  addTask("HC", { title: "הרצת מערכת מיזוג – כל הבניין", area: "building", trade: "hvac", contractor: "paz", status: "planned", ps: 30, pe: 32 });
  blockerDep(elecCoId, "MB");
  dep("MB", "HC");
  for (let f = 1; f <= 4; f++) dep(`H${f}`, "HC");

  db.dependencies.push(...deps);

  // ── rules / templates (built-in) ─────────────────────────────
  const rule = (
    key: string,
    name: string,
    pred: TradeKey,
    succ: TradeKey,
    opts: { lag?: number; pk?: string; sk?: string; scope?: "same_area" | "same_room" } = {},
  ) =>
    db.rules.push({
      id: sid(`rule:${key}`),
      organization_id: null,
      name,
      predecessor_trade_id: tradeId(pred),
      successor_trade_id: tradeId(succ),
      predecessor_keyword: opts.pk ?? null,
      successor_keyword: opts.sk ?? null,
      scope: opts.scope ?? "same_area",
      lag_hours: opts.lag ?? 0,
      active: true,
      source: "system",
      created_at: created,
    });
  rule("wp-tile", "איטום לפני ריצוף", "waterproofing", "tiling");
  rule("pressure-drywall", "בדיקת לחץ לפני סגירת קירות", "plumbing", "drywall", { pk: "בדיקת לחץ" });
  rule("elec-drywall", "תשתיות חשמל לפני גבס", "electrical", "drywall", { pk: "תשתיות" });
  rule("hvac-drywall", "צנרת מיזוג לפני גבס", "hvac", "drywall", { pk: "צנרת" });
  rule("mark-cladding", "סימון מסגר לפני קידוח בחיפוי", "metalwork", "cladding", { pk: "סימון" });
  rule("cladding-rails", "חיפוי לפני התקנת מעקות", "cladding", "metalwork", { sk: "מעקות" });
  rule("drywall-plaster", "גבס לפני טיח", "drywall", "plaster");
  rule("plaster-paint", "ייבוש טיח לפני צבע (72 שעות)", "plaster", "paint", { lag: 72 });
  rule("struct-elec", "שלד לפני תשתיות חשמל", "structure", "electrical", { sk: "תשתיות" });
  rule("struct-plumb", "שלד לפני תשתיות אינסטלציה", "structure", "plumbing", { sk: "תשתיות" });

  // ── conversations & messages ─────────────────────────────────
  const convDirect = (key: string) => sid(`conv:direct:${key}`);
  const groupId = sid("conv:group");
  const addConv = (id: string, type: "direct" | "group", title: string | null, members: string[]) => {
    db.conversations.push({ id, project_id: DEMO_IDS.project, type, title, created_at: created, last_message_at: null });
    for (const m of members)
      db.conversation_participants.push({ conversation_id: id, profile_id: m, last_read_at: now.toISOString(), created_at: created });
  };
  addConv(
    groupId,
    "group",
    "בניין A – צוות ביצוע",
    [DEMO_IDS.pm, ...["ahmad", "shor", "vadim", "paz", "yossi", "moti", "nikolai", "samer", "dani"].map(contractorProfileId)],
  );
  for (const c of CONTRACTORS) addConv(convDirect(c.key), "direct", null, [DEMO_IDS.pm, contractorProfileId(c.key)]);
  addConv(convDirect("viewer"), "direct", null, [DEMO_IDS.pm, DEMO_IDS.viewer]);

  const msgs: Message[] = [];
  const msg = (
    key: string,
    conv: string,
    sender: string | null,
    hoursAgo: number,
    text: string,
    extra: Partial<Message> = {},
  ) => {
    const m: Message = {
      id: sid(`msg:${key}`),
      conversation_id: conv,
      project_id: DEMO_IDS.project,
      sender_profile_id: sender,
      kind: sender ? "text" : "system",
      text,
      media_url: null,
      reply_to_id: null,
      ai_parsed_json: { ...NONE },
      ai_status: "none",
      ai_reviewed_by: null,
      ai_reviewed_at: null,
      meta: null,
      created_at: ago(hoursAgo),
      ...extra,
    };
    msgs.push(m);
    return m.id;
  };
  const NONE: AiParsedJson = {
    intent: "none",
    tasks: [],
    affects: [],
    completes_task_id: null,
    blocker_text: null,
    confidence: 0.9,
    engine: "heuristic",
  };
  const P = (key: string) => contractorProfileId(key);

  // PM ↔ Ahmad (structure)
  msg("ahmad-1", convDirect("ahmad"), DEMO_IDS.pm, 24 * 6, "אחמד, מתי מסיימים את מחיצות הבלוקים בקומה 4?");
  msg("ahmad-2", convDirect("ahmad"), P("ahmad"), 24 * 6 - 1, "עד סוף השבוע הבא, חסרים לי 2 פועלים");
  msg("ahmad-3", convDirect("ahmad"), DEMO_IDS.pm, 24 * 2, "אחמד, תבדוק בבקשה את הסדק בתקרה של דירה 12 ותעדכן אותי");
  msg("ahmad-4", convDirect("ahmad"), DEMO_IDS.pm, 26, "ואל תשכח לשלוח לי את תעודות הבטון של תקרת הגג");
  msg("ahmad-5", convDirect("ahmad"), P("ahmad"), 25, "בסדר, אשלח מחר");
  msg(
    "ahmad-beam",
    convDirect("ahmad"),
    P("ahmad"),
    3,
    "צריך לצקת קורת בטון מעל המשקוף בדירה 17, מתחילים היום. ייבוש יומיים ואז אפשר לטייח",
    {
      ai_status: "suggested",
      ai_parsed_json: {
        intent: "new_task",
        tasks: [
          {
            title: "יציקת קורת בטון מעל משקוף – דירה 17",
            area: "דירה 17",
            contractor: "אחמד",
            trade: "שלד",
            status: "in_progress",
            check_in_days: 2,
            depends_on_index: null,
          },
        ],
        affects: ["טיח פנים – דירה 17"],
        completes_task_id: null,
        blocker_text: null,
        confidence: 0.88,
        resolved: {
          tasks: [{ area_id: A("apt17"), contractor_id: cid("ahmad"), trade_id: tradeId("structure") }],
          affects_task_ids: [T("PL17")],
          completes_task_id: null,
        },
        engine: "heuristic",
      },
    },
  );

  // PM ↔ Shor: the multi-step instruction → two chained tasks
  msg("shor-1", convDirect("shor"), P("shor"), 26, "שלום רפאל, המעקות מוכנים במפעל, מחכים לאישור להגיע");
  msg(
    "shor-chain",
    convDirect("shor"),
    DEMO_IDS.pm,
    0.4,
    "שור, צריך לסמן את החורים בחיפוי של המרפסות ואז להזמין את ואדים",
    {
      ai_status: "suggested",
      ai_parsed_json: {
        intent: "new_task",
        tasks: [
          {
            title: "סימון חורים בחיפוי המרפסות",
            area: "מרפסות – חזית",
            contractor: "שור",
            trade: "מסגרות",
            status: "planned",
            check_in_days: 2,
            depends_on_index: null,
          },
          {
            title: "חיפוי מרפסות – קידוח והתקנה",
            area: "מרפסות – חזית",
            contractor: "ואדים",
            trade: "חיפוי חוץ",
            status: "planned",
            check_in_days: 5,
            depends_on_index: 0,
          },
        ],
        affects: ["התקנת מעקות מרפסות"],
        completes_task_id: null,
        blocker_text: null,
        confidence: 0.91,
        resolved: {
          tasks: [
            { area_id: A("balconies"), contractor_id: cid("shor"), trade_id: tradeId("metalwork") },
            { area_id: A("balconies"), contractor_id: cid("vadim"), trade_id: tradeId("cladding") },
          ],
          affects_task_ids: [T("RL")],
          completes_task_id: null,
        },
        engine: "heuristic",
      },
    },
  );

  // PM ↔ Paz: a promise to check that was never closed (H3 check_at passed)
  const pazCheck = msg("paz-1", convDirect("paz"), DEMO_IDS.pm, 24 * 3, "פז, תבדוק עד מחר שהצנרת בקומה 3 עברה בדיקת לחץ ותעדכן", {
    ai_status: "accepted",
    ai_reviewed_by: DEMO_IDS.pm,
    ai_reviewed_at: ago(24 * 3 - 0.2),
  });
  msg("paz-2", convDirect("paz"), P("paz"), 24 * 3 - 2, "סגור, מחר בבוקר");
  db.tasks.find((t) => t.id === T("H3"))!.created_from_message_id = pazCheck;
  db.message_links.push({ message_id: pazCheck, task_id: T("H3"), kind: "mention", created_at: ago(24 * 3) });

  // PM ↔ Dani: roof waterproofing promised and overdue
  msg("dani-1", convDirect("dani"), DEMO_IDS.pm, 24 * 2, "דני, מה עם איטום הגג? זה תוקע לי 4 דירות בקומה העליונה");
  msg("dani-2", convDirect("dani"), P("dani"), 24 * 2 - 1, "מחר מסיימים, אין בעיה");

  // PM ↔ Moti: unanswered for 7 hours (no_response reminder)
  msg("moti-1", convDirect("moti"), DEMO_IDS.pm, 7, "מוטי, צריך תאריך לבדיקת לחץ בדירה 13. מתי אתה מגיע?");

  // PM ↔ owner rep
  msg("viewer-1", convDirect("viewer"), DEMO_IDS.viewer, 22, "רפאל, מתי צפוי טופס 4? הדיירים שואלים");
  msg("viewer-2", convDirect("viewer"), DEMO_IDS.pm, 21, "יעד נוכחי לפי הגרף – 5 חודשים. אעדכן אחרי אישור יועץ הבטיחות");

  // Group
  msg("g-1", groupId, DEMO_IDS.pm, 24 * 1 + 3, "בוקר טוב לכולם. תזכורת: עד יום חמישי סוגרים גבס בקומה 2");
  const nikDone = msg("g-nik", groupId, P("nikolai"), 4, "סיימתי את הגבס בדירה 9, כולל תקרה בחדר רחצה. שלחתי תמונות", {
    ai_status: "accepted",
    ai_reviewed_by: DEMO_IDS.pm,
    ai_reviewed_at: ago(3.5),
    ai_parsed_json: {
      intent: "completion_report",
      tasks: [],
      affects: ["טיח פנים – דירה 9"],
      completes_task_id: T("D9"),
      blocker_text: null,
      confidence: 0.93,
      resolved: { tasks: [], affects_task_ids: [T("PL9")], completes_task_id: T("D9") },
      engine: "heuristic",
    },
  });
  msg("g-nik-photo", groupId, P("nikolai"), 3.9, "", { kind: "image", media_url: "/demo/photo-drywall-1.svg" });
  msg(
    "g-samer",
    groupId,
    P("samer"),
    2,
    "אי אפשר להתחיל טיח בדירה 7, אין חשמל זמני בקומה 2",
    {
      ai_status: "suggested",
      ai_parsed_json: {
        intent: "blocker",
        tasks: [],
        affects: ["טיח פנים – דירה 7"],
        completes_task_id: null,
        blocker_text: "אין חשמל זמני בקומה 2",
        confidence: 0.84,
        resolved: { tasks: [], affects_task_ids: [T("PL7")], completes_task_id: null },
        engine: "heuristic",
      },
    },
  );
  msg("g-paz", groupId, P("paz"), 1, "מתי מגיע יועץ הבטיחות לאשר? אני צריך לתכנן צוות לשבוע הבא", {
    ai_status: "suggested",
    ai_parsed_json: {
      intent: "question",
      tasks: [],
      affects: [],
      completes_task_id: null,
      blocker_text: null,
      confidence: 0.8,
      resolved: { tasks: [], affects_task_ids: [], completes_task_id: null },
      engine: "heuristic",
    },
  });
  const yossiDone = msg("g-yossi", groupId, P("yossi"), 0.5, "סיימתי חשמל בדירה 14", {
    ai_status: "suggested",
    ai_parsed_json: {
      intent: "completion_report",
      tasks: [],
      affects: ["סגירת קירות ותקרות גבס – דירה 14"],
      completes_task_id: T("E14"),
      blocker_text: null,
      confidence: 0.9,
      resolved: { tasks: [], affects_task_ids: [T("D14")], completes_task_id: T("E14") },
      engine: "heuristic",
    },
  });
  msg("g-yossi-ask", groupId, null, 0.49, "📷 יוסי, כדי לשלוח לאישור את \"תשתיות חשמל – דירה 14\" צריך תמונה של העבודה.", {
    meta: { action: "request_photo", task_id: T("E14"), for_profile_id: P("yossi"), source_message_id: yossiDone },
  });

  // Make sure unread state exists: the PM has not yet read the newest group / Shor messages
  for (const cp of db.conversation_participants) {
    if (cp.profile_id === DEMO_IDS.pm && (cp.conversation_id === groupId || cp.conversation_id === convDirect("ahmad")))
      cp.last_read_at = ago(5);
    if (cp.profile_id !== DEMO_IDS.pm) cp.last_read_at = ago(cp.conversation_id === convDirect("moti") ? 8 : 0.3);
  }

  msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  db.messages.push(...msgs);
  for (const c of db.conversations) {
    const last = msgs.filter((m) => m.conversation_id === c.id).at(-1);
    c.last_message_at = last?.created_at ?? null;
  }
  db.message_links.push({ message_id: nikDone, task_id: T("D9"), kind: "completion", created_at: ago(4) });
  db.message_links.push({ message_id: yossiDone, task_id: T("E14"), kind: "completion", created_at: ago(0.5) });

  // ── completion reports ───────────────────────────────────────
  db.completion_reports.push(
    {
      id: sid("report:D9"),
      task_id: T("D9"),
      contractor_id: cid("nikolai"),
      submitted_by: P("nikolai"),
      photo_urls: ["/demo/photo-drywall-1.svg", "/demo/photo-drywall-2.svg"],
      note: "סגירה מלאה כולל תקרה בחדר רחצה ופתחי ביקורת",
      status: "pending",
      reviewed_by: null,
      review_comment: null,
      reviewed_at: null,
      message_id: nikDone,
      created_at: ago(3.8),
    },
    {
      id: sid("report:PL3"),
      task_id: T("PL3"),
      contractor_id: cid("samer"),
      submitted_by: P("samer"),
      photo_urls: ["/demo/photo-plaster-1.svg"],
      note: null,
      status: "approved",
      reviewed_by: DEMO_IDS.pm,
      review_comment: "מצוין",
      reviewed_at: ago(24 * 6),
      message_id: null,
      created_at: ago(24 * 6 + 3),
    },
  );

  // ── plans & pins ─────────────────────────────────────────────
  const planId = sid("plan:floor4");
  db.plan_files.push({
    id: planId,
    project_id: DEMO_IDS.project,
    title: "קומה 4 – תוכנית אדריכלית",
    file_url: "/demo/plan-floor-4.pdf",
    floor_area_id: A("floor4"),
    created_by: DEMO_IDS.pm,
    created_at: ago(24 * 30),
  });
  for (const apt of PLAN_APARTMENTS) {
    const c = normCentre(apt);
    db.plan_pins.push({
      id: sid(`pin:apt${apt.number}`),
      plan_file_id: planId,
      page: 1,
      x: c.x,
      y: c.y,
      area_id: A(`apt${apt.number}`),
      label: `דירה ${apt.number}`,
      created_at: ago(24 * 30),
    });
  }
  const bc = normCentre(PLAN_BALCONIES);
  db.plan_pins.push({
    id: sid("pin:balconies"),
    plan_file_id: planId,
    page: 1,
    x: bc.x,
    y: bc.y,
    area_id: A("balconies"),
    label: "מרפסות",
    created_at: ago(24 * 30),
  });
  db.tasks.find((t) => t.id === T("PL17"))!.plan_pin_id = sid("pin:apt17");

  // ── audit trail for completed work ───────────────────────────
  for (const t of db.tasks) {
    if (t.status !== "done") continue;
    db.audit_log.push({
      id: sid(`audit:${t.id}`),
      project_id: DEMO_IDS.project,
      entity_type: "task",
      entity_id: t.id,
      action: "status",
      from_value: "awaiting_approval",
      to_value: "done",
      actor_profile_id: DEMO_IDS.pm,
      source: "manual",
      meta: null,
      created_at: t.completed_at!,
    });
  }

  return db;
}
