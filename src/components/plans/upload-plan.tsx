"use client";
import { FilePlus2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createPlanAction } from "@/app/actions/plans";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { uploadFile } from "@/components/common/upload";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { readPdfText } from "./pdf-text";

/**
 * Upload a plan PDF — or, with `supersedesId`, a new version of one. The
 * text is read in the browser first, so the server can tell the discipline,
 * sheet, revision and apartments without any paid service.
 */
export function UploadPlan({ floors = [], supersedesId }: { floors?: Option[]; supersedesId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [floor, setFloor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { call } = useAction();
  const isVersion = !!supersedesId;

  async function save() {
    if (!file) return;
    try {
      setBusy(t.plans.reading);
      // a PDF without text (a scan) is still a plan: just nothing to read
      const read = await readPdfText(file).catch(() => ({ text: "", pages: null }));
      setBusy(t.plans.uploading);
      const key = await uploadFile(file);
      const id = await call(
        () =>
          createPlanAction({
            title: title || (isVersion ? "" : file.name.replace(/\.pdf$/i, "")),
            fileKey: key,
            floorAreaId: floor,
            text: read.text,
            pageCount: read.pages,
            supersedesId: supersedesId ?? null,
            changeNote: note || null,
          }),
        t.app.saved,
      );
      if (id) {
        setOpen(false);
        router.push(`/plans/${id}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button size={isVersion ? "sm" : "default"} variant={isVersion ? "outline" : "default"} onClick={() => setOpen(true)}>
        {isVersion ? <FilePlus2 /> : <Upload />}
        {isVersion ? t.plans.newVersion : t.plans.upload}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isVersion ? t.plans.newVersion : t.plans.upload}</DialogTitle>
          </DialogHeader>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            {file ? file.name : t.plans.upload}
          </Button>
          {isVersion ? (
            <Field label={t.plans.changeNote}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label={t.plans.uploadTitle}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              {floors.length > 0 && (
                <Field label={t.plans.floor}>
                  <OptionSelect value={floor} onChange={setFloor} options={floors} noneLabel={t.app.none} />
                </Field>
              )}
            </>
          )}
          <DialogFooter className="items-center">
            {busy && <span className="text-sm text-muted-foreground">{busy}</span>}
            <Button disabled={!file || !!busy} onClick={save}>
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
