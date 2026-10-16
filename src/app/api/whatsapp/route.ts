import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { handleMirror, splitMirror } from "@/lib/services/wa-mirror";
import { handleWebhook, type WaWebhook } from "@/lib/services/whatsapp";
import { saveBytes } from "@/lib/storage";
import { getWaClient, validSignature } from "@/lib/whatsapp/client";
import { fetchMirrorMedia } from "@/lib/whatsapp/coexistence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Meta's one-time webhook check: echo hub.challenge when the verify token matches. */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const token = serverEnv.whatsappVerifyToken;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token)
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

/** Incoming WhatsApp messages (and delivery statuses, which are ignored). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return new NextResponse("bad signature", { status: 401 });
  let payload: WaWebhook;
  try {
    payload = JSON.parse(raw) as WaWebhook;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const store = getStore();
  // a PM's own number (Coexistence): kept only for followed chats, never answered
  const links = await store.select("whatsapp_links", { where: { status: "connected" } }).catch(() => []);
  const { batches, rest } = splitMirror(payload, new Set(links.map((l) => l.phone_number_id)));
  let mirrored = 0;
  for (const b of batches) {
    try {
      mirrored += (await handleMirror(store, b, new Date(), { fetchMedia: fetchMirrorMedia, saveMedia: saveBytes })).kept;
    } catch (err) {
      console.error("[whatsapp] mirror failed", b.phoneNumberId, err);
    }
  }
  const client = getWaClient();
  if (!client) return NextResponse.json({ ok: true, mirrored, skipped: "not configured" });
  const handled = await handleWebhook(store, rest, { client, saveMedia: saveBytes });
  return NextResponse.json({ ok: true, handled, mirrored });
}
