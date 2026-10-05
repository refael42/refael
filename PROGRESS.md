# Restaurant Tycoon — Progress Log

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Project setup, Skia scene (native + web), fixed-timestep loop, big numbers, perf overlay, style test | ✅ Done |
| M1 | Customer lifecycle end to end + juice; **pivot to isometric, landscape, big pannable/zoomable map** | ✅ Done |
| M2 | Kitchen tickets, waiter delivery (A* already in), clean-dishes loop with a dishwasher | ⏳ Next |
| M3 | Economy, upgrade catalog engine, save/load, offline progress, balance sim | — |
| M4 | Applicants, hiring, wages, morale, staff cards | — |
| M5 | Building tiers, construction sequence, build mode, decor | — |
| M6 | Automation, Rush hour, Upgrades screen (search/filter/ROI) | — |
| M7 | Full polish: audio, haptics, day/night, weather, tutorial, quests, settings | — |
| M8 | Prestige, perf pass, store readiness, IAP/ads plan | — |

## Owner decisions

- Defaults accepted for all M0 questions (Tel Aviv street food → empire, 13+, Android first,
  commit + push to `claude/restaurant-tycoon-game-aye10l` at milestones).
- **Landscape**, **isometric**, a **big map you drag and pinch-zoom**, art in the style of
  *Idle Vegas Resort* (low-poly flat-shaded 3D look, saturated room floors, dark walls with gold
  trim, palms, neon, flying money, blocky characters with square eyes). All art is original —
  the style is matched, no assets/branding are copied.

## Locked decisions

- **Stack:** Expo SDK 57 (`expo 57.0.26`, React Native 0.86.3, React 19.2.3), TypeScript strict.
  Versions from SDK 57's `bundledNativeModules.json` (docs.expo.dev is blocked in the dev
  sandbox; the versioned docs were read from the `expo/expo` repo sources).
- **Rendering:** `@shopify/react-native-skia 2.6.2` + `react-native-reanimated 4.5.1` /
  `react-native-worklets 0.10.1` + `react-native-gesture-handler`. ONE `<Canvas>`; every
  UI-thread frame records one `SkPicture`.
  - **Isometric projection** (`src/render/iso.ts`): floor tiles are 64×32 diamonds;
    screen = ((x − y)·32, (x + y)·16 − z). Painter's order = x + y (+ small biases).
  - **Low-poly art kit** (`src/render/art/iso3d.ts`): boxes/cylinders with three shades
    (light top, mid left, dark right), drawing on box faces via plane matrices.
  - All art is procedural, baked **once** into a texture atlas; per frame we stamp sprites
    with `drawImageRectOptions`. Tintable parts are white and colored with a `Modulate`
    color filter (endless outfits from one atlas).
  - **Characters** are blocky: parts defined once in the character's own frame and baked for a
    front (down-right) and back (up-right) view; left facings are mirrors.
  - **Background LOD:** the static floor/walls are a vector picture (sharp when zoomed in) and
    also a pre-baked image used when zoomed out (much cheaper). Measured: 10 → 14.6 fps in
    software GL.
  - Atlas/background bakes use CPU raster surfaces (no `MakeOffscreen`: each offscreen GPU
    surface costs a WebGL context on web, capped ≈16).
  - Old per-frame pictures are disposed two frames later (CanvasKit objects are not GC'd).
- **Camera:** pan (with inertia via `withDecay`) + pinch around the focal point + zoom buttons,
  all on the UI thread, clamped to the map.
- **Input:** a tap draws a ripple instantly on the UI thread, then the JS thread hit-tests in
  screen space against `tapTargets()` and queues an explicit command (`seat`/`serve`/`clean`)
  applied at the next fixed step → deterministic, replayable, testable.
- **Juice (UI thread only):** fixed ring-buffer FX pool spawned from sim events: rising "+N"
  texts (procedural stroke font, gold for tips), coins and banknotes flying into the HUD (the
  counter only counts them when they land), stars flying to the rating, sparkle bursts, poofs,
  dish arcs from the pass to the table, ding rings, combo badge. Ambient effects (steam,
  flames, bubbles, sparkles, neon stutter, lamp glow) are pure functions of time.
- **Sim/render split:** `src/sim` is pure TS (guarded by `tests/purity.test.ts`). Fixed 20 Hz on
  the JS thread → packed snapshot (+ recent events, + HUD values) in a shared value → UI thread
  interpolates one tick behind.
- **Pathfinding:** grid A* (8-way, no corner cutting, walls only crossable at doors, the goal
  may be a blocked chair tile) + line-of-sight smoothing (`src/sim/grid.ts`).
- **Big numbers:** `break_infinity.js` behind `src/sim/big.ts`; `formatBig` (Big) and
  `formatNumber` (plain number, worklet) produce identical K/M/B/T/aa… strings.
- **i18n/RTL:** root `direction` style (no app reload), never mix Hebrew + numbers in one Text.

## Economy & pacing (M1, `src/data/economy.ts`)

- Dishes: fries 4 coins (cook 3.5 s), burger 8 coins (cook 6 s).
- Customer types: regular, rushed (low patience, fast-service bonus), tourist (priciest dish,
  big tips), student (cheapest dish, small tips).
- Arrivals: Poisson, 2.4 + 0.8 × rating per minute, never more than 16 s apart.
- Headless pacing check (attentive player, 5 min): ~6 customers/min, ~50 coins/min, rating
  climbs 3.0 → 4.9; slower players still progress (25 served in 5 min with 5 s reactions).
  Proper balance bot + dead-zone detection comes with the upgrade economy in M3.

## Performance

Headless Chromium, software GL (SwiftShader, **no GPU**), 844×390 @2x:

| Scene | Entities | Frame build (our code) | FPS (software GL) |
|-------|----------|------------------------|-------------------|
| Game, dev build | ~30 | 0.6–0.9 ms | 14.6 |
| Game, production build | ~30 | 0.6 ms | 17 |
| Game + stress (+60 walkers) | 89 | 2.4–2.6 ms | 5.5 |

Frame build (CPU work per frame) is far below the 16.6 ms budget; the low FPS is software
rasterization. **Not yet measured on a phone** — the owner should check the FPS overlay with
"+60" on. If GPU-bound on mid-range Android: batch tinted sprites with `drawAtlas` per tint.

## How to verify

- `npm run check` — typecheck + 87 unit tests.
- `npm run web` (browser) or `npm start` + Expo Go (phone).
- `npm run export:web` — production web build in `dist/`.

## Known issues / not verified

- Not run on a physical Android/iOS device yet (sandbox has no device).
- Customers enter/leave through the front door of the building, but there is no visible door
  frame yet (front walls are cut away by design).
- Expo DevTools fails to launch in the sandbox (runs as root) — harmless.
