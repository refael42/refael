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

export type PhaseKey = "shell" | "infra" | "closing" | "wet" | "finish" | "site" | "handover";

/** Which process: per apartment, or the building's shared parts (roof, stairwell, lobby…). */
export type FlowKind = "apartment" | "building";
export const FLOW_KINDS: FlowKind[] = ["apartment", "building"];

/** Shared parts of a building; each becomes a sub-area of the building when the process is applied. */
export const PARTS: Record<string, { name: string }> = {
  systems: { name: "מערכות ותשתיות" },
  roof: { name: "גג" },
  stairwell: { name: "חדר מדרגות" },
  lobby: { name: "לובי" },
  elevator: { name: "מעלית" },
  parking: { name: "חניון" },
  facade: { name: "חזיתות" },
  site: { name: "פיתוח" },
};

/** Optional features: of an apartment (garden, duplex) or of a building (parking, elevator, sprinklers). */
export const FEATURES: Record<string, { name: string; of: "apartment" | "building"; only: string }> = {
  garden: { name: "דירת גן", of: "apartment", only: "רק בדירות גן" },
  duplex: { name: "מכפיל / דופלקס", of: "apartment", only: "רק במכפילים / דופלקסים" },
  parking: { name: "חניון", of: "building", only: "רק כשיש חניון" },
  elevator: { name: "מעלית", of: "building", only: "רק כשיש מעלית" },
  sprinklers: { name: "ספרינקלרים", of: "building", only: "רק כשיש ספרינקלרים" },
};

export interface StagePrereq {
  key: string;
  /** waiting hours after it (drying, tests) */
  lag?: number;
  why?: string;
  /** "building": a stage of the building's shared-parts process (e.g. scaffolding removal) */
  scope?: "building";
}

export interface FlowStage {
  key: string;
  name: string;
  phase: PhaseKey;
  /** trade key (see TRADES in seed/demo.ts and FLOW_TRADES below) */
  trade: string;
  /** typical duration for one apartment, working days */
  days: number;
  /** stages that must be done first; lag = waiting hours after it (drying, tests) */
  after: StagePrereq[];
  description: string;
  /** only where this feature exists (e.g. "garden", "sprinklers"); otherwise skipped */
  when?: string;
  /** building process: which shared part the task belongs to (see PARTS) */
  part?: string;
}

export const PHASES: Record<PhaseKey, { name: string; color: string }> = {
  shell: { name: "שלד ומחיצות", color: "#78716c" },
  infra: { name: "תשתיות", color: "#0ea5e9" },
  closing: { name: "טיח וסגירות", color: "#d6a77a" },
  wet: { name: "איטום וריצוף", color: "#6366f1" },
  finish: { name: "גמר", color: "#ec4899" },
  site: { name: "פיתוח", color: "#65a30d" },
  handover: { name: "מסירה", color: "#16a34a" },
};

