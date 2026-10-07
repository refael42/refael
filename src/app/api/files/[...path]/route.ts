import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/services/session";
import { contentTypeFor, resolveFile } from "@/lib/storage";

/** Serves uploaded media to members of the project that owns it. */
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = params.path.map(decodeURIComponent).join("/");
  const s = await getSession();
  const projectId = params.path[1];
  if (!s || !s.memberships.some((m) => m.project_id === projectId)) return new NextResponse("forbidden", { status: 403 });
  const file = await resolveFile(key);
  if (!file) return new NextResponse("not found", { status: 404 });
  if ("url" in file) return NextResponse.redirect(file.url);
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: { "Content-Type": contentTypeFor(key), "Cache-Control": "private, max-age=3600" },
  });
}
