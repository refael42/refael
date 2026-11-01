# Skyport Tycoon — progress

Mobile isometric airport tycoon. Expo SDK 58 + TypeScript strict + Skia + Reanimated.
Everything (sprites, icons, digits) is drawn in code; there are no image assets.

## How to run

```bash
cd skyport
npm install            # also copies canvaskit.wasm into public/
npm run web            # dev server in the browser
npx expo start         # phone: scan the QR with Expo Go
npm run verify         # typecheck + tests
npm run export:web && npm run e2e   # web build + Playwright screenshots (artifacts/screens)
```

## Milestones

| # | Status | Notes |
|---|---|---|
| M0 Infrastructure | done | see below |
| M1 Dirt strip | next | |

### M0 — infrastructure (done)
- `src/sim`: pure TypeScript. Seeded RNG (`rand`, state in the save), `hash01` for new features,
  `Big` (mantissa/exponent) + short format (1.2K … 7.8T, aa, ab …), fixed 30 Hz `stepGame`,
  queued `Command`s, `events` kept for 2 s.
- `src/data`: aircraft (11 types), airlines (8 fictional), cities (14 fictional).
- `src/render`: iso projection, sprite atlas built at load time (planes in 16 headings via
  "sprite stacking", people in 4 facings × walk frames, fuel truck, hut, pump, windsock, trees,
  icons, a stroke font for in-world numbers). The JS thread writes a flat `Float32Array`
  snapshot each frame; a worklet records the frame with `drawAtlas` (one call per pass).
- Camera: drag + pinch via the React Native responder (not gesture-handler on the canvas).
- i18n: `en.ts` is the source, `he.ts` is `Record<TKey, string>`, RTL layout helpers that work
  without restarting the app. Device language on first launch.
- Tests (vitest, 30 s timeout): purity of sim/data, RNG, Big/format, translations, sim loop determinism.
- Browser check: `scripts/e2e.mjs` exports nothing itself; it serves `dist/`, opens Chromium,
  fakes `Date.now` with `addInitScript` (never `page.clock`), screenshots he+en, fails on console errors.

## Notes / decisions
- The game lives in `skyport/` inside the `refael` repo (the repo root is a different app).
- Skia on web: `canvaskit.wasm` is copied to `public/` by `postinstall`; `Root.web.tsx` loads it
  with `WithSkiaWeb` before importing any module that touches Skia.
