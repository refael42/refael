"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const WIDTH = 1600;

async function renderPage(url: string, n: number): Promise<{ data: ImageData; pages: number } | null> {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument(url).promise;
  try {
    if (n > doc.numPages) return { data: new ImageData(1, 1), pages: doc.numPages };
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

const ink = (d: Uint8ClampedArray, i: number) => d[i] + d[i + 1] + d[i + 2] < 600;

/**
 * Two versions of a page, one over the other: what is drawn in only one of
 * them shows in red (added) or blue (removed), everything else faded.
 */
export function PlanCompare({ oldUrl, newUrl }: { oldUrl: string; newUrl: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "same" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      const [a, b] = await Promise.all([renderPage(oldUrl, page), renderPage(newUrl, page)]);
      if (cancelled || !a || !b || !canvas.current) return;
      setPages(Math.max(a.pages, b.pages));
      const w = Math.max(a.data.width, b.data.width);
      const h = Math.max(a.data.height, b.data.height);
      const out = new ImageData(w, h);
      let changed = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const ia = y < a.data.height && x < a.data.width ? (y * a.data.width + x) * 4 : -1;
          const ib = y < b.data.height && x < b.data.width ? (y * b.data.width + x) * 4 : -1;
          const inA = ia >= 0 && ink(a.data.data, ia);
          const inB = ib >= 0 && ink(b.data.data, ib);
          let rgb: [number, number, number] = [255, 255, 255];
          if (inA && inB) rgb = [200, 200, 200];
          else if (inB) {
            rgb = [220, 38, 38];
            changed++;
          } else if (inA) {
            rgb = [37, 99, 235];
            changed++;
          }
          out.data.set([...rgb, 255], o);
        }
      canvas.current.width = w;
      canvas.current.height = h;
      canvas.current.getContext("2d")!.putImageData(out, 0, 0);
      setState(changed > 50 ? "ready" : "same");
    })().catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [oldUrl, newUrl, page]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t.plans.prev}>
          <ChevronRight />
        </Button>
        <span className="num">{t.plans.page(page, pages)}</span>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t.plans.next}>
          <ChevronLeft />
        </Button>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-600" /> {t.plans.added}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-600" /> {t.plans.removed}
        </span>
        {state === "loading" && <span className="text-muted-foreground">{t.plans.comparing}</span>}
        {state === "same" && <span className="text-muted-foreground">{t.plans.noChanges}</span>}
        {state === "error" && <span className="text-destructive">{t.plans.pdfError}</span>}
      </div>
      <div className="overflow-auto rounded-md border bg-white">
        <canvas ref={canvas} className="h-auto w-full" />
      </div>
    </div>
  );
}
