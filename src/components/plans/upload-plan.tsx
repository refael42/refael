"use client";
import { Upload } from "lucide-react";
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

export function UploadPlan({ floors }: { floors: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [floor, setFloor] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { call } = useAction();

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      const key = await uploadFile(file);
      const id = await call(() => createPlanAction({ title: title || file.name.replace(/\.pdf$/i, ""), fileKey: key, floorAreaId: floor }), t.app.saved);
      if (id) {
        setOpen(false);
        router.push(`/plans/${id}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload />
        {t.plans.upload}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.plans.upload}</DialogTitle>
          </DialogHeader>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            {file ? file.name : t.plans.upload}
          </Button>
          <Field label={t.plans.uploadTitle}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t.plans.floor}>
            <OptionSelect value={floor} onChange={setFloor} options={floors} noneLabel={t.app.none} />
          </Field>
          <DialogFooter>
            <Button disabled={!file || busy} onClick={save}>
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
