// Copies the pdf.js worker shipped with react-pdf into /public so the plan viewer
// can load it from the same origin (works offline / as a PWA, no CDN needed).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
try {
  const reactPdfDir = dirname(require.resolve("react-pdf/package.json"));
  const candidates = [
    join(reactPdfDir, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
    join(dirname(require.resolve("pdfjs-dist/package.json")), "build/pdf.worker.min.mjs"),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) throw new Error("pdf.worker.min.mjs not found");
  mkdirSync("public", { recursive: true });
  copyFileSync(src, "public/pdf.worker.min.mjs");
  console.log("[siteflow] copied pdf.js worker to public/");
} catch (err) {
  console.warn("[siteflow] could not copy pdf.js worker:", err.message);
}
