/**
 * WhatsApp Cloud API (Meta Graph API) — the few calls SiteFlow needs.
 * Outside the 24h customer-service window only an approved template may be
 * sent; inside it free text and media are allowed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "../env";

export interface WaClient {
  sendText(to: string, text: string): Promise<void>;
  /** the approved template (one body variable) */
  sendTemplate(to: string, text: string): Promise<void>;
  /** image / audio / document by a public (signed) URL */
  sendMedia(to: string, type: "image" | "audio" | "document", url: string, caption?: string | null): Promise<void>;
  /** download an inbound media item */
  fetchMedia(mediaId: string): Promise<{ bytes: Buffer; mime: string }>;
}

export function whatsappConfigured(): boolean {
  return Boolean(serverEnv.whatsappToken && serverEnv.whatsappPhoneNumberId && serverEnv.whatsappAppSecret && serverEnv.whatsappVerifyToken);
}

let override: WaClient | null | undefined;

/** Tests swap in a fake client. */
export function setWaClient(c: WaClient | null | undefined) {
  override = c;
}

export function getWaClient(): WaClient | null {
  if (override !== undefined) return override;
  return whatsappConfigured() ? cloudClient() : null;
}

/** +972501234567 / 050-1234567 → 972501234567 (the API wants digits only). */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? `972${d.slice(1)}` : d;
}

/** Template variables may not contain new lines, tabs or more than 4 spaces in a row. */
export function templateParam(text: string, max = 900): string {
  const one = text.replace(/\s*\n+\s*/g, " · ").replace(/\t/g, " ").replace(/ {4,}/g, "   ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one || "-";
}

/** Meta signs every webhook POST with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export function validSignature(rawBody: string, header: string | null, secret = serverEnv.whatsappAppSecret): boolean {
  if (!header?.startsWith("sha256=") || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function cloudClient(): WaClient {
  const base = `https://graph.facebook.com/${serverEnv.whatsappApiVersion}`;
  const auth = { Authorization: `Bearer ${serverEnv.whatsappToken}` };

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`${base}/${serverEnv.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`whatsapp ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  return {
    sendText: (to, text) => post({ to: waNumber(to), type: "text", text: { body: text.slice(0, 4096), preview_url: false } }),
    sendTemplate: (to, text) =>
      post({
        to: waNumber(to),
        type: "template",
        template: {
          name: serverEnv.whatsappTemplate,
          language: { code: serverEnv.whatsappTemplateLang },
          components: [{ type: "body", parameters: [{ type: "text", text: templateParam(text) }] }],
        },
      }),
    sendMedia: (to, type, url, caption) =>
      post({ to: waNumber(to), type, [type]: { link: url, ...(caption && type !== "audio" ? { caption: caption.slice(0, 1024) } : {}) } }),
    async fetchMedia(mediaId) {
      const meta = await fetch(`${base}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(8000) });
      if (!meta.ok) throw new Error(`whatsapp media ${meta.status}`);
      const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
      const file = await fetch(url, { headers: auth, signal: AbortSignal.timeout(20000) });
      if (!file.ok) throw new Error(`whatsapp media download ${file.status}`);
      return { bytes: Buffer.from(await file.arrayBuffer()), mime: mime_type.split(";")[0].trim() };
    },
  };
}
