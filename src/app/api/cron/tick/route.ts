import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { runTick } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/**
 * Reminders & escalations tick. Called by Supabase pg_cron (see
 * supabase/migrations/*_cron.sql) or any scheduler, with
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request: NextRequest) {
  const secret = serverEnv.cronSecret;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runTick(getStore(), new Date(), { windowMinutes: Number(request.nextUrl.searchParams.get("window") ?? 15) });
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
