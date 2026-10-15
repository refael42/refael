"use client";
import { unzipSync, strFromU8 } from "fflate";
import { Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { processSourceAction } from "@/app/actions/intel";
import { importChatChunkAction } from "@/app/actions/sources";
import { uploadFile } from "@/components/common/upload";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, TIME_ZONE } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { chatTitleFromFileName, exportMessageKeys, parseWhatsAppExport } from "@/lib/import/whatsapp-export";
import type { IncomingMessage } from "@/lib/services/sources";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  opus: "audio/ogg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  pdf: "application/pdf",
};
const MAX_MEDIA = 300;
const CHUNK = 1000;

/** Text and media of an export: a .txt, or a .zip with the .txt and the attached files. */
async function readExport(file: File): Promise<{ text: string; media: Map<string, Uint8Array> }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!/\.zip$/i.test(file.name)) return { text: new TextDecoder("utf-8").decode(bytes), media: new Map() };
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const txt = names.filter((n) => /\.txt$/i.test(n)).sort((a, b) => files[b].length - files[a].length)[0];
  if (!txt) throw new Error("no txt");
  const media = new Map<string, Uint8Array>();
  for (const n of names) if (n !== txt) media.set(n.replace(/^.*\//, ""), files[n]);
  return { text: strFromU8(files[txt]), media };
}

interface Picked {
  file: File;
  title: string;
  state: "waiting" | "reading" | "analyzing" | "done" | "failed";
  progress?: string;
  added?: number;
  updates?: number;
  sourceId?: string;
}

/**
 * One export → saved messages: parse in the browser, upload attached media,
 * send the messages in chunks. Re-importing a chat adds only what is new.
 */
async function importOne(file: File, title: string, since: string, onProgress: (p: string) => void) {
  onProgress(t.sources.reading);
  const exp = await readExport(file).catch(() => {
    throw new Error(t.sources.badFile);
  });
  const parsed = parseWhatsAppExport(exp.text, { timeZone: TIME_ZONE });
  const said = parsed.messages.filter((m) => m.author);
  if (!said.length) throw new Error(t.sources.empty);
  const keys = exportMessageKeys(said);
  const from = since ? new Date(`${since}T00:00:00`).getTime() : null;
  const wanted = said.map((m, i) => ({ m, key: keys[i] })).filter(({ m }) => from === null || m.sentAt.getTime() >= from);

  // attached files that came in the zip: upload them first, then point the messages at them
  const uploaded = new Map<string, string>();
  const toUpload = wanted
    .map(({ m }) => m.attachment)
    .filter((a): a is string => !!a && exp.media.has(a) && !!MIME[a.split(".").pop()!.toLowerCase()])
    .slice(0, MAX_MEDIA);
  for (let i = 0; i < toUpload.length; i++) {
    onProgress(t.sources.uploadingMedia(i + 1, toUpload.length));
    const name = toUpload[i];
    try {
      const blob = new File([exp.media.get(name)! as BlobPart], name, { type: MIME[name.split(".").pop()!.toLowerCase()] });
      uploaded.set(name, await uploadFile(blob));
    } catch {
      /* a file that fails to upload stays a named attachment */
    }
  }

  const messages: IncomingMessage[] = wanted.map(({ m, key }) => ({
    key,
    sentAt: m.sentAt.toISOString(),
    author: m.author!,
    text: m.text,
    kind: m.kind === "system" ? "text" : m.kind,
    attachment: m.attachment,
    mediaUrl: m.attachment ? uploaded.get(m.attachment) ?? null : null,
  }));
  let added = 0;
  let sourceId = "";
  for (let i = 0; i < Math.max(messages.length, 1); i += CHUNK) {
    onProgress(t.sources.saving(Math.min(i + CHUNK, messages.length), messages.length));
    const res = await importChatChunkAction({
      title,
      isGroup: parsed.participants.length > 2,
      since: from === null ? null : new Date(from).toISOString(),
      messages: messages.slice(i, i + CHUNK),
    });
    if (!res.ok) throw new Error(res.error);
    added += res.data.added;
    sourceId = res.data.sourceId;
  }
  return { sourceId, added };
}

/** Read every waiting message of a chat into updates, batch after batch. */
export async function analyzeSource(sourceId: string, onProgress?: (done: number) => void): Promise<number> {
  let events = 0;
  let done = 0;
  for (;;) {
    const r = await processSourceAction(sourceId);
    if (!r.ok) throw new Error(r.error);
    done += r.data.processed;
    events += r.data.events;
    onProgress?.(done);
    if (!r.data.remaining || !r.data.processed) return events;
  }
}

export function ImportChat() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = (i: number, p: Partial<Picked>) => setPicked((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function go() {
    setBusy(true);
    let chats = 0;
    let updates = 0;
    let last = "";
    try {
      for (let i = 0; i < picked.length; i++) {
        const item = picked[i];
        if (item.state === "done") continue;
        const title = item.title.trim() || chatTitleFromFileName(item.file.name) || item.file.name;
        try {
          patch(i, { state: "reading", progress: undefined });
          const { sourceId, added } = await importOne(item.file, title, since, (p) => patch(i, { progress: p }));
          patch(i, { state: "analyzing", progress: t.sources.fileAnalyzing, sourceId });
          const found = await analyzeSource(sourceId, (n) => patch(i, { progress: t.intel.reading(n, added || n) }));
          patch(i, { state: "done", added, updates: found, progress: undefined });
          chats++;
          updates += found;
          last = sourceId;
        } catch (err) {
          patch(i, { state: "failed", progress: (err as Error).message });
        }
      }
      if (chats) toast.success(t.sources.allDone(chats, updates));
      if (chats === 1 && picked.length === 1) router.push(`/sources/${last}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const pending = picked.filter((x) => x.state !== "done").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.sources.upload}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t.sources.howTo}</p>
        <p className="text-sm text-muted-foreground">{t.sources.multiHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.sources.file}>
            <Input
              id="chat-file"
              type="file"
              multiple
              accept=".txt,.zip,text/plain,application/zip"
              disabled={busy}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                setPicked((list) => [
                  ...list.filter((x) => x.state !== "done"),
                  ...files.map((file) => ({ file, title: chatTitleFromFileName(file.name) ?? "", state: "waiting" as const })),
                ]);
                e.target.value = "";
              }}
            />
          </Field>
          <Field label={t.sources.since}>
            <Input id="chat-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-describedby="chat-since-hint" />
            <span id="chat-since-hint" className="text-xs text-muted-foreground">
              {t.sources.sinceHint}
            </span>
          </Field>
        </div>

        {picked.length > 0 && (
          <div className="flex flex-col divide-y rounded-md border">
            {picked.map((x, i) => (
              <div key={`${x.file.name}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Input
                  aria-label={t.sources.chatName}
                  className="h-8 min-w-0 flex-1 basis-40"
                  placeholder={t.sources.chatName}
                  value={x.title}
                  disabled={busy || x.state === "done"}
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
                <span className="min-w-0 truncate text-xs text-muted-foreground" dir="ltr">
                  {x.file.name}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    x.state === "done" && "text-emerald-700 dark:text-emerald-400",
                    x.state === "failed" && "text-destructive",
                    (x.state === "reading" || x.state === "analyzing") && "text-primary",
                  )}
                >
                  {x.state === "done" ? (
                    <Link href={`/sources/${x.sourceId}`} className="underline-offset-2 hover:underline">
                      {t.sources.fileDone(x.added ?? 0, x.updates ?? 0)}
                    </Link>
                  ) : (
                    x.progress ?? (x.state === "failed" ? t.sources.fileFailed : t.sources.fileWaiting)
                  )}
                </span>
                {!busy && x.state !== "done" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPicked((list) => list.filter((_, j) => j !== i))} aria-label={t.sources.remove}>
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button disabled={!pending || busy} onClick={go}>
            <Upload />
            {t.sources.importAll(pending)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
