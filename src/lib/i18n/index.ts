import { he } from "./he";

export const t = he;

/**
 * All dates are shown in the project's timezone (not the server's or the
 * phone's), so server-rendered and client-rendered text always match.
 */
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "Asia/Jerusalem";

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("he-IL", { timeZone: TIME_ZONE, ...opts });
    cache.set(key, f);
  }
  return f;
}

function parts(d: Date) {
  const p = Object.fromEntries(
    fmt({ year: "2-digit", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute };
}

/** 'YYYY-MM-DD' strings are calendar dates — never shift them by timezone. */
function asDate(d: string | Date): Date {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00Z`);
  return new Date(d);
}

/** Today's calendar date ('YYYY-MM-DD') in the project timezone — the cutoff for "overdue". */
export function localDate(d: Date = new Date()): string {
  const p = Object.fromEntries(
    fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Calendar day key in the project timezone. */
export function dayKey(d: string | Date): string {
  const p = parts(asDate(d));
  return `${p.y}-${p.m}-${p.d}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const p = parts(asDate(d));
  return `${p.d}.${p.m}.${p.y}`;
}

export function fmtTime(d: string | Date): string {
  const p = parts(new Date(d));
  return `${p.hh}:${p.mm}`;
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const p = parts(new Date(d));
  return `${p.d}.${p.m} ${p.hh}:${p.mm}`;
}

const DAY = 86_400_000;

/** "היום" / "אתמול" / weekday + date — chat day separators. */
export function fmtDay(d: string | Date, now: Date = new Date()): string {
  const k = dayKey(d);
  if (k === dayKey(now)) return he.chat.today;
  if (k === dayKey(new Date(now.getTime() - DAY))) return he.chat.yesterday;
  return fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(d));
}

export function fmtChatTime(d: string | Date, now: Date = new Date()): string {
  const k = dayKey(d);
  if (k === dayKey(now)) return fmtTime(d);
  if (k === dayKey(new Date(now.getTime() - DAY))) return he.chat.yesterday;
  const p = parts(new Date(d));
  return `${p.d}.${p.m}`;
}

/** Relative time ("לפני 3 שעות"). Render inside <RelativeTime/> on the client to avoid hydration drift. */
export function fmtRelative(d: string | Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const diff = new Date(d).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return fmtDate(d);
}
