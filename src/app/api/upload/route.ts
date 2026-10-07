import { NextResponse, type NextRequest } from "next/server";
import { AccessError } from "@/lib/services/auth-types";
import { sessionOrThrow } from "@/lib/services/session";
import { allowedType, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";

/** Multipart upload (field "file"). Returns { key } to attach to a message / report / plan. */
export async function POST(request: NextRequest) {
  try {
    const s = await sessionOrThrow();
    if (s.role === "viewer") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });
    if (!allowedType(file.type)) return NextResponse.json({ error: "type" }, { status: 415 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "size" }, { status: 413 });
    const key = await saveUpload(s.project.id, file);
    return NextResponse.json({ key });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[upload]", e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
