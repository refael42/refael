import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { getAdminClient } from "./db";
import { DEMO_UPLOAD_DIR } from "./db/demo-store";
import { isSupabaseMode } from "./env";

const BUCKET = "media";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "application/pdf": "pdf",
};

export function allowedType(type: string) {
  return type in EXT;
}

/** Store a file under media/<projectId>/<uuid>.<ext> and return that key. */
export async function saveUpload(projectId: string, file: File): Promise<string> {
  return saveBytes(projectId, Buffer.from(await file.arrayBuffer()), file.type);
}

export async function saveBytes(projectId: string, bytes: Buffer, type: string): Promise<string> {
  if (!allowedType(type)) throw new Error("unsupported file type");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("file too large");
  const name = `${randomUUID()}.${EXT[type]}`;
  const key = `${BUCKET}/${projectId}/${name}`;
  if (isSupabaseMode()) {
    const { error } = await getAdminClient()!.storage.from(BUCKET).upload(`${projectId}/${name}`, bytes, {
      contentType: type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
  } else {
    const path = demoPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  return key;
}

function demoPath(key: string) {
  const p = normalize(join(DEMO_UPLOAD_DIR, key));
  if (!p.startsWith(DEMO_UPLOAD_DIR)) throw new Error("bad key");
  return p;
}

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

/** Demo: bytes from disk. Supabase: a short-lived signed URL. */
export async function resolveFile(key: string): Promise<{ bytes: Buffer } | { url: string } | null> {
  if (!key.startsWith(`${BUCKET}/`)) return null;
  if (isSupabaseMode()) {
    const { data, error } = await getAdminClient()!.storage.from(BUCKET).createSignedUrl(key.slice(BUCKET.length + 1), 300);
    if (error || !data) return null;
    return { url: data.signedUrl };
  }
  try {
    return { bytes: await readFile(demoPath(key)) };
  } catch {
    return null;
  }
}