/** Trades the process uses beyond the base list (created on demand). */
export const FLOW_TRADES: Array<{ key: string; name: string; color: string }> = [
  { key: "communications", name: "תקשורת", color: "#8b5cf6" },
  { key: "carpentry", name: "נגרות ודלתות", color: "#92400e" },
  { key: "kitchen", name: "מטבחים", color: "#be185d" },
  { key: "gas", name: "גז", color: "#ea580c" },
  { key: "general", name: "ביצוע כללי", color: "#64748b" },
  { key: "elevator", name: "מעליות", color: "#0f766e" },
  { key: "fire", name: "בטיחות אש", color: "#dc2626" },
  { key: "landscaping", name: "פיתוח וגינון", color: "#16a34a" },
  { key: "metalwork", name: "מסגרות", color: "#475569" },
  { key: "cladding", name: "חיפוי חוץ", color: "#a16207" },
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
    key: "apt_sprinklers",
    name: "צנרת ספרינקלרים בדירה",
    phase: "infra",
    trade: "fire",
    days: 2,
    after: [{ key: "marking" }, { key: "sprinkler_risers", scope: "building", why: "הדירה מתחברת לקו הספרינקלרים הראשי" }],
    description: "צנרת מתזים בתקרות לפני טיח וגבס. רק בבניין עם ספרינקלרים.",
    when: "sprinklers",
  },
  {
    key: "duplex_stairs",
    name: "מדרגות פנימיות – שלד",
    phase: "shell",
    trade: "structure",
    days: 3,
    after: [{ key: "blocks" }],
    description: "מדרגות בין המפלסים בדירת מכפיל / דופלקס, לפני טיח.",
    when: "duplex",
  },
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
      { key: "apt_sprinklers" },
      { key: "duplex_stairs" },
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
    key: "sprinkler_heads",
    name: "ראשי ספרינקלרים",
    phase: "finish",
    trade: "fire",
    days: 1,
    after: [{ key: "drywall" }, { key: "paint_base" }],
    description: "התקנת ראשי מתזים בתקרות אחרי הגבס והשפכטל.",
    when: "sprinklers",
  },
  {
    key: "duplex_stair_cladding",
    name: "חיפוי מדרגות פנימיות",
    phase: "finish",
    trade: "tiling",
    days: 2,
    after: [{ key: "flooring" }],
    description: "חיפוי שיש / עץ למדרגות הפנימיות.",
    when: "duplex",
  },
  {
    key: "duplex_railing",
    name: "מעקה למדרגות הפנימיות",
    phase: "finish",
    trade: "metalwork",
    days: 1,
    after: [{ key: "duplex_stair_cladding" }],
    description: "מעקה זכוכית / מתכת למדרגות.",
    when: "duplex",
  },
  {
    key: "hot_water",
    name: "חיבור מים חמים לדוד השמש",
    phase: "finish",
    trade: "plumbing",
    days: 0.5,
    after: [{ key: "plumb_finish" }, { key: "solar_heaters", scope: "building", why: "הדוד על הגג צריך להיות מותקן" }],
    description: "חיבור הדירה לדוד וקולט השמש שעל הגג ובדיקת מים חמים.",
  },
  // ── דירת גן ──
  {
    key: "garden_infra",
    name: "תשתיות חצר – ניקוז, השקיה וחשמל",
    phase: "site",
    trade: "landscaping",
    days: 2,
    after: [{ key: "waterproofing" }],
    description: "ניקוז, צנרת השקיה ותאורת חוץ בחצר של דירת הגן.",
    when: "garden",
  },
  {
    key: "garden_paving",
    name: "ריצוף חצר",
    phase: "site",
    trade: "tiling",
    days: 3,
    after: [{ key: "garden_infra" }, { key: "scaffold_removal", scope: "building", why: "לא מרצפים חצר לפני פירוק הפיגומים" }],
    description: "ריצוף / דק בחצר.",
    when: "garden",
  },
  {
    key: "garden_fence",
    name: "גדר ושער לחצר",
    phase: "site",
    trade: "metalwork",
    days: 1,
    after: [{ key: "garden_paving" }],
    description: "גדר, שער ומעקות בחצר.",
    when: "garden",
  },
  {
    key: "garden_planting",
    name: "גינון לחצר",
    phase: "site",
    trade: "landscaping",
    days: 1,
    after: [{ key: "garden_paving" }],
    description: "שתילה, דשא ומערכת השקיה.",
    when: "garden",
  },
  {
    key: "paint_final",
    name: "צבע – שכבה סופית",
    phase: "finish",
    trade: "paint",
    days: 2,
    after: [
      { key: "windows" },
      { key: "doors" },
      { key: "elec_finish" },
      { key: "comm_finish" },
      { key: "plumb_finish" },
      { key: "hvac_finish" },
      { key: "sprinkler_heads" },
      { key: "duplex_railing" },
    ],
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
    after: [{ key: "cleaning" }, { key: "hot_water" }, { key: "garden_fence" }, { key: "garden_planting" }],
    description: "סיור בדק, רשימת תיקונים ומסירת מפתח.",
  },
];

/**
 * The building's shared parts: systems, roof (with solar water heaters),
 * stairwell, lobby, elevator, parking, facades and site development.
 * Stages with `when` are skipped where the building doesn't have that feature.
 */
