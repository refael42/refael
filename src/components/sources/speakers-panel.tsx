"use client";
import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteSourceAction, setSpeakerAction } from "@/app/actions/sources";
import { OptionSelect } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const IGNORE = "__ignore__";

export function SpeakersPanel({
  sourceId,
  speakers,
  people,
  canEdit,
}: {
  sourceId: string;
  speakers: Array<{ author: string; profileId: string | null; ignore: boolean; auto: boolean; count: number }>;
  people: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const { call, pending } = useAction();
  const options = [...people.map((p) => ({ value: p.id, label: p.name })), { value: IGNORE, label: t.sources.ignore }];
  const save = (author: string, v: string | null) =>
    call(() => setSpeakerAction(sourceId, author, v === IGNORE ? { profileId: null, ignore: true } : { profileId: v }), t.app.saved);
  return (
    <div className="flex flex-col rounded-lg border">
      {speakers.map((sp) => (
        <div key={sp.author} className="flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-b-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <bdi className="truncate text-sm font-medium">{sp.author}</bdi>
            <span className="text-xs text-muted-foreground">{t.sources.count(sp.count)}</span>
          </div>
          {sp.auto && !sp.ignore && <Badge variant="outline">{t.sources.autoGuess}</Badge>}
          {canEdit ? (
            <>
              <OptionSelect
                className="h-8 w-48"
                value={sp.ignore ? IGNORE : sp.profileId}
                onChange={(v) => save(sp.author, v)}
                options={options}
                noneLabel={t.sources.unknownPerson}
              />
              {sp.auto && sp.profileId && !sp.ignore && (
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={pending} onClick={() => save(sp.author, sp.profileId)} aria-label={t.app.save} title={t.app.save}>
                  <Check />
                </Button>
              )}
            </>
          ) : (
            <span className="text-sm">{sp.ignore ? t.sources.ignore : people.find((p) => p.id === sp.profileId)?.name ?? t.sources.unknownPerson}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DeleteSource({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const { call, pending } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm(t.sources.deleteConfirm)) return;
        const ok = await call(() => deleteSourceAction(sourceId), t.app.saved);
        if (ok !== null) router.push("/sources");
      }}
    >
      <Trash2 />
      {t.sources.deleteSource}
    </Button>
  );
}
