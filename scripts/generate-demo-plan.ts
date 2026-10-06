/**
 * Generates public/demo/plan-floor-4.pdf — a simple architectural-style floor
 * plan whose geometry matches src/lib/seed/plan-layout.ts (so seeded pins land
 * on the drawn apartments). Labels are Latin/numeric to avoid font embedding.
 *   npm run gen:plan
 */
import { writeFileSync } from "node:fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { PLAN_APARTMENTS, PLAN_BALCONIES, PLAN_CORRIDOR, PLAN_PAGE, PLAN_STAIRS } from "../src/lib/seed/plan-layout";

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle("Building A - Floor 4 - Architectural plan");
  const page = doc.addPage([PLAN_PAGE.width, PLAN_PAGE.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const H = PLAN_PAGE.height;
  const ink = rgb(0.15, 0.17, 0.22);
  // pdf-lib's origin is bottom-left; our layout is top-left
  const rect = (r: { x: number; y: number; w: number; h: number }, opts: { fill?: ReturnType<typeof rgb>; width?: number } = {}) =>
    page.drawRectangle({ x: r.x, y: H - r.y - r.h, width: r.w, height: r.h, borderColor: ink, borderWidth: opts.width ?? 2, color: opts.fill });
  const text = (s: string, x: number, y: number, size = 12, f = font) => page.drawText(s, { x, y: H - y, size, font: f, color: ink });

  page.drawRectangle({ x: 0, y: 0, width: PLAN_PAGE.width, height: PLAN_PAGE.height, color: rgb(0.99, 0.99, 0.97) });
  // grid
  for (let gx = 40; gx < PLAN_PAGE.width; gx += 40) page.drawLine({ start: { x: gx, y: 30 }, end: { x: gx, y: H - 30 }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) });
  for (let gy = 30; gy < H; gy += 40) page.drawLine({ start: { x: 40, y: gy }, end: { x: PLAN_PAGE.width - 40, y: gy }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) });

  rect(PLAN_BALCONIES, { fill: rgb(0.9, 0.94, 0.98) });
  text("BALCONIES / FACADE", PLAN_BALCONIES.x + 10, PLAN_BALCONIES.y + 30, 11, bold);
  for (const apt of PLAN_APARTMENTS) {
    rect(apt, { fill: rgb(1, 1, 1), width: 3 });
    // rooms
    page.drawLine({ start: { x: apt.x, y: H - apt.y - 170 }, end: { x: apt.x + apt.w, y: H - apt.y - 170 }, thickness: 1.2, color: ink });
    page.drawLine({ start: { x: apt.x + 110, y: H - apt.y - 170 }, end: { x: apt.x + 110, y: H - apt.y - apt.h }, thickness: 1.2, color: ink });
    text(`APT ${apt.number}`, apt.x + 60, apt.y + 90, 20, bold);
    text("LIVING", apt.x + 70, apt.y + 120, 9);
    text("KITCHEN", apt.x + 20, apt.y + 240, 9);
    text("BATH", apt.x + 130, apt.y + 240, 9);
    // door
    page.drawLine({ start: { x: apt.x + 60, y: H - apt.y - apt.h }, end: { x: apt.x + 100, y: H - apt.y - apt.h }, thickness: 4, color: rgb(0.99, 0.99, 0.97) });
  }
  rect(PLAN_CORRIDOR, { fill: rgb(0.96, 0.96, 0.95) });
  text("CORRIDOR", PLAN_CORRIDOR.x + 420, PLAN_CORRIDOR.y + 50, 12, bold);
  rect(PLAN_STAIRS, { fill: rgb(0.95, 0.93, 0.9) });
  for (let i = 0; i < 9; i++)
    page.drawLine({ start: { x: PLAN_STAIRS.x + 20 + i * 20, y: H - PLAN_STAIRS.y - 20 }, end: { x: PLAN_STAIRS.x + 20 + i * 20, y: H - PLAN_STAIRS.y - 150 }, thickness: 0.8, color: ink });
  text("STAIRS / FIRE CORE", PLAN_STAIRS.x + 30, PLAN_STAIRS.y + 95, 11, bold);
  // title block
  page.drawRectangle({ x: 80, y: 30, width: 520, height: 70, borderColor: ink, borderWidth: 1.5 });
  text("MIGDALEI HAGALIL - BUILDING A", 95, H - 75, 14, bold);
  text("FLOOR 4 - ARCHITECTURAL PLAN  |  SCALE 1:100  |  REV C", 95, H - 52, 10);
  writeFileSync("public/demo/plan-floor-4.pdf", await doc.save());
  console.log("wrote public/demo/plan-floor-4.pdf");
}
main();
