"use client";
import { RotateCcw, ScanText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { processSourceAction, reprocessSourceAction } from "@/app/actions/intel";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Reads the waiting messages of one chat, batch after batch, and reports what it found. */
export function ReadMessages({ sourceId, waiting, processed = 0 }: { sourceId: string; waiting: number; processed?: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [found, setFound] = useState<number | null>(null);
  if (!waiting && !processed && found === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {waiting > 0 && (
        <Button
          disabled={!!progress}
          onClick={async () => {
            let done = 0;
            let events = 0;
            try {
              for (;;) {
                setProgress(t.intel.reading(done, waiting));
                const r = await processSourceAction(sourceId);
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                done += r.data.processed;
                events += r.data.events;
                if (!r.data.remaining || !r.data.processed) break;
              }
              setFound(events);
              toast.success(t.intel.readDone(events));
              router.refresh();
            } finally {
              setProgress(null);
            }
          }}
        >
          <ScanText />
          {t.intel.read(waiting)}
        </Button>
      )}
      {waiting === 0 && processed > 0 && (
        <Button
          variant="outline"
          disabled={!!progress}
          onClick={async () => {
            if (!window.confirm(t.intel.rereadConfirm)) return;
            setProgress(t.intel.reading(0, processed));
            const r = await reprocessSourceAction(sourceId);
            setProgress(null);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            setFound(null);
            router.refresh();
          }}
        >
          <RotateCcw />
          {t.intel.reread}
        </Button>
      )}
      {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
      {found !== null && found > 0 && (
        <Link href="/updates" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t.intel.title} ←
        </Link>
      )}
    </div>
  );
}
