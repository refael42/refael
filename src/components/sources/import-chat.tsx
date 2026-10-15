"use client";
import { unzipSync, strFromU8 } from "fflate";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { importChatChunkAction } from "@/app/actions/sources";
import { uploadFile } from "@/components/common/upload";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, TIME_ZONE } from "@/lib/i18n";
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

export function ImportChat() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [since, setSince] = useState("");
  const [progress, setProgress] = useState<string | null>(null);

  async function go() {
    if (!file) return;
    try {
      setProgress(t.sources.reading);
      let exp: Awaited<ReturnType<typeof readExport>>;
      try {
        exp = await readExport(file);
      } catch {
        toast.error(t.sources.badFile);
        return;
      }
      const parsed = parseWhatsAppExport(exp.text, { timeZone: TIME_ZONE });
      const said = parsed.messages.filter((m) => m.author);
      if (!said.length) {
        toast.error(t.sources.empty);
        return;
      }
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
        setProgress(t.sources.uploadingMedia(i + 1, toUpload.length));
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
      const chatTitle = title.trim() || chatTitleFromFileName(file.name) || file.name;
      let added = 0;
      let duplicates = 0;
      let sourceId = "";
      for (let i = 0; i < Math.max(messages.length, 1); i += CHUNK) {
        setProgress(t.sources.saving(Math.min(i + CHUNK, messages.length), messages.length));
        const res = await importChatChunkAction({
          title: chatTitle,
          isGroup: parsed.participants.length > 2,
          since: from === null ? null : new Date(from).toISOString(),
          messages: messages.slice(i, i + CHUNK),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        added += res.data.added;
        duplicates += res.data.duplicates;
        sourceId = res.data.sourceId;
      }
      toast.success(t.sources.done(added, duplicates));
      setFile(null);
      setTitle("");
      router.push(`/sources/${sourceId}`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.sources.upload}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t.sources.howTo}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t.sources.file}>
            <Input
              id="chat-file"
              type="file"
              accept=".txt,.zip,text/plain,application/zip"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(chatTitleFromFileName(f.name) ?? "");
              }}
            />
          </Field>
          <Field label={t.sources.chatName}>
            <Input id="chat-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t.sources.since}>
            <Input id="chat-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-describedby="chat-since-hint" />
            <span id="chat-since-hint" className="text-xs text-muted-foreground">
              {t.sources.sinceHint}
            </span>
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={!file || !!progress} onClick={go}>
            <Upload />
            {t.sources.importBtn}
          </Button>
          {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
