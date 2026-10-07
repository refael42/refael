"use client";
import { t } from "@/lib/i18n";

/** Upload one file to /api/upload; returns the storage key. */
export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) throw new Error(t.chat.uploadFailed);
  return ((await res.json()) as { key: string }).key;
}
