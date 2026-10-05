# Restaurant Tycoon — Progress Log

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Project setup, Skia scene (native + web), fixed-timestep loop, big numbers, perf overlay, style-test screen | ✅ Done (awaiting art approval) |
| M1 | One customer lifecycle end to end + juice | ⏳ Next |
| M2 | Kitchen, cook, ticket rail, waiter pathfinding, clean-dishes loop | — |
| M3 | Economy, upgrade catalog engine, save/load, offline progress, balance sim | — |
| M4 | Applicants, hiring, wages, morale, staff cards | — |
| M5 | Building tiers, construction sequence, build mode, decor | — |
| M6 | Automation, Rush hour, Upgrades screen (search/filter/ROI) | — |
| M7 | Full polish: audio, haptics, day/night, weather, tutorial, quests, settings | — |
| M8 | Prestige, perf pass, store readiness, IAP/ads plan | — |

## Locked decisions

- **Stack:** Expo SDK 57 (`expo 57.0.26`, React Native 0.86.3, React 19.2.3), TypeScript strict.
  Versions come from `expo/bundledNativeModules.json` of SDK 57 (docs.expo.dev is blocked in the
  dev sandbox, so the versioned docs were read from the `expo/expo` repo sources instead).
- **Rendering:** `@shopify/react-native-skia 2.6.2` + `react-native-reanimated 4.5.1` /
  `react-native-worklets 0.10.1`. ONE `<Canvas>`; every UI-thread frame records one `SkPicture`.
  - Art is procedural (Skia paths), drawn **once** into a texture atlas at startup, then stamped
    per frame with `drawImageRectOptions` (linear filtering).
  - Tintable parts (skin, hair, shirt, pants) are drawn white and colored with a `Modulate`
    color filter → endless outfit variety from one atlas.
  - Static layers (floor, walls, vignette) are baked to images once; one quad per frame.
  - Atlas/layers use CPU raster surfaces, never `MakeOffscreen`, because on web every offscreen
    GPU surface costs a WebGL context (browser cap ≈16).
  - Old per-frame pictures are disposed two frames later (CanvasKit objects are not GC'd on web).
- **Paths:** Skia 2.6 deprecated mutable `SkPath` methods; all art uses `Skia.PathBuilder`,
  `Skia.Path.RRect/Oval/Circle` and `Skia.Path.MakeFromOp`. (The deprecated `path.op()` is
  broken on web: `makeCombined is not a function`.)
- **Sim/render split:** `src/sim` is pure TS (guarded by `tests/purity.test.ts`). Fixed 20 Hz
  step on the JS thread → packed number-array snapshot (`src/sim/snapshot.ts`) in a shared
  value → UI thread interpolates one tick behind (`alpha`), so movement is smooth at 60 fps.
  Cosmetic animation (bob, walk cycle, steam, sparkles) is a pure function of time: no state,
  no pooling needed.
- **Big numbers:** `break_infinity.js` behind `src/sim/big.ts`; formatter `src/sim/format.ts`
  (K, M, B, T, aa…zz, aaa…). Truncates, never rounds up. Saves use `mantissa e exponent` strings.
- **RNG:** mulberry32, single uint32 state (trivial to save; deterministic replays).
- **i18n/RTL:** `src/i18n` (en + he, `he` typed against `en` keys so missing strings fail
  typecheck). Direction is applied with a root `direction` style, not `I18nManager.forceRTL`, so
  switching language never needs an app reload. Absolute positions use physical `left`;
  layout uses `start/end`. Never mix Hebrew + numbers in one `<Text>` (bidi reorders them).
- **State:** Zustand (`src/store`). Persistence comes in M3.
- **Art route:** procedural vector art (approved default). Kenney CC0 only for audio later
  (ask before downloading).
- **Game defaults:** portrait, Tel Aviv street-food stand → empire; prestige cities Rome,
  Tokyo, Paris, New York; audience 13+; manual early game, automation by ~30–45 min,
  offline cap 2 h growing to 8–12 h.

## Performance (M0)

Measured in headless Chromium (software GL / SwiftShader, no GPU), 390×844 @2x:

| Scene | Entities | Frame build (our code) | FPS (software GL) |
|-------|----------|------------------------|-------------------|
| Style test | 18 | 0.5–0.8 ms | ~23–25 |
| Style test + stress | 78 | 2.9 ms | ~11 |

The frame-build time (CPU work to record a frame) is ≪ 16.6 ms; the low FPS is SwiftShader
rasterizing pixels in software. **Not yet measured on a physical phone** — the owner should
read the perf overlay (FPS button) in Expo Go with "+60" on.

## How to verify

- `npm run check` — typecheck + unit tests (52 tests).
- `npm run web` — open the browser build; `npm start` + Expo Go for a phone.
- `npm run export:web` — production web build in `dist/`.

## Known issues / not verified

- Not run on a physical Android/iOS device yet (sandbox has no device). Native risks: atlas
  upload hitch on first frame, `drawImageRectOptions` JSI call cost with many entities.
- Characters behind counters (cook, dishwasher) only show from the chest up by design.
- Expo DevTools fails to launch in the sandbox (runs as root) — harmless.

## Balance notes

(none yet — economy starts in M3)
