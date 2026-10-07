"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLive } from "./use-live";

/**
 * Keeps every server-rendered screen live: any change to the graph, reports,
 * notifications or chat triggers a (debounced) re-render of the current route.
 */
export function LiveRefresh({ projectId }: { projectId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLive(
    ["tasks", "dependencies", "external_blockers", "completion_reports", "notifications", "messages", "conversation_participants"],
    projectId,
    () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    },
  );
  return null;
}
