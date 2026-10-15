/**
 * WhatsApp "Export chat" text files → messages.
 *
 * Handles the Android ("12.10.2026, 14:05 - name: text") and iPhone
 * ("[12.10.2026, 14:05:33] name: text") layouts, Hebrew and English system
 * texts, 12/24-hour clocks, multi-line messages and attachment markers.
 * Times in the file are the phone's local time; they are converted to UTC
 * using the project's time zone.
 */

export type ExportKind = "text" | "image" | "voice" | "file" | "system";

export interface ExportMessage {
  sentAt: Date;
  /** display name or phone as it appears in the export; null for system lines */
  author: string | null;
  text: string;
  kind: ExportKind;
  /** attached file name, when the export included media */
  attachment: string | null;
  /** the export said media was left out ("<Media omitted>") */
  mediaOmitted: boolean;
}

export interface ParsedExport {
  messages: ExportMessage[];
  /** distinct authors, in order of first message */
  participants: string[];
  dayFirst: boolean;
}

// direction marks, BOM and the narrow no-break space iPhones put before AM/PM
const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;
const DATE = String.raw`(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?\s?[Mm]\.?)?`;
const IOS_LINE = new RegExp(String.raw`^\[${DATE}\]\s*(.*)$`);
const ANDROID_LINE = new RegExp(String.raw`^${DATE}\s*[-–]\s(.*)$`);

const ATTACHED_IOS = /<(?:attached|מצורף|מצורפת|קובץ מצורף):\s*([^>]+)>/i;
const ATTACHED_ANDROID = /^(.+?\.[a-z0-9]{2,5})\s*\((?:file attached|קובץ מצורף|הקובץ מצורף)\)/i;
const OMITTED =
  /<(?:media omitted|המדיה הושמטה|המדיה לא נכללה|מדיה הושמטה)>|^(?:image|video|audio|sticker|document|GIF) omitted$|^(?:התמונה|הסרטון|השמע|המדבקה|המסמך|תמונה|סרטון|קובץ שמע|מדבקה|מסמך)\s+הושמט/i;
const DELETED = /^(?:this message was deleted|you deleted this message|ההודעה נמחקה|מחקת את ההודעה הזו|הודעה זו נמחקה)\.?$/i;
// iPhone writes the encryption notice as if the chat itself said it
const ENCRYPTION_NOTICE = /end-to-end encrypted|מוצפנות מקצה לקצה/i;

const IMAGE = /\.(?:jpe?g|png|webp|heic|gif)$/i;
const VOICE = /\.(?:opus|ogg|m4a|mp3|aac|wav)$/i;

function kindOf(name: string): ExportKind {
  if (IMAGE.test(name)) return "image";
  if (VOICE.test(name)) return "voice";
  return "file";
}

/** The UTC instant of a wall-clock time in a time zone (handles daylight saving). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = (at: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(at));
    const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - at;
  };
  const first = asUtc - offset(asUtc);
  const second = asUtc - offset(first);
  return new Date(second);
}

interface RawLine {
  a: number;
  b: number;
  y: number;
  h: number;
  mi: number;
  s: number;
  ampm: string | undefined;
  rest: string;
}

function matchLine(line: string): RawLine | null {
  const m = IOS_LINE.exec(line) ?? ANDROID_LINE.exec(line);
  if (!m) return null;
  const y = Number(m[3]);
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    y: y < 100 ? 2000 + y : y,
    h: Number(m[4]),
    mi: Number(m[5]),
    s: m[6] ? Number(m[6]) : 0,
    ampm: m[7]?.toLowerCase(),
    rest: m[8] ?? "",
  };
}

export function parseWhatsAppExport(raw: string, opts: { timeZone?: string; dayFirst?: boolean } = {}): ParsedExport {
  const timeZone = opts.timeZone ?? "Asia/Jerusalem";
  const lines = raw.replace(/\r\n?/g, "\n").replace(/ | /g, " ").split("\n");

  // pass 1: split into raw entries (a header line plus its continuation lines)
  const entries: Array<{ head: RawLine; body: string[] }> = [];
  for (const original of lines) {
    const line = original.replace(INVISIBLE, "");
    const head = matchLine(line.trim());
    if (head) entries.push({ head, body: [head.rest] });
    else if (entries.length) entries[entries.length - 1].body.push(original.replace(INVISIBLE, ""));
  }

  // dates are day-first in Israel; trust the file when it proves otherwise
  let dayFirst = opts.dayFirst ?? true;
  if (opts.dayFirst === undefined) {
    if (entries.some((e) => e.head.a > 12)) dayFirst = true;
    else if (entries.some((e) => e.head.b > 12)) dayFirst = false;
  }

  const messages: ExportMessage[] = [];
  const participants: string[] = [];
  for (const { head, body } of entries) {
    let hour = head.h;
    if (head.ampm === "p" && hour < 12) hour += 12;
    if (head.ampm === "a" && hour === 12) hour = 0;
    const [day, month] = dayFirst ? [head.a, head.b] : [head.b, head.a];
    const sentAt = zonedToUtc(head.y, month, day, hour, head.mi, head.s, timeZone);

    const full = body.join("\n");
    const colon = full.indexOf(": ");
    let author: string | null = colon > 0 ? full.slice(0, colon).trim() : null;
    let text = (colon > 0 ? full.slice(colon + 2) : full).trim();
    if (author && (author.length > 60 || ENCRYPTION_NOTICE.test(text))) author = null;
    if (!author) {
      messages.push({ sentAt, author: null, text, kind: "system", attachment: null, mediaOmitted: false });
      continue;
    }
    if (DELETED.test(text)) continue;

    let attachment: string | null = null;
    let mediaOmitted = false;
    const ios = ATTACHED_IOS.exec(text);
    const android = ios ? null : ATTACHED_ANDROID.exec(text);
    if (ios || android) {
      attachment = (ios ?? android)![1].trim();
      text = text.replace((ios ?? android)![0], "").trim();
    } else if (OMITTED.test(text)) {
      mediaOmitted = true;
      text = text.replace(OMITTED, "").trim();
    }
    if (!participants.includes(author)) participants.push(author);
    messages.push({ sentAt, author, text, kind: attachment ? kindOf(attachment) : "text", attachment, mediaOmitted });
  }
  return { messages, participants, dayFirst };
}

/** "WhatsApp Chat with פז מיזוג.txt" / "צ'אט WhatsApp עם פז מיזוג.txt" → "פז מיזוג". */
export function chatTitleFromFileName(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.(txt|zip)$/i, "").trim();
  const m = /(?:WhatsApp Chat (?:with|-)\s*|צ['׳]אט (?:WhatsApp|וואטסאפ) עם\s*|שיחת WhatsApp עם\s*)(.+)$/i.exec(base);
  const title = (m?.[1] ?? base).trim();
  return title && !/^_?chat$/i.test(title) ? title : null;
}

/** cyrb53: a small, stable string hash (dedupe only, not security). Same in the browser and on the server. */
function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * A stable id per message: re-exporting the same chat yields the same ids, so
 * only new messages are added. Identical messages in the same minute are told
 * apart by their order.
 */
export function exportMessageKeys(messages: Array<Pick<ExportMessage, "sentAt" | "author" | "text" | "attachment">>): string[] {
  const seen = new Map<string, number>();
  return messages.map((m) => {
    const base = `${m.sentAt.toISOString()}|${m.author ?? ""}|${m.text}|${m.attachment ?? ""}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${hash53(base)}${hash53(base, 7)}-${n}`;
  });
}
