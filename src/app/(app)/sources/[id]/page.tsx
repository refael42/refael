import { ArrowRight, Paperclip } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkUpdate, MarkUpdateOptions } from "@/components/intel/mark-update";
import { ReadMessages } from "@/components/intel/read-messages";
import {
  DeleteSource,
  SpeakersPanel,
} from "@/components/sources/speakers-panel";
import { Badge } from "@/components/ui/badge";
import { getStore } from "@/lib/db";
import { fmtDate, fmtDateTime, t } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { requireProjectSession } from "@/lib/services/session";
import { sourceDetail } from "@/lib/services/sources";

export const metadata = { title: t.sources.title };

const STATUS = {
  new: t.sources.statusNew,
  processed: t.sources.statusProcessed,
  skipped: t.sources.statusSkipped,
  error: t.sources.statusNew,
} as const;

export default async function SourcePage({
  params,
}: {
  params: { id: string };
}) {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const d = await sourceDetail({ store: getStore(), s }, params.id);
  const nameOf = new Map(d.people.map((p) => [p.id, p.name]));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <Link
        href="/sources"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        {t.sources.title}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">{d.source.title}</h1>
          <span className="text-sm text-muted-foreground">
            {d.source.is_group ? t.sources.group : t.sources.direct} ·{" "}
            {t.sources.messages(d.total)}
            {d.source.since
              ? ` · ${t.sources.since} ${fmtDate(d.source.since)}`
              : ""}
            {d.source.last_import_at
              ? ` · ${t.sources.lastImport} ${fmtDateTime(d.source.last_import_at)}`
              : ""}
          </span>
        </div>
        {d.canEdit && <DeleteSource sourceId={d.source.id} />}
      </div>

      {d.canEdit && (
        <ReadMessages
          sourceId={d.source.id}
          waiting={d.items.length ? d.waiting : 0}
          processed={d.processed}
        />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t.sources.speakers}</h2>
        <p className="text-sm text-muted-foreground">
          {t.sources.speakersHint}
        </p>
        <SpeakersPanel
          sourceId={d.source.id}
          speakers={d.speakers}
          people={d.people}
          canEdit={d.canEdit}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t.sources.recent}</h2>
          <span className="text-xs text-muted-foreground">
            {t.sources.showing(d.items.length, d.total)}
          </span>
        </div>
        <MarkUpdateOptions
          areas={d.areas.map((a) => ({ value: a.id, label: a.name }))}
          contractors={d.contractors.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          defaultContractorId={d.defaultContractorId}
        >
          <div className="flex flex-col rounded-lg border">
            {d.items.map((it) => (
              <div
                key={it.id}
                className="flex flex-col gap-0.5 border-b px-3 py-2 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <bdi className="font-medium text-foreground">
                    {(it.author_profile_id &&
                      nameOf.get(it.author_profile_id)) ||
                      it.author}
                  </bdi>
                  <span className="num">{fmtDateTime(it.sent_at)}</span>
                  {it.status !== "new" && (
                    <Badge variant="outline">{STATUS[it.status]}</Badge>
                  )}
                </div>
                {it.text && (
                  <p className="whitespace-pre-wrap text-sm">{it.text}</p>
                )}
                {d.canEdit && it.text && it.status !== "skipped" && (
                  <MarkUpdate itemId={it.id} text={it.text} />
                )}
                {it.media_name &&
                  (it.media_url ? (
                    it.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaSrc(it.media_url)}
                        alt={it.media_name}
                        className="max-h-48 w-auto self-start rounded border"
                        loading="lazy"
                      />
                    ) : (
                      <a
                        href={mediaSrc(it.media_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-sm text-primary"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {it.media_name}
                      </a>
                    )
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      {t.sources.mediaMissing}: {it.media_name}
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </MarkUpdateOptions>
      </section>
    </div>
  );
}
