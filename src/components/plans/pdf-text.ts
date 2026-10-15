"use client";
/**
 * The text of a PDF, read in the browser before upload (title block, room
 * names, apartment numbers). Lines follow the PDF's own line breaks.
 */
const MAX_PAGES = 40;

export async function readPdfText(file: File): Promise<{ text: string; pages: number }> {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parts: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        parts.push(line.trim());
        line = "";
      } else line += " ";
    }
    if (line.trim()) parts.push(line.trim());
  }
  const pages = doc.numPages;
  await doc.destroy();
  return { text: parts.filter(Boolean).join("\n"), pages };
}
