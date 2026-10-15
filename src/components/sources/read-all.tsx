"use client";
import { ScanText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { analyzeSource } from "@/components/sources/import-chat";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Read the waiting messages of every chat, one chat after the other. */
export function ReadAll({ sources }: { sources: Array<{ id: string; title: string; waiting: number }> }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const todo = sources.filter((s) => s.waiting > 0);
  const total = todo.reduce((n, s) => n + s.waiting, 0);
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        disabled={!!progress}
        onClick={async () => {
          let updates = 0;
          let chats = 0;
          try {
            for (const src of todo) {
              setProgress(`${src.title} · ${t.sources.fileAnalyzing}`);
              try {
                updates += await analyzeSource(src.id, (n) => setProgress(`${src.title} · ${t.intel.reading(n, src.waiting)}`));
                chats++;
              } catch (err) {
                toast.error(`${src.title}: ${(err as Error).message}`);
              }
            }
            if (chats) toast.success(t.sources.allDone(chats, updates));
            router.refresh();
          } finally {
            setProgress(null);
          }
        }}
      >
        <ScanText />
        {t.sources.readAll(total)}
      </Button>
      {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
    </div>
  );
}
