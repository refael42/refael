"use client";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { approveReportAction, rejectReportAction } from "@/app/actions/completion";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";

export function ReportReview({ reportId }: { reportId: string }) {
  const { call, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  return (
    <div className="flex gap-2">
      <Button
        variant="success"
        className="flex-1"
        disabled={pending}
        onClick={() => call(() => approveReportAction(reportId), (n) => `${t.completion.approved} · ${t.completion.releasedN(n)}`)}
      >
        <CheckCircle2 />
        {t.completion.approve}
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => setOpen(true)}>
        <RotateCcw />
        {t.completion.reject}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.completion.reject}</DialogTitle>
          </DialogHeader>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.completion.rejectComment} autoFocus />
          <DialogFooter>
            <Button
              disabled={pending || !comment.trim()}
              onClick={async () => {
                const ok = await call(() => rejectReportAction(reportId, comment), t.completion.rejected);
                if (ok !== null) setOpen(false);
              }}
            >
              {t.app.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
