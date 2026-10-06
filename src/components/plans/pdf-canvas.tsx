"use client";
import { Document, Page, pdfjs } from "react-pdf";
import { t } from "@/lib/i18n";

// Worker copied to /public at install time (scripts/copy-pdf-worker.mjs) — same origin, works offline.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PdfCanvas({
  url,
  page,
  width,
  onLoad,
}: {
  url: string;
  page: number;
  width: number;
  onLoad: (pages: number) => void;
}) {
  return (
    <Document
      file={url}
      onLoadSuccess={(d) => onLoad(d.numPages)}
      loading={<div className="p-10 text-center text-muted-foreground">{t.plans.loadingPdf}</div>}
      error={<div className="p-10 text-center text-destructive">{t.plans.pdfError}</div>}
    >
      <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
    </Document>
  );
}
