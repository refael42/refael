import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { writeXlsx } from "@/lib/export/xlsx";
import { AccessError } from "@/lib/services/auth-types";
import { buildPlanExport } from "@/lib/services/export-plan";
import { sessionOrThrow } from "@/lib/services/session";
import { loadSnapshot } from "@/lib/services/snapshot";

export const dynamic = "force-dynamic";

/** The current project's work plan as .xlsx (managers and viewers). */
export async function GET() {
  try {
    const s = await sessionOrThrow();
    if (s.role === "contractor") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const snap = await loadSnapshot(getStore(), s.project.id);
    const { fileName, sheets } = buildPlanExport(snap);
    return new Response(Buffer.from(writeXlsx(sheets)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="siteflow.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[export]", e);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}
