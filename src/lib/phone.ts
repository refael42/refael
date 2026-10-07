/** Pure helpers for phone numbers and pasted contractor lists (safe for client components). */

/** Israeli local format → E.164 (050-1234567 → +972501234567). Null for empty/invalid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export interface ParsedContractor {
  name: string;
  trade: string | null;
  phone: string | null;
}

/** "שם, מקצוע, טלפון" per line (comma, tab, dash or pipe separated; any order of phone). */
export function parseContractorLines(text: string): ParsedContractor[] {
  const out: ParsedContractor[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const phoneMatch = line.match(/(\+?\d[\d\s-]{7,}\d)/);
    const phone = phoneMatch ? normalizePhone(phoneMatch[1]) : null;
    const rest = (phoneMatch ? line.replace(phoneMatch[1], " ") : line)
      .split(/[,\t|;]|\s[-–]\s/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!rest.length) continue;
    out.push({ name: rest[0], trade: rest[1] ?? null, phone });
  }
  return out;
}
