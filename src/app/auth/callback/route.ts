import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Magic-link / OAuth return URL: exchange the code for a session cookie. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) await createSupabaseServerClient().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL("/", request.url));
}
