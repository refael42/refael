"use client";
import { Camera, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { submitReportAction } from "@/app/actions/completion";
import { uploadFile } from "@/components/common/upload";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Done + photo": the contractor's one-tap completion report. */
export function ReportDoneButton({
  taskId,
  taskTitle,
  sourceMessageId = null,
  size = "default",
  className,
}: {
  taskId: string;
  taskTitle: string;
  sourceMessageId?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Array<{ key: string; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { call, pending } = useAction();

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const key = await uploadFile(f);
        setPhotos((p) => [...p, { key, preview: URL.createObjectURL(f) }]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function submit() {
    const ok = await call(
      () => submitReportAction({ taskId, photoKeys: photos.map((p) => p.key), note, sourceMessageId }),
      t.completion.submitted,
    );
    if (ok) {
      setOpen(false);
      setPhotos([]);
      setNote("");
    }
  }

  return (
    <>
      <Button
        size={size}
        variant="success"
        className={className}
        onClick={() => {
          setOpen(true);
          // open the camera straight away on phones
          setTimeout(() => input.current?.click(), 50);
        }}
      >
        <Camera />
        {t.tasks.reportDone}
      </Button>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => add(e.target.files)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.completion.title}</DialogTitle>
            {taskTitle && <DialogDescription>{taskTitle}</DialogDescription>}
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.key} className="relative">
                <img src={p.preview} alt="" className="aspect-square w-full rounded-md object-cover" />
                <button
                  type="button"
                  className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  onClick={() => setPhotos((x) => x.filter((y) => y.key !== p.key))}
                  aria-label={t.app.delete}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground", uploading && "opacity-60")}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              {t.completion.addPhoto}
            </button>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${t.completion.note} ${t.app.optional}`} rows={2} />
          <DialogFooter>
            <Button size="lg" variant="success" className="w-full" disabled={pending || uploading || photos.length === 0} onClick={submit}>
              <CheckCircle2 />
              {t.completion.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