export const BUILDING_FLOW: FlowStage[] = [
  // ── מערכות ──
  {
    key: "risers",
    name: "קווים ראשיים בפירים – מים, ביוב, חשמל ותקשורת",
    phase: "infra",
    trade: "plumbing",
    days: 6,
    after: [],
    description: "הקווים האנכיים שמהם מתחברות כל הדירות.",
    part: "systems",
  },
  {
    key: "sprinkler_risers",
    name: "קו ספרינקלרים ראשי וחדר משאבות",
    phase: "infra",
    trade: "fire",
    days: 5,
    after: [{ key: "risers" }],
    description: "קו מתזים ראשי, משאבות ומאגר. רק בבניין עם ספרינקלרים.",
    part: "systems",
    when: "sprinklers",
  },
  {
    key: "sprinkler_test",
    name: "בדיקת לחץ למערכת הספרינקלרים",
    phase: "infra",
    trade: "fire",
    days: 1,
    after: [{ key: "sprinkler_risers" }],
    description: "בדיקת לחץ ואטימות למערכת המתזים.",
    part: "systems",
    when: "sprinklers",
  },
  // ── גג ──
  {
    key: "roof_screed",
    name: "בטון שיפועים ובידוד תרמי לגג",
    phase: "wet",
    trade: "structure",
    days: 3,
    after: [],
    description: "שיפועים לניקוז ובידוד תרמי לפני האיטום.",
    part: "roof",
  },
  {
    key: "roof_waterproofing",
    name: "איטום גג",
    phase: "wet",
    trade: "waterproofing",
    days: 3,
    after: [{ key: "roof_screed", lag: 72, why: "בטון השיפועים צריך להתייבש" }],
    description: "יריעות איטום / איטום ביטומני לגג.",
    part: "roof",
  },
  {
    key: "roof_flood_test",
    name: "בדיקת הצפה לגג",
    phase: "wet",
    trade: "waterproofing",
    days: 2,
    after: [{ key: "roof_waterproofing", lag: 24 }],
    description: "הצפה של 48 שעות ובדיקת דליפות לקומה העליונה.",
    part: "roof",
  },
  {
    key: "roof_protection",
    name: "הגנה על האיטום – ריצוף / חצץ בגג",
    phase: "wet",
    trade: "tiling",
    days: 3,
    after: [{ key: "roof_flood_test", lag: 48 }],
    description: "שכבת הגנה מעל האיטום, לפני שעולים לגג עם ציוד.",
    part: "roof",
  },
  {
    key: "solar_heaters",
    name: "התקנת דודים וקולטי שמש",
    phase: "finish",
    trade: "plumbing",
    days: 3,
    after: [{ key: "roof_protection" }, { key: "risers" }],
    description: "מתקני דודים וקולטים על הגג וחיבור לקווי המים החמים לדירות.",
    part: "roof",
  },
  {
    key: "roof_railings",
    name: "מעקות גג",
    phase: "finish",
    trade: "metalwork",
    days: 2,
    after: [{ key: "roof_protection" }],
    description: "מעקות בטיחות בהיקף הגג.",
    part: "roof",
  },
  // ── חזיתות ──
  {
    key: "facade",
    name: "חיפוי / טיח חוץ לחזיתות",
    phase: "closing",
    trade: "cladding",
    days: 25,
    after: [],
    description: "חיפוי אבן / טיח חוץ לכל החזיתות, מהפיגומים.",
    part: "facade",
  },
  {
    key: "scaffold_removal",
    name: "פירוק פיגומים",
    phase: "finish",
    trade: "general",
    days: 2,
    after: [{ key: "facade" }, { key: "roof_railings" }],
    description: "אחרי סיום החזיתות. מכאן אפשר להתחיל פיתוח.",
    part: "facade",
  },
  // ── חדר מדרגות ──
  {
    key: "stair_plaster",
    name: "טיח בחדר המדרגות",
    phase: "closing",
    trade: "plaster",
    days: 6,
    after: [{ key: "risers" }],
    description: "טיח לקירות חדר המדרגות והמבואות הקומתיות.",
    part: "stairwell",
  },
  {
    key: "stair_cladding",
    name: "חיפוי מדרגות ופודסטים (אבן / שיש)",
    phase: "finish",
    trade: "tiling",
    days: 6,
    after: [{ key: "stair_plaster" }],
    description: "חיפוי מדרגות, פודסטים ומבואות.",
    part: "stairwell",
  },
  {
    key: "stair_railings",
    name: "מעקות חדר מדרגות",
    phase: "finish",
    trade: "metalwork",
    days: 3,
    after: [{ key: "stair_cladding" }],
    description: "מעקות ומאחזי יד.",
    part: "stairwell",
  },
  {
    key: "fire_systems",
    name: "גילוי אש, עמדות כיבוי ושילוט",
    phase: "finish",
    trade: "fire",
    days: 3,
    after: [{ key: "stair_plaster" }],
    description: "גלאים, לוח כיבוי, עמדות כיבוי ושילוט מילוט.",
    part: "stairwell",
  },
  {
    key: "stair_paint",
    name: "צבע חדר מדרגות",
    phase: "finish",
    trade: "paint",
    days: 4,
    after: [{ key: "stair_railings" }, { key: "fire_systems" }],
    description: "צבע לקירות ולתקרות חדר המדרגות.",
    part: "stairwell",
  },
  {
    key: "stair_electric",
    name: "גמר חשמל ותאורה בחדר מדרגות",
    phase: "finish",
    trade: "electrical",
    days: 2,
    after: [{ key: "stair_paint" }],
    description: "גופי תאורה, לחצנים ותאורת חירום.",
    part: "stairwell",
  },
  // ── מעלית ──
  {
    key: "elevator_shaft",
    name: "הכנת פיר מעלית",
    phase: "closing",
    trade: "structure",
    days: 3,
    after: [],
    description: "פילוס וטיח לפיר, חדר מכונות / בור מעלית.",
    part: "elevator",
    when: "elevator",
  },
  {
    key: "elevator_install",
    name: "התקנת מעלית",
    phase: "finish",
    trade: "elevator",
    days: 15,
    after: [{ key: "elevator_shaft" }],
    description: "מסילות, תא, דלתות קומתיות ובקר.",
    part: "elevator",
    when: "elevator",
  },
  {
    key: "elevator_inspection",
    name: "בדיקת בודק מוסמך למעלית",
    phase: "handover",
    trade: "general",
    days: 1,
    after: [{ key: "elevator_install" }, { key: "stair_electric" }],
    description: "בדיקה ואישור הפעלה של בודק מוסמך.",
    part: "elevator",
    when: "elevator",
  },
  // ── לובי ──
  {
    key: "lobby_plaster",
    name: "טיח וחיפוי קירות בלובי",
    phase: "closing",
    trade: "cladding",
    days: 5,
    after: [{ key: "risers" }],
    description: "טיח, חיפוי אבן / קרמיקה לקירות הלובי.",
    part: "lobby",
  },
  {
    key: "lobby_ceiling",
    name: "תקרה מונמכת ותאורה בלובי",
    phase: "finish",
    trade: "drywall",
    days: 3,
    after: [{ key: "lobby_plaster" }],
    description: "תקרת גבס / אקוסטית ונקודות תאורה.",
    part: "lobby",
  },
  {
    key: "lobby_floor",
    name: "ריצוף לובי",
    phase: "finish",
    trade: "tiling",
    days: 3,
    after: [{ key: "lobby_ceiling" }],
    description: "ריצוף אבן / שיש בלובי ובכניסה.",
    part: "lobby",
  },
  {
    key: "entrance_door",
    name: "דלת כניסה לבניין ואינטרקום",
    phase: "finish",
    trade: "aluminum",
    days: 2,
    after: [{ key: "lobby_floor" }],
    description: "דלת כניסה ראשית, אינטרקום ובקרת כניסה.",
    part: "lobby",
  },
  {
    key: "mailboxes",
    name: "תיבות דואר ושילוט",
    phase: "finish",
    trade: "general",
    days: 1,
    after: [{ key: "lobby_floor" }],
    description: "תיבות דואר, שילוט דירות ומספר בית.",
    part: "lobby",
  },
  {
    key: "lobby_paint",
    name: "צבע וגמר לובי",
    phase: "finish",
    trade: "paint",
    days: 2,
    after: [{ key: "entrance_door" }, { key: "mailboxes" }],
    description: "שכבה סופית אחרי כל ההתקנות.",
    part: "lobby",
  },
  // ── חניון ──
  {
    key: "parking_systems",
    name: "תשתיות חניון – חשמל, תאורה ואוורור",
    phase: "infra",
    trade: "electrical",
    days: 6,
    after: [{ key: "risers" }, { key: "sprinkler_test" }],
    description: "תאורה, אוורור ושחרור עשן. אחרי בדיקת הספרינקלרים (אם יש).",
    part: "parking",
    when: "parking",
  },
  {
    key: "parking_floor",
    name: "רצפת חניון – החלקה / אפוקסי",
    phase: "finish",
    trade: "general",
    days: 3,
    after: [{ key: "parking_systems" }],
    description: "החלקה או ציפוי אפוקסי לרצפה.",
    part: "parking",
    when: "parking",
  },
  {
    key: "parking_paint",
    name: "צבע וסימון חניות",
    phase: "finish",
    trade: "paint",
    days: 3,
    after: [{ key: "parking_floor" }],
    description: "צבע עמודים וקירות, מספור וסימון חניות.",
    part: "parking",
    when: "parking",
  },
  {
    key: "parking_gate",
    name: "שער חניון ובקרת כניסה",
    phase: "finish",
    trade: "metalwork",
    days: 2,
    after: [{ key: "parking_systems" }],
    description: "שער חשמלי ושלט / קורא לוחיות.",
    part: "parking",
    when: "parking",
  },
  // ── פיתוח ──
  {
    key: "site_infra",
    name: "תשתיות פיתוח – ניקוז, ביוב, חשמל ותקשורת",
    phase: "site",
    trade: "landscaping",
    days: 8,
    after: [{ key: "scaffold_removal", why: "פיתוח מתחיל אחרי פירוק הפיגומים" }],
    description: "קווי ניקוז וביוב, חיבורי חשמל ותקשורת בשטח המגרש.",
    part: "site",
  },
  {
    key: "site_paving",
    name: "פיתוח – אבן משתלבת, שבילים ומדרכות",
    phase: "site",
    trade: "landscaping",
    days: 8,
    after: [{ key: "site_infra" }],
    description: "אבן משתלבת, שבילי גישה, אבני שפה ומדרכות.",
    part: "site",
  },
  {
    key: "site_fences",
    name: "גדרות, שערים ותאורת חוץ",
    phase: "site",
    trade: "metalwork",
    days: 4,
    after: [{ key: "site_paving" }],
    description: "גדר היקפית, שערים, ומתקני אשפה.",
    part: "site",
  },
  {
    key: "site_garden",
    name: "גינון והשקיה",
    phase: "site",
    trade: "landscaping",
    days: 4,
    after: [{ key: "site_paving" }],
    description: "שתילה, דשא ומערכת השקיה בשטחים המשותפים.",
    part: "site",
  },
  // ── מסירה ──
  {
    key: "form4",
    name: "בדיקות רשויות וטופס 4",
    phase: "handover",
    trade: "general",
    days: 5,
    after: [
      { key: "solar_heaters" },
      { key: "stair_electric" },
      { key: "elevator_inspection" },
      { key: "lobby_paint" },
      { key: "parking_paint" },
      { key: "parking_gate" },
      { key: "site_fences" },
      { key: "site_garden" },
    ],
    description: "כיבוי אש, חברת חשמל, עירייה – ואישור אכלוס.",
    part: "systems",
  },
];

