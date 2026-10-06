/**
 * The master construction process (תהליך ביצוע) for a residential apartment:
 * every stage, what it requires and what it opens. Used to
 *  - draw the process flowchart (/flow),
 *  - show live per-apartment status against the process,
 *  - generate an apartment's tasks with the right dependencies and lags.
 *
 * Order follows common Israeli residential practice: shell → infrastructure
 * (electric, communications, plumbing, HVAC, gas) → plaster → wet-room
 * waterproofing + flood test → tiling → drywall → paint → finishing
 * (fixtures only after tiling) → final paint → cleaning → handover.
 */

export type PhaseKey = "shell" | "infra" | "closing" | "wet" | "finish" | "handover";

export interface FlowStage {
  key: string;
  name: string;
  phase: PhaseKey;
  /** trade key (see TRADES in seed/demo.ts and FLOW_TRADES below) */
  trade: string;
  /** typical duration for one apartment, working days */
  days: number;
  /** stages that must be done first; lag = waiting hours after it (drying, tests) */
  after: Array<{ key: string; lag?: number; why?: string }>;
  description: string;
}

export const PHASES: Record<PhaseKey, { name: string; color: string }> = {
  shell: { name: "שלד ומחיצות", color: "#78716c" },
  infra: { name: "תשתיות", color: "#0ea5e9" },
  closing: { name: "טיח וסגירות", color: "#d6a77a" },
  wet: { name: "איטום וריצוף", color: "#6366f1" },
  finish: { name: "גמר", color: "#ec4899" },
  handover: { name: "מסירה", color: "#16a34a" },
};

/** Trades the process uses beyond the base list (created on demand). */
export const FLOW_TRADES: Array<{ key: string; name: string; color: string }> = [
  { key: "communications", name: "תקשורת", color: "#8b5cf6" },
  { key: "carpentry", name: "נגרות ודלתות", color: "#92400e" },
  { key: "kitchen", name: "מטבחים", color: "#be185d" },
  { key: "gas", name: "גז", color: "#ea580c" },
  { key: "general", name: "ביצוע כללי", color: "#64748b" },
];

