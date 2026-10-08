import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

// reachable without the site password: the gate itself, the scheduler (has its own secret), robots,
// and personal login links (the one-time token is the secret; a valid one also opens the gate)
const GATE_OPEN = ["/gate", "/api/cron", "/robots.txt", "/auth/link"];
const PUBLIC = ["/gate", "/robots.txt", "/login", "/auth", "/api/cron", "/manifest.webmanifest", "/sw.js", "/offline.html", "/icons", "/demo", "/pdf.worker"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // optional site-wide password: without it nothing is visible, not even the login screen
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && !GATE_OPEN.some((p) => pathname.startsWith(p))) {
    const ok = request.cookies.get(GATE_COOKIE)?.value === (await gateToken(sitePassword));
    if (!ok) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "locked" }, { status: 401 });
      const gate = request.nextUrl.clone();
      gate.pathname = "/gate";
      gate.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(gate);
    }
  }

  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });
  let authed: boolean;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authed = Boolean(data.user);
  } else {
    authed = Boolean(request.cookies.get("sf_demo_profile")?.value);
  }

  if (!authed && !isPublic) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|pdf|mjs)$).*)"],
};
