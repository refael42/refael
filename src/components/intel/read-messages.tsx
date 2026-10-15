"use client";
import { ScanText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { processSourceAction } from "@/app/actions/intel";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Reads the waiting messages of one chat, batch after batch, and reports what it found. */
export function ReadMessages({ sourceId, waiting }: { sourceId: string; waiting: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [found, setFound] = useState<number | null>(null);
  if (!waiting && found === null) return null;
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
      {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
      {found !== null && found > 0 && (
        <Link href="/updates" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t.intel.title} ←
        </Link>
      )}
    </div>
  );
}
