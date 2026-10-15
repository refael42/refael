import { Inbox, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportChat } from "@/components/sources/import-chat";
import { ReadAll } from "@/components/sources/read-all";
import { Badge } from "@/components/ui/badge";
import { getStore } from "@/lib/db";
import { fmtDateTime, t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { listSources } from "@/lib/services/sources";

export const metadata = { title: t.sources.title };

export default async function SourcesPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const sources = await listSources({ store: getStore(), s });
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t.sources.title}</h1>
        <p className="text-sm text-muted-foreground">{t.sources.hint}</p>
      </div>
      {isPM(s) && <ImportChat />}
      {isPM(s) && <ReadAll sources={sources.map((x) => ({ id: x.id, title: x.title, waiting: x.waiting }))} />}
      {sources.length === 0 && <p className="py-10 text-center text-muted-foreground">{t.sources.none}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((src) => (
          <Link key={src.id} href={`/sources/${src.id}`} className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent">
            {src.isGroup ? <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-medium">{src.title}</span>
              <span className="text-xs text-muted-foreground">
                {src.isGroup ? t.sources.group : t.sources.direct} · {t.sources.messages(src.messages)}
                {src.lastMessageAt ? ` · ${fmtDateTime(src.lastMessageAt)}` : ""}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {src.waiting > 0 && <Badge variant="secondary">{t.sources.waiting(src.waiting)}</Badge>}
                {src.unknownSpeakers > 0 && <Badge variant="outline">{t.sources.unknown(src.unknownSpeakers)}</Badge>}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