/** The built-in process of each kind. */
export const DEFAULT_FLOWS: Record<FlowKind, FlowStage[]> = { apartment: APARTMENT_FLOW, building: BUILDING_FLOW };

/**
 * The stages that apply where `features` exist, with prerequisites re-linked
 * past skipped stages (if B is skipped and C needs B, C needs what B needed).
 */
export function stagesFor(flow: FlowStage[], features: Iterable<string>): FlowStage[] {
  const have = new Set(features);
  const byKey = new Map(flow.map((s) => [s.key, s]));
  const included = (s: FlowStage) => !s.when || have.has(s.when);
  // what a skipped stage stood for: its own (included) prerequisites, same process only
  const through = (key: string, seen: Set<string>): StagePrereq[] => {
    if (seen.has(key)) return [];
    seen.add(key);
    return (byKey.get(key)?.after ?? []).flatMap((a) => {
      if (a.scope) return [];
      const dep = byKey.get(a.key);
      if (!dep) return [];
      return included(dep) ? [a] : through(a.key, seen);
    });
  };
  const ancestors = new Map<string, Set<string>>();
  const ancestorsOf = (key: string): Set<string> => {
    if (ancestors.has(key)) return ancestors.get(key)!;
    const out = new Set<string>();
    ancestors.set(key, out);
    for (const a of byKey.get(key)?.after ?? []) {
      if (a.scope || !byKey.has(a.key)) continue;
      out.add(a.key);
      for (const x of ancestorsOf(a.key)) out.add(x);
    }
    return out;
  };
  const resolve = (key: string): StagePrereq[] => {
    const direct: StagePrereq[] = [];
    const bridged: StagePrereq[] = [];
    for (const a of byKey.get(key)?.after ?? []) {
      const dep = byKey.get(a.key);
      if (a.scope || (dep && included(dep))) direct.push(a);
      else if (dep) bridged.push(...through(a.key, new Set()));
    }
    // a bridged prerequisite already implied by another one adds nothing
    const kept = [...direct];
    for (const b of bridged) {
      if (kept.some((k) => !k.scope && k.key === b.key)) continue;
      if (kept.some((k) => !k.scope && ancestorsOf(k.key).has(b.key))) continue;
      kept.push(b);
    }
    return kept;
  };
  return flow.filter(included).map((s) => ({ ...s, after: resolve(s.key) }));
}

