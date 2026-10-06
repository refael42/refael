/**
 * Stored media references are either public demo assets ("/demo/x.svg") or
 * storage keys ("uploads/<project>/<file>") served through the authenticated
 * /api/files route.
 */
export function mediaSrc(ref: string | null | undefined): string {
  if (!ref) return "";
  if (ref.startsWith("/") || ref.startsWith("http")) return ref;
  return `/api/files/${ref.split("/").map(encodeURIComponent).join("/")}`;
}
