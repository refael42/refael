import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/db";
import { getSession } from "@/lib/services/session";

/** Save (POST) or remove (DELETE) this browser's push subscription. */
export async function POST(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth || !/^https:\/\//.test(body.endpoint))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const store = getStore();
  await store.remove("push_subscriptions", { endpoint: body.endpoint });
  await store.insert("push_subscriptions", {
    profile_id: s.profile.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (endpoint) await getStore().remove("push_subscriptions", { endpoint, profile_id: s.profile.id });
  return NextResponse.json({ ok: true });
}
