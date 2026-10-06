"use client";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, MapPinPlus, MessageCircle, Trash2, UserRound, X, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addPinAction, deletePinAction } from "@/app/actions/plans";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { STATE_HEX, StateBadge } from "@/components/tasks/state-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { fmtDateTime, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PinAreaVM, PinVM } from "./types";

const PdfCanvas = dynamic(() => import("./pdf-canvas"), { ssr: false });

export function PlanViewer({
  planId,
  url,
  pins,
  areas,
  areaOptions,
  canEdit,
  initialPin,
}: {
  planId: string;
  url: string;
  pins: PinVM[];
  areas: Record<string, PinAreaVM>;
  areaOptions: Option[];
  canEdit: boolean;
  initialPin: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(() => pins.find((p) => p.id === initialPin)?.page ?? 1);
  const [pages, setPages] = useState(1);
  const [pinMode, setPinMode] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftArea, setDraftArea] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [selected, setSelected] = useState<string | null>(initialPin);
  const { call, pending } = useAction();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, el.clientWidth - 16)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sel = pins.find((p) => p.id === selected);
  const selArea = sel?.areaId ? areas[sel.areaId] : null;

  function onClickPage(e: React.MouseEvent<HTMLDivElement>) {
    if (!pinMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    setDraftArea(null);
    setDraftLabel("");
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t.plans.prev}>
          <ChevronRight />
        </Button>
        <span className="num text-sm">{t.plans.page(page, pages)}</span>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t.plans.next}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label={t.plans.zoomOut}>
          <ZoomOut />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label={t.plans.zoomIn}>
          <ZoomIn />
        </Button>
        {canEdit && (
          <Button variant={pinMode ? "default" : "outline"} size="sm" onClick={() => setPinMode((m) => !m)}>
            <MapPinPlus />
            {t.plans.pinMode}
          </Button>
        )}
        {pinMode && <span className="text-xs text-muted-foreground">{t.plans.pinHint}</span>}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div ref={box} className="min-w-0 flex-1 overflow-auto bg-muted/40 p-2">
          <div dir="ltr" className="relative mx-auto w-fit shadow-md" style={{ cursor: pinMode ? "crosshair" : "default" }} onClick={onClickPage}>
            <PdfCanvas url={url} page={page} width={width * zoom} onLoad={setPages} />
            {pins
              .filter((p) => p.page === page)
              .map((p) => {
                const area = p.areaId ? areas[p.areaId] : null;
                const color = area?.worst ? STATE_HEX[area.worst] : "#64748b";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(p.id);
                    }}
                    className={cn("absolute flex -translate-x-1/2 -translate-y-full flex-col items-center", selected === p.id && "z-10 scale-125")}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    aria-label={p.label ?? area?.name ?? ""}
                  >
                    <span dir="rtl" className="mb-0.5 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold shadow" style={{ color }}>
                      {p.label ?? area?.name}
                    </span>
                    <MapPin className="h-7 w-7 drop-shadow" style={{ color }} fill={color} stroke="white" />
                  </button>
                );
              })}
            {draft && (
              <span className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}>
                <MapPin className="h-7 w-7 text-primary" fill="currentColor" stroke="white" />
              </span>
            )}
          </div>
        </div>

        {sel && (
          <aside className="absolute inset-x-2 bottom-2 z-20 max-h-[60%] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg md:static md:inset-auto md:max-h-none md:w-96 md:rounded-none md:border-y-0 md:border-e-0 md:shadow-none">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{selArea?.name ?? sel.label}</h3>
                {selArea && <p className="text-xs text-muted-foreground">{selArea.path}</p>}
              </div>
              <button onClick={() => setSelected(null)} aria-label={t.app.close}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {selArea ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t.overview.doneOf(selArea.done, selArea.total)}</span>
                  <Progress value={selArea.total ? (selArea.done / selArea.total) * 100 : 0} />
                </div>
                <span className="text-sm font-semibold">{t.plans.areaPanel}</span>
                {selArea.tasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="flex flex-col gap-1 rounded-md border p-2 text-sm hover:bg-accent">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium">{task.title}</span>
                      <StateBadge state={task.state} />
                    </span>
                    {task.contractor && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UserRound className="h-3 w-3" />
                        {task.contractor}
                      </span>
                    )}
                    {task.reason && <span className="text-xs text-state-blocked">{task.reason}</span>}
                  </Link>
                ))}
                {selArea.messages.length > 0 && (
                  <>
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <MessageCircle className="h-4 w-4" />
                      {t.area.relatedMessages}
                    </span>
                    {selArea.messages.map((m) => (
                      <Link key={m.id} href={`/chat/${m.conversationId}#m-${m.id}`} className="rounded-md border p-2 text-sm hover:bg-accent">
                        <span className="block text-xs text-muted-foreground">
                          {m.sender} · {fmtDateTime(m.at)}
                        </span>
                        {m.text}
                      </Link>
                    ))}
                  </>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/areas/${selArea.id}`}>
                    <ExternalLink />
                    {t.app.open}
                  </Link>
                </Button>
              </div>
            ) : null}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-destructive"
                disabled={pending}
                onClick={async () => {
                  const ok = await call(() => deletePinAction(sel.id), t.app.saved);
                  if (ok !== null) setSelected(null);
                }}
              >
                <Trash2 />
                {t.plans.deletePin}
              </Button>
            )}
          </aside>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.plans.choseArea}</DialogTitle>
          </DialogHeader>
          <Field label={t.tasks.area}>
            <OptionSelect value={draftArea} onChange={setDraftArea} options={areaOptions} placeholder={t.tasks.area} />
          </Field>
          <Field label={`${t.plans.pinLabel} ${t.app.optional}`}>
            <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !draftArea}
              onClick={async () => {
                if (!draft) return;
                const id = await call(() => addPinAction({ planId, page, x: draft.x, y: draft.y, areaId: draftArea, label: draftLabel || null }), t.plans.pinSaved);
                if (id) {
                  setDraft(null);
                  setSelected(id);
                }
              }}
            >
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
