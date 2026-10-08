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
    return process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
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
  /** Local hour (project timezone) from which the morning digest is sent. */
  get digestHour() {
    return Number(process.env.DIGEST_HOUR ?? 7);
  },
  /** Emails / phones (comma separated) allowed to open a company + first project without an invite. */
  get admins() {
    return (process.env.SITEFLOW_ADMINS ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  },
  /** WhatsApp Cloud API (Meta). All four are needed for WhatsApp to switch on. */
  get whatsappToken() {
    return process.env.WHATSAPP_TOKEN ?? "";
  },
  get whatsappPhoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  },
  get whatsappAppSecret() {
    return process.env.WHATSAPP_APP_SECRET ?? "";
  },
  get whatsappVerifyToken() {
    return process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  },
  /** approved utility template with one body variable, used outside the 24h window */
  get whatsappTemplate() {
    return process.env.WHATSAPP_TEMPLATE ?? "siteflow_update";
  },
  get whatsappTemplateLang() {
    return process.env.WHATSAPP_TEMPLATE_LANG ?? "he";
  },
  get whatsappApiVersion() {
    return process.env.WHATSAPP_API_VERSION ?? "v23.0";
  },
  /** Hours without a reply before a "no response" reminder fires. */
  get noResponseHours() {
    return Number(process.env.NO_RESPONSE_HOURS ?? 6);
  },
};