/** Prerequisites inside the same process (cross-process ones are linked separately). */
const local = (s: FlowStage) => s.after.filter((a) => !a.scope);

export function stageByKey(key: string, flow: FlowStage[] = APARTMENT_FLOW): FlowStage | undefined {
  return flow.find((s) => s.key === key);
}

/** Stages each stage opens (inverse of `after`). */
export function opensOf(key: string, flow: FlowStage[] = APARTMENT_FLOW): FlowStage[] {
  return flow.filter((s) => local(s).some((a) => a.key === key));
}

export const PHASE_KEYS = Object.keys(PHASES) as PhaseKey[];

/**
 * Problems that make a process unusable (Hebrew messages for the editor):
 * duplicate / empty keys, missing names, unknown prerequisites, cycles.
 */
export function validateFlow(flow: FlowStage[]): string[] {
  const errors: string[] = [];
  if (!flow.length) errors.push("התהליך ריק");
  const keys = new Set<string>();
  for (const s of flow) {
    if (!s.key || !/^[a-z0-9_]+$/.test(s.key)) errors.push(`מזהה שלב לא תקין: "${s.key}"`);
    if (keys.has(s.key)) errors.push(`מזהה כפול: "${s.key}"`);
    keys.add(s.key);
    if (!s.name.trim()) errors.push(`לשלב "${s.key}" אין שם`);
    if (!PHASE_KEYS.includes(s.phase)) errors.push(`שלב "${s.name}": קבוצה לא מוכרת`);
    if (!(s.days > 0 && s.days <= 365)) errors.push(`שלב "${s.name}": משך לא תקין`);
    if (s.when && !FEATURES[s.when]) errors.push(`שלב "${s.name}": תנאי לא מוכר`);
    if (s.part && !PARTS[s.part]) errors.push(`שלב "${s.name}": חלק בניין לא מוכר`);
  }
  for (const s of flow)
    for (const a of s.after) {
      if (a.scope) continue;
      if (!keys.has(a.key)) errors.push(`שלב "${s.name}" תלוי בשלב שלא קיים`);
      if (a.key === s.key) errors.push(`שלב "${s.name}" תלוי בעצמו`);
      if ((a.lag ?? 0) < 0) errors.push(`שלב "${s.name}": זמן המתנה שלילי`);
    }
  if (!errors.length) {
    try {
      stageLevels(flow);
    } catch {
      errors.push("יש מעגל בתהליך – שלב תלוי (בעקיפין) בעצמו");
    }
  }
  return [...new Set(errors)];
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
    const deps = local(s);
    const l = deps.length ? 1 + Math.max(...deps.map((a) => level(a.key))) : 1;
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
    const start = local(s).reduce((m, a) => Math.max(m, out.get(a.key)!.end + Math.ceil((a.lag ?? 0) / 24)), 0);
    out.set(key, { start, end: start + s.days });
  }
  return out;
}