export const APARTMENT_FLOW: FlowStage[] = [
  // ── שלד ומחיצות ──
  {
    key: "blocks",
    name: "בניית קירות ומחיצות בלוקים",
    phase: "shell",
    trade: "structure",
    days: 4,
    after: [],
    description: "קירות פנים ומחיצות בלוקים לפי תוכנית האדריכל. מכאן נפתחות כל התשתיות.",
  },
  {
    key: "frames",
    name: "משקופים עיוורים – דלתות וחלונות",
    phase: "shell",
    trade: "aluminum",
    days: 2,
    after: [{ key: "blocks" }],
    description: "התקנת משקופים עיוורים לדלתות ולחלונות לפני הטיח, כדי שהטיח ייסגר עליהם.",
  },
  {
    key: "marking",
    name: "סימון נקודות חשמל, מים ותקשורת",
    phase: "shell",
    trade: "general",
    days: 1,
    after: [{ key: "blocks" }],
    description: "סימון על הקירות של כל הנקודות לפי תוכניות היועצים ושינויי דיירים.",
  },
  // ── תשתיות ──
  {
    key: "elec_infra",
    name: "תשתיות חשמל – צנרת וקופסאות",
    phase: "infra",
    trade: "electrical",
    days: 3,
    after: [{ key: "marking" }],
    description: "חציבות, צנרת וקופסאות חשמל בקירות ובתקרה.",
  },
  {
    key: "comm_infra",
    name: "תשתיות תקשורת – צנרת ונקודות",
    phase: "infra",
    trade: "communications",
    days: 2,
    after: [{ key: "marking" }],
    description: "צנרת תקשורת, טלוויזיה ואינטרקום. חייבת להיכנס לפני הטיח.",
  },
  {
    key: "plumb_infra",
    name: "תשתיות אינסטלציה – מים וביוב",
    phase: "infra",
    trade: "plumbing",
    days: 3,
    after: [{ key: "marking" }],
    description: "צנרת מים חמים/קרים, ביוב, נקודות לכלים סניטריים.",
  },
  {
    key: "pressure_test",
    name: "בדיקת לחץ למערכת המים",
    phase: "infra",
    trade: "plumbing",
    days: 1,
    after: [{ key: "plumb_infra" }],
    description: "בדיקת לחץ ותיעוד לפני סגירת הקירות. בלי בדיקה תקינה – לא מטייחים.",
  },
  {
    key: "hvac_infra",
    name: "צנרת מיזוג וניקוז מזגנים",
    phase: "infra",
    trade: "hvac",
    days: 2,
    after: [{ key: "marking" }],
    description: "צנרת גז קירור, ניקוז ותעלות לפני טיח וגבס.",
  },
  {
    key: "gas_infra",
    name: "צנרת גז",
    phase: "infra",
    trade: "gas",
    days: 1,
    after: [{ key: "marking" }],
    description: "הכנה לגז במטבח ובדיקת אטימות.",
  },
  // ── טיח וסגירות ──
  {
    key: "plaster",
    name: "טיח פנים",
    phase: "closing",
    trade: "plaster",
    days: 4,
    after: [
      { key: "frames" },
      { key: "elec_infra" },
      { key: "comm_infra" },
      { key: "pressure_test", why: "קירות נסגרים רק אחרי בדיקת לחץ תקינה" },
      { key: "hvac_infra" },
      { key: "gas_infra" },
    ],
    description: "טיח על כל הקירות – סוגר את כל התשתיות. ממנו נפתחים האיטום והריצוף.",
  },
  // ── איטום וריצוף ──
  {
    key: "waterproofing",
    name: "איטום חדרים רטובים ומרפסת",
    phase: "wet",
    trade: "waterproofing",
    days: 2,
    after: [{ key: "plaster", lag: 48, why: "הטיח צריך להתייבש לפני איטום" }],
    description: "איטום רצפות וקירות בחדרי רחצה, שירותים, מרפסת שירות ומרפסת.",
  },
  {
    key: "flood_test",
    name: "בדיקת הצפה",
    phase: "wet",
    trade: "waterproofing",
    days: 1,
    after: [{ key: "waterproofing", lag: 24 }],
    description: "הצפה של 48 שעות ובדיקת דליפות לפני ריצוף.",
  },
  {
    key: "flooring",
    name: "ריצוף",
    phase: "wet",
    trade: "tiling",
    days: 4,
    after: [{ key: "flood_test", lag: 48, why: "48 שעות הצפה ללא דליפה" }],
    description: "ריצוף כל הדירה. אחרי הריצוף נפתחים גבס, מטבח וכל עבודות הגמר.",
  },
  {
    key: "wall_tiles",
    name: "חיפוי קירות – חדרים רטובים ומטבח",
    phase: "wet",
    trade: "tiling",
    days: 3,
    after: [{ key: "flood_test", lag: 48 }],
    description: "קרמיקה על קירות חדרי רחצה, שירותים ומטבח.",
  },
  // ── גמר ──
  {
    key: "drywall",
    name: "גבס – תקרות מונמכות וסגירות",
    phase: "finish",
    trade: "drywall",
    days: 3,
    after: [{ key: "flooring" }],
    description: "תקרות מונמכות, סינרים וסגירות מעברי צנרת – אחרי הריצוף כדי לא לפגוע בו.",
  },
  {
    key: "paint_base",
    name: "צבע – שפכטל ושכבת יסוד",
    phase: "finish",
    trade: "paint",
    days: 3,
    after: [{ key: "drywall" }, { key: "plaster", lag: 72, why: "ייבוש טיח 72 שעות לפני צבע" }],
    description: "שפכטל, שיוף ושכבת יסוד. שכבה סופית רק אחרי כל ההתקנות.",
  },
  {
    key: "kitchen",
    name: "התקנת מטבח ומשטח",
    phase: "finish",
    trade: "kitchen",
    days: 2,
    after: [{ key: "flooring" }, { key: "wall_tiles" }],
    description: "ארונות, משטח וחיפוי – אחרי ריצוף וחיפוי קירות.",
  },
  {
    key: "windows",
    name: "חלונות אלומיניום – כנפיים וזיגוג",
    phase: "finish",
    trade: "aluminum",
    days: 2,
    after: [{ key: "paint_base" }],
    description: "התקנת כנפיים, זיגוג ותריסים על המשקופים העיוורים.",
  },
  {
    key: "doors",
    name: "דלתות פנים",
    phase: "finish",
    trade: "carpentry",
    days: 1,
    after: [{ key: "flooring" }, { key: "paint_base" }],
    description: "התקנת דלתות פנים – אחרי ריצוף (גובה סף) ויסוד צבע.",
  },
  {
    key: "elec_finish",
    name: "גמר חשמל – אביזרים, גופי תאורה ולוח",
    phase: "finish",
    trade: "electrical",
    days: 2,
    after: [{ key: "paint_base" }, { key: "kitchen" }],
    description: "שקעים, מפסקים, גופי תאורה וחיבור הלוח.",
  },
  {
    key: "comm_finish",
    name: "גמר תקשורת – שקעים וארון תקשורת",
    phase: "finish",
    trade: "communications",
    days: 1,
    after: [{ key: "flooring", why: "תקשורת מותקנת רק אחרי ריצוף" }, { key: "paint_base" }],
    description: "שקעי תקשורת וטלוויזיה, ארון תקשורת ואינטרקום.",
  },
  {
    key: "plumb_finish",
    name: "גמר אינסטלציה – כלים סניטריים וברזים",
    phase: "finish",
    trade: "plumbing",
    days: 2,
    after: [{ key: "flooring", why: "כלים סניטריים רק אחרי ריצוף וחיפוי" }, { key: "wall_tiles" }, { key: "kitchen" }],
    description: "אסלות, כיורים, ברזים, מקלחונים וחיבור מטבח.",
  },
  {
    key: "hvac_finish",
    name: "גמר מיזוג – יחידות פנים וחוץ",
    phase: "finish",
    trade: "hvac",
    days: 1,
    after: [{ key: "paint_base" }, { key: "drywall" }],
    description: "תליית מזגנים, חיבור והפעלה.",
  },
  {
    key: "paint_final",
    name: "צבע – שכבה סופית",
    phase: "finish",
    trade: "paint",
    days: 2,
    after: [{ key: "windows" }, { key: "doors" }, { key: "elec_finish" }, { key: "comm_finish" }, { key: "plumb_finish" }, { key: "hvac_finish" }],
    description: "שכבה סופית אחרי שכל ההתקנות הסתיימו – כדי לא לפגוע בצבע.",
  },
  // ── מסירה ──
  {
    key: "cleaning",
    name: "ניקיון סופי",
    phase: "handover",
    trade: "general",
    days: 1,
    after: [{ key: "paint_final" }],
    description: "ניקיון יסודי לקראת מסירה.",
  },
  {
    key: "handover",
    name: "בדק ומסירה לדייר",
    phase: "handover",
    trade: "general",
    days: 1,
    after: [{ key: "cleaning" }],
    description: "סיור בדק, רשימת תיקונים ומסירת מפתח.",
  },
];

