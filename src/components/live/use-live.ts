"use client";
import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export interface LiveEvent {
  table: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  conversation_id: string | null;
}
type Listener = (e: LiveEvent) => void;

// One shared EventSource for the whole tab (demo mode).
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function ensureSource() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/live");
  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (!data.table) return;
      for (const l of listeners) l(data as LiveEvent);
    } catch {
      /* ignore */
    }
  };
  source.onerror = () => {
    // EventSource reconnects by itself; if the server closed for good, reset.
    if (source?.readyState === EventSource.CLOSED) source = null;
  };
}

/**
 * Subscribe to change signals for the given tables. Uses Supabase Realtime
 * (RLS-filtered postgres_changes) when configured, otherwise the demo SSE feed.
 */
export function useLive(tables: string[], projectId: string, onEvent: Listener) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const key = tables.join(",");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (supabase) {
      let channel = supabase.channel(`live:${projectId}:${key}:${Math.random().toString(36).slice(2)}`);
      for (const table of key.split(",")) {
        const filter = ["messages", "tasks", "dependencies", "external_blockers"].includes(table) ? `project_id=eq.${projectId}` : undefined;
        channel = channel.on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) } as never,
          (payload: { eventType: LiveEvent["type"]; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            const row = Object.keys(payload.new ?? {}).length ? payload.new : payload.old;
            cb.current({
              table,
              type: payload.eventType,
              id: (row?.id as string) ?? null,
              conversation_id: (row?.conversation_id as string) ?? null,
            });
          },
        );
      }
      channel.subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
    const wanted = new Set(key.split(","));
    const l: Listener = (e) => wanted.has(e.table) && cb.current(e);
    listeners.add(l);
    ensureSource();
    return () => {
      listeners.delete(l);
    };
  }, [key, projectId]);
}
