/**
 * Runtime mode.
 *  - "supabase": NEXT_PUBLIC_SUPABASE_URL + anon key + service role key are configured.
 *  - "demo": nothing configured → in-memory store seeded with the demo project,
 *            persona login, SSE "realtime". Lets every screen run with zero setup.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseMode(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Server-only secrets. Never import these from a client component. */
export const serverEnv = {
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get vapidPublicKey() {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  },
  get vapidPrivateKey() {
    return process.env.VAPID_PRIVATE_KEY ?? "";
  },
  get vapidSubject() {
    return process.env.VAPID_SUBJECT ?? "mailto:admin@siteflow.local";
  },
  /** Hours without a reply before a "no response" reminder fires. */
  get noResponseHours() {
    return Number(process.env.NO_RESPONSE_HOURS ?? 6);
  },
};
