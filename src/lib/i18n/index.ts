import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { he as heLocale } from "date-fns/locale";
import { he } from "./he";

export const t = he;

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "d.M.yy");
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "d.M HH:mm");
}

export function fmtTime(d: string | Date): string {
  return format(new Date(d), "HH:mm");
}

export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true, locale: heLocale });
}

/** "היום" / "אתמול" / date — chat day separators */
export function fmtDay(d: string | Date): string {
  const date = new Date(d);
  if (isToday(date)) return he.chat.today;
  if (isYesterday(date)) return he.chat.yesterday;
  return format(date, "EEEE, d בMMMM", { locale: heLocale });
}

export function fmtChatTime(d: string | Date): string {
  const date = new Date(d);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return he.chat.yesterday;
  return format(date, "d.M");
}
