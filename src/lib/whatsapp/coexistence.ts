/**
 * Graph API calls for connecting a PM's own WhatsApp Business number
 * (Embedded Signup, "Coexistence"): exchange the signup code, read the
 * number, subscribe our app to its account, and ask for contacts + history.
 */
import { serverEnv } from "../env";

export interface CoexGraph {
  exchangeCode(code: string): Promise<string>;
  displayPhone(phoneNumberId: string, token: string): Promise<string | null>;
  subscribe(wabaId: string, token: string): Promise<void>;
  /** "smb_app_state_sync" (contacts) or "history" (up to ~6 months, once) */
  sync(phoneNumberId: string, token: string, type: "smb_app_state_sync" | "history"): Promise<void>;
}

export function coexConfigured(): boolean {
  return !!(serverEnv.metaAppId && serverEnv.metaSignupConfigId && serverEnv.whatsappAppSecret);
}

export function cloudCoexGraph(): CoexGraph {
  const base = `https://graph.facebook.com/${serverEnv.whatsappApiVersion}`;
  async function call(path: string, init: RequestInit & { token?: string } = {}) {
    const res = await fetch(`${base}/${path}`, {
      ...init,
      headers: { ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`graph ${res.status}: ${body.slice(0, 300)}`);
    return body ? (JSON.parse(body) as Record<string, unknown>) : {};
  }
  return {
    async exchangeCode(code) {
      const q = new URLSearchParams({ client_id: serverEnv.metaAppId, client_secret: serverEnv.whatsappAppSecret, code });
      const r = await call(`oauth/access_token?${q}`);
      if (typeof r.access_token !== "string") throw new Error("no access token");
      return r.access_token;
    },
    async displayPhone(id, token) {
      const r = await call(`${id}?fields=display_phone_number`, { token });
      return typeof r.display_phone_number === "string" ? r.display_phone_number : null;
    },
    async subscribe(wabaId, token) {
      await call(`${wabaId}/subscribed_apps`, { method: "POST", token });
    },
    async sync(id, token, type) {
      await call(`${id}/smb_app_data`, { method: "POST", token, body: JSON.stringify({ messaging_product: "whatsapp", sync_type: type }) });
    },
  };
}

/** A media item of a mirrored number, with that number's token. */
export async function fetchMirrorMedia(token: string, mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
  const base = `https://graph.facebook.com/${serverEnv.whatsappApiVersion}`;
  const auth = { Authorization: `Bearer ${token}` };
  const meta = await fetch(`${base}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(8000) });
  if (!meta.ok) throw new Error(`media ${meta.status}`);
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
  const file = await fetch(url, { headers: auth, signal: AbortSignal.timeout(15000) });
  if (!file.ok) throw new Error(`media file ${file.status}`);
  return { bytes: Buffer.from(await file.arrayBuffer()), mime: mime_type };
}
