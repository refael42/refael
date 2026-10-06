import { getStore } from "@/lib/db";
import type { MemoryStore } from "@/lib/db/memory-store";
import { isSupabaseMode } from "@/lib/env";
import { canSeeConversation } from "@/lib/services/access";
import { sessionOrThrow } from "@/lib/services/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = new Set(["messages", "conversation_participants", "conversations", "tasks", "dependencies", "external_blockers", "completion_reports", "notifications"]);

/**
 * Demo-mode stand-in for Supabase Realtime: a Server-Sent Events stream of
 * change *signals* ({table, type, id, conversation_id}) — never row contents —
 * filtered to what the viewer is allowed to see. Clients refetch on signal.
 */
export async function GET(request: Request) {
  if (isSupabaseMode()) return new Response("use supabase realtime", { status: 404 });
  let s;
  try {
    s = await sessionOrThrow();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const store = getStore() as MemoryStore;
  const encoder = new TextEncoder();

  const visibleConvs = () =>
    new Set(
      store.data.conversations
        .filter((c) => canSeeConversation(s, c, store.data.conversation_participants.filter((p) => p.conversation_id === c.id)))
        .map((c) => c.id),
    );
  let convs = visibleConvs();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send({ type: "hello" });
      const unsubscribe = store.subscribe((e) => {
        if (!TABLES.has(e.table)) return;
        const row = (e.new ?? e.old ?? {}) as Record<string, unknown>;
        if (e.table === "notifications") {
          if (row.profile_id !== s.profile.id) return;
        } else if (e.table === "conversation_participants" || e.table === "conversations") {
          convs = visibleConvs();
          const cid = (row.conversation_id ?? row.id) as string;
          if (!convs.has(cid)) return;
        } else if (e.table === "messages") {
          if (!convs.has(row.conversation_id as string)) return;
        } else if (row.project_id && row.project_id !== s.project.id) {
          return;
        } else if (e.table === "tasks" && s.role === "contractor" && !s.contractorIds.includes(row.contractor_id as string)) {
          return;
        }
        send({ table: e.table, type: e.type, id: row.id ?? null, conversation_id: row.conversation_id ?? null });
      });
      const ping = setInterval(() => send({ type: "ping" }), 25_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
