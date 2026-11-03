// Browser check of the exported web build: loads each scenario in Hebrew and
// English, waits for the canvas to draw, saves screenshots and fails on any
// console error. Usage: node scripts/e2e.mjs [--only name[,name...]] [--keep]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'artifacts', 'screens');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
// --only a,b,c runs just those scenarios
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

const PORT = 8090 + Math.floor(Math.random() * 500);
const server = await serve(join(root, 'dist'), PORT);
const base = `http://127.0.0.1:${PORT}`;

/** Scenarios: name, viewport, URL query, wait, optional actions. */
const scenarios = (await import('./e2e-scenarios.mjs')).default;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;
for (const sc of scenarios) {
  if (only && !only.includes(sc.name)) continue;
  // art-review scenarios run only when asked for by name
  if (!only && sc.review) continue;
  for (const lang of sc.langs ?? ['he', 'en']) {
    const ctx = await browser.newContext({ viewport: sc.viewport, deviceScaleFactor: sc.scale ?? 2, hasTouch: !!sc.touch, isMobile: !!sc.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(
      ({ lang, fakeNow, save, settings }) => {
        localStorage.setItem('skyport.settings.v1', JSON.stringify({ state: { lang, langChosen: true, showFps: true, onboarded: true, ...settings }, version: 1 }));
        if (save) localStorage.setItem('skyport.save.v1', save);
        if (fakeNow) {
          // Shift Date.now (page.clock breaks Reanimated).
          const real = Date.now.bind(Date);
          const offset = fakeNow - real();
          Date.now = () => real() + offset;
        }
      },
      { lang, fakeNow: sc.fakeNow ?? 0, save: sc.save ?? null, settings: sc.settings ?? {} },
    );
    const t0 = Date.now();
    await page.goto(base + (sc.query ?? '/'), { waitUntil: 'load' });
    if (!sc.noCanvas) await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(sc.wait ?? 1500);
    if (sc.actions) {
      try {
        await sc.actions(page);
      } catch (e) {
        errors.push('action failed: ' + (e && e.message ? e.message : String(e)));
      }
    }
    const file = join(out, `${sc.name}-${lang}.png`);
    await page.screenshot({ path: file });
    const ms = Date.now() - t0;
    if (errors.length) {
      failures++;
      console.log(`FAIL ${sc.name} [${lang}] console errors:\n  ` + errors.join('\n  '));
    } else {
      console.log(`ok   ${sc.name} [${lang}] ${ms} ms -> ${file}`);
    }
    await ctx.close();
  }
}
await browser.close();
server.close();
if (failures) {
  console.log(`${failures} scenario(s) failed`);
  process.exit(1);
}
