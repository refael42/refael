"use client";
import { ClipboardPaste } from "lucide-react";
import { useMemo, useState } from "react";
import { importContractorsAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { parseContractorLines } from "@/lib/phone";

/** Paste a whole contractor list (from Excel / WhatsApp) at once. */
export function ImportContractorsDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { call, pending } = useAction();
  const rows = useMemo(() => parseContractorLines(text), [text]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ClipboardPaste />
        {t.setup.importContractors}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.setup.importContractors}</DialogTitle>
            <DialogDescription>{t.setup.importHint}</DialogDescription>
          </DialogHeader>
          <Textarea id="import-text" rows={7} dir="rtl" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.setup.importPlaceholder} />
          {rows.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
              <table className="w-full">
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-2 py-1 font-medium">{r.name}</td>
                      <td className="px-2 py-1 text-muted-foreground">{r.trade ?? "—"}</td>
                      <td className="num px-2 py-1" dir="ltr">
                        {r.phone ?? <span className="text-state-blocked">{t.setup.noPhone}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={pending || !rows.length}
              onClick={async () => {
                const r = await call(() => importContractorsAction(text), (x) => t.setup.imported(x.added, x.existing, x.failed));
                if (r) {
                  setText("");
                  setOpen(false);
                }
              }}
            >
              {t.setup.importButton(rows.length)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