export function stageByKey(key: string): FlowStage | undefined {
  return APARTMENT_FLOW.find((s) => s.key === key);
}

/** Stages each stage opens (inverse of `after`). */
export function opensOf(key: string): FlowStage[] {
  return APARTMENT_FLOW.filter((s) => s.after.some((a) => a.key === key));
}

/**
 * Step number of every stage: 1 + the longest chain of prerequisites.
 * Stages with the same step can run in parallel.
 */
export function stageLevels(flow: FlowStage[] = APARTMENT_FLOW): Map<string, number> {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const level = (key: string): number => {
    if (memo.has(key)) return memo.get(key)!;
    if (visiting.has(key)) throw new Error(`cycle at ${key}`);
    visiting.add(key);
    const s = flow.find((x) => x.key === key)!;
    const l = s.after.length ? 1 + Math.max(...s.after.map((a) => level(a.key))) : 1;
    visiting.delete(key);
    memo.set(key, l);
    return l;
  };
  for (const s of flow) level(s.key);
  return memo;
}

/** Earliest start (working days from the apartment's start) of every stage. */
export function stageSchedule(flow: FlowStage[] = APARTMENT_FLOW): Map<string, { start: number; end: number }> {
  const out = new Map<string, { start: number; end: number }>();
  const order = [...stageLevels(flow).entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  for (const key of order) {
    const s = flow.find((x) => x.key === key)!;
    const start = s.after.reduce((m, a) => Math.max(m, out.get(a.key)!.end + Math.ceil((a.lag ?? 0) / 24)), 0);
    out.set(key, { start, end: start + s.days });
  }
  return out;
}
