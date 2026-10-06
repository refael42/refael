"use client";
import { ArrowRight, Camera, Check, CheckCheck, Loader2, Mic, Send, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { analyzeMessageAction } from "@/app/actions/ai";
import { markReadAction, sendMessageAction } from "@/app/actions/chat";
import { ReportDoneButton } from "@/components/completion/report-done-button";
import type { TaskFormOptions } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MemberRole } from "@/lib/db/types";
import { fmtDay, fmtTime, t } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import type { ConversationVM, MessageVM } from "@/lib/services/chat";
import { cn } from "@/lib/utils";
import { AiCard } from "./ai-card";

export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) throw new Error(t.chat.uploadFailed);
  return ((await res.json()) as { key: string }).key;
}

export function ChatRoom({
  conversation,
  me,
  options,
  taskOptions,
}: {
  conversation: ConversationVM;
  me: { id: string; role: MemberRole };
  options: TaskFormOptions | null;
  taskOptions: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<MessageVM[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);
  const canWrite = me.role !== "viewer" || conversation.isParticipant;

  const messages = [...conversation.messages, ...pending.filter((p) => !conversation.messages.some((m) => m.id === p.id))];
  const lastId = conversation.messages.at(-1)?.id;

  // Read receipts: mark read whenever new messages arrive while the room is open.
  useEffect(() => {
    if (!conversation.isParticipant) return;
    void markReadAction(conversation.id);
  }, [conversation.id, lastId, conversation.isParticipant]);

  useEffect(() => setPending([]), [lastId]);

  // Live updates (new messages, read receipts) arrive via <LiveRefresh/> in the app layout.

  useLayoutEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const target = hash.startsWith("#m-") ? document.getElementById(hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("ring-2", "ring-primary");
    } else listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(input: { text?: string; kind?: "text" | "image" | "voice"; mediaUrl?: string }) {
    setSending(true);
    const temp: MessageVM = {
      id: `tmp-${Date.now()}`,
      kind: input.kind ?? "text",
      text: input.text ?? null,
      mediaUrl: input.mediaUrl ?? null,
      createdAt: new Date().toISOString(),
      senderId: me.id,
      senderName: "",
      mine: true,
      readByAll: false,
      aiStatus: "none",
      ai: null,
      meta: null,
    };
    setPending((p) => [...p, temp]);
    const res = await sendMessageAction(conversation.id, input);
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      setPending((p) => p.filter((x) => x.id !== temp.id));
      return false;
    }
    router.refresh();
    // AI parsing runs after the send so the message shows up immediately;
    // the suggestion card appears when it finishes (live refresh).
    if (temp.kind === "text") void analyzeMessageAction(res.data.id).then(() => router.refresh());
    return true;
  }

  async function onFile(file: File | undefined, kind: "image" | "voice") {
    if (!file) return;
    try {
      setSending(true);
      const key = await uploadFile(file);
      await send({ kind, mediaUrl: key });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[hsl(40_33%_97%)] dark:bg-background">
      <header className="flex items-center gap-3 border-b bg-background px-3 py-2">
        <Link href="/chat" className="rounded-full p-1 hover:bg-accent lg:hidden" aria-label={t.app.back}>
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{conversation.title}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {conversation.type === "group" && <Users className="h-3 w-3" />}
            {conversation.participants.map((p) => p.name).join(", ")}
          </span>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.chat.empty}</p>}
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || fmtDay(prev.createdAt) !== fmtDay(m.createdAt);
            const showName = conversation.type === "group" && !m.mine && m.kind !== "system" && (newDay || prev?.senderId !== m.senderId);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="my-2 self-center rounded-full bg-background px-3 py-0.5 text-xs text-muted-foreground shadow-sm">{fmtDay(m.createdAt)}</div>
                )}
                {m.kind === "system" ? (
                  <SystemMessage m={m} meId={me.id} />
                ) : (
                  <Bubble m={m} showName={showName} />
                )}
                {m.ai && m.ai.intent !== "none" && (m.aiStatus === "suggested" || m.aiStatus === "accepted") && (
                  <AiCard
                    messageId={m.id}
                    ai={m.ai}
                    status={m.aiStatus}
                    mine={m.mine}
                    isPM={me.role === "pm"}
                    options={options}
                    taskOptions={taskOptions}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {canWrite && (
        <form
          className="flex items-end gap-2 border-t bg-background p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = text.trim();
            if (!v) return;
            setText("");
            const ok = await send({ text: v });
            if (!ok) setText(v);
          }}
        >
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0], "image")} />
          <input ref={voiceRef} type="file" accept="audio/*" hidden onChange={(e) => onFile(e.target.files?.[0], "voice")} />
          <Button type="button" variant="ghost" size="icon" onClick={() => photoRef.current?.click()} aria-label={t.chat.attachPhoto} disabled={sending}>
            <Camera className="!size-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => voiceRef.current?.click()} aria-label={t.chat.attachVoice} disabled={sending}>
            <Mic className="!size-5" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t.chat.typeMessage}
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl"
          />
          <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={sending || !text.trim()} aria-label={t.app.send}>
            {sending ? <Loader2 className="animate-spin" /> : <Send className="-scale-x-100" />}
          </Button>
        </form>
      )}
    </div>
  );
}

function Bubble({ m, showName }: { m: MessageVM; showName: boolean }) {
  const temp = m.id.startsWith("tmp-");
  return (
    <div id={`m-${m.id}`} className={cn("flex max-w-[85%] flex-col rounded-2xl px-3 py-1.5 shadow-sm", m.mine ? "self-end rounded-se-sm bg-emerald-100 dark:bg-emerald-900/40" : "self-start rounded-ss-sm bg-background")}>
      {showName && <span className="text-xs font-semibold text-primary">{m.senderName}</span>}
      {m.kind === "image" && m.mediaUrl && (
        <a href={mediaSrc(m.mediaUrl)} target="_blank" rel="noreferrer" className="my-1">
          <img src={mediaSrc(m.mediaUrl)} alt="" className="max-h-64 rounded-lg object-cover" />
        </a>
      )}
      {m.kind === "voice" && m.mediaUrl && <audio controls src={mediaSrc(m.mediaUrl)} className="my-1 max-w-full" />}
      {m.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>}
      <span className="flex items-center gap-1 self-end text-[10px] text-muted-foreground">
        {fmtTime(m.createdAt)}
        {m.mine &&
          (temp ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : m.readByAll ? (
            <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label={t.chat.read} />
          ) : (
            <Check className="h-3.5 w-3.5" aria-label={t.chat.delivered} />
          ))}
      </span>
    </div>
  );
}

function SystemMessage({ m, meId }: { m: MessageVM; meId: string }) {
  const forMe = m.meta?.action === "request_photo" && m.meta.for_profile_id === meId && typeof m.meta.task_id === "string";
  return (
    <div id={`m-${m.id}`} className="my-1 flex max-w-[90%] flex-col items-center gap-2 self-center rounded-lg bg-sky-50 px-3 py-2 text-center text-sm text-sky-900 shadow-sm dark:bg-sky-950 dark:text-sky-100">
      <span>{m.text}</span>
      {m.meta?.task_id && typeof m.meta.task_id === "string" && (
        <Link href={`/tasks/${m.meta.task_id}`} className="text-xs underline">
          {t.chat.linkedTask}
        </Link>
      )}
      {forMe && <ReportDoneButton taskId={m.meta!.task_id as string} taskTitle="" sourceMessageId={(m.meta!.source_message_id as string) ?? null} />}
      <span className="text-[10px] text-sky-700/70">{fmtTime(m.createdAt)}</span>
    </div>
  );
}
