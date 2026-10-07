"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Call a server action with pending state, error toast and refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function call<T>(fn: () => Promise<Result<T>>, success?: string | ((data: T) => string | null)): Promise<T | null> {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      const msg = typeof success === "function" ? success(res.data) : success;
      if (msg) toast.success(msg);
      startTransition(() => router.refresh());
      return res.data;
    } finally {
      setBusy(false);
    }
  }
  return { call, pending: pending || busy };
}
