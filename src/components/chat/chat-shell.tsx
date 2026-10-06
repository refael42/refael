"use client";
import { Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { startDirectAction } from "@/app/actions/chat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MemberRole } from "@/lib/db/types";
import { fmtChatTime, t } from "@/lib/i18n";
import type { ConversationListItem } from "@/lib/services/chat";
import { cn, initials } from "@/lib/utils";

export function ChatShell({
  conversations,
  people,
  children,
}: {
  conversations: ConversationListItem[];
  people: Array<{ id: string; name: string; role: MemberRole }>;
  children: React.ReactNode;
}) {
  const active = useSelectedLayoutSegment();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.5rem)] lg:h-[calc(100dvh-3.5rem)]">
      <aside className={cn("flex w-full flex-col border-e lg:w-80 lg:shrink-0", active && "hidden lg:flex")}>
        <div className="flex items-center justify-between border-b p-3">
          <h1 className="font-semibold">{t.chat.conversations}</h1>
          {people.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus />
              {t.chat.newConversation}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t.chat.noConversations}</p>}
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={cn("flex items-center gap-3 border-b px-3 py-3 transition-colors hover:bg-accent", active === c.id && "bg-accent")}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  c.type === "group" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {c.type === "group" ? <Users className="h-5 w-5" /> : initials(c.title)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.title}</span>
                  <span className={cn("shrink-0 text-xs", c.unread ? "font-semibold text-state-ready" : "text-muted-foreground")}>
                    {c.lastAt ? fmtChatTime(c.lastAt) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">{c.lastText || c.subtitle}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.pendingAi > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">
                        <Sparkles className="h-3 w-3" />
                        {c.pendingAi}
                      </span>
                    )}
                    {c.unread > 0 && (
                      <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-state-ready px-1 text-[11px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
      <section className={cn("min-w-0 flex-1", !active && "hidden lg:block")}>{children}</section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.chat.startDirect}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col overflow-y-auto">
            {people.map((p) => (
              <form key={p.id} action={startDirectAction.bind(null, p.id)}>
                <button type="submit" className="flex w-full items-center gap-3 rounded-md p-2 text-start hover:bg-accent" onClick={() => setOpen(false)}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">{initials(p.name)}</span>
                  <span className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{t.roles[p.role]}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
