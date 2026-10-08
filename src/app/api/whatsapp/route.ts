import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { handleWebhook, type WaWebhook } from "@/lib/services/whatsapp";
import { saveBytes } from "@/lib/storage";
import { getWaClient, validSignature } from "@/lib/whatsapp/client";

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
  const client = getWaClient();
  if (!client) return NextResponse.json({ ok: true, skipped: "not configured" });
  let payload: WaWebhook;
  try {
    payload = JSON.parse(raw) as WaWebhook;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const handled = await handleWebhook(getStore(), payload, { client, saveMedia: saveBytes });
  return NextResponse.json({ ok: true, handled });
}
