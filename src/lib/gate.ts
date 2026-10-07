/**
 * Optional site-wide password (SITE_PASSWORD): keeps the whole site private —
 * without it nobody sees anything, not even the login screen. Runs in the
 * middleware (edge) and in the /gate action, so only Web Crypto is used.
 */
export const GATE_COOKIE = "sf_gate";

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`siteflow-gate:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only same-site paths are allowed as the place to return to. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/gate") ? next : "/";
}
