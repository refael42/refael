# Restaurant Tycoon — Progress Log

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Project setup, Skia scene (native + web), fixed-timestep loop, big numbers, perf overlay, style test | ✅ Done |
| M1 | Customer lifecycle end to end + juice; **pivot to isometric, landscape, big pannable/zoomable map** | ✅ Done |
| M2 | Kitchen tickets, waiter delivery (A* already in), clean-dishes loop with a dishwasher | ✅ Done |
| M3 | Economy, upgrade catalog engine, save/load, offline progress, balance sim | ✅ Done |
| M4 | Applicants, hiring, wages, morale, staff cards | ⏳ Next |
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
- Zoom with two fingers only (no +/− buttons); in the browser the mouse wheel zooms.
- Tapping something to upgrade outlines it softly on the map.
- Everything that is not the game lives behind a **settings gear** (language, sound placeholder,
  FPS counter, character gallery, crowd test, reset progress).
- The restaurant must be able to **grow**: more tables now (M3), more kitchens/cooks with
  hiring (M4) and bigger buildings (M5).

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
- **Staff (M2, `src/sim/game/staff.ts`):** cook, waiter and dishwasher are sim entities with
  simple job loops (no behavior trees yet). The waiter prefers delivering ready dishes over
  bussing tables. The manager can always step in: tap a ready dish to toss it, a dirty table
  to wipe it, the sink to hand-wash.
- **Plates are a conserved resource:** clean stack → plated dish → table → dirty → washed →
  clean stack. A test checks that the total never changes. Out of clean plates = the cook
  stalls and the clean-plate stack shows a "no plates" bubble: the first real bottleneck.
- **Ticket rail:** queued and cooking orders hang as paper tickets above the pass (oldest
  first), with a cooking progress bar.
- **Upgrade engine (M3, `src/data/upgrades.ts` + `src/sim/economy/upgrades.ts`):** every
  upgrade is a data row (anchor station, base cost, growth, per-level effect, milestone bonus).
  Levels are endless; milestones at 10, 25, 50, 75, 100, then every 50 forever. Levels add up
  within a stat, milestones multiply on top. Costs are `Big` (`base × growth^level`), so level
  20 000 is still a valid number. Capacity rows (new tables) have a `max` set by floor space.
- **Visible progress:** each station has 4 looks (base, lv 10, 25, 50) baked from one
  parametric drawing — e.g. sink → gold fittings → two basins → dishwasher; stove → chrome →
  red 3-burner range → black & gold. From lv 75 a soft golden aura + sparkles. Every purchase
  bounces the station and pops "LV n"; milestones add confetti and a short camera shake.
  Dishes (fries/burger) get fancier plates with their recipe level.
- **Taps:** actions (seat/serve/clean/wash) win when they are about as close as a station;
  otherwise the tapped station opens its upgrade sheet. Green arrows float over every station
  with an affordable upgrade; the next table spot shows as a dashed ghost with a "+".
- **Menus** are React Native panels (not canvas). Icons are the game's own sprites rendered
  once to PNG data URIs (no extra Skia canvases: web caps WebGL contexts).
- **Save (M3, `src/sim/save.ts`, `src/store/persistence.ts`):** versioned JSON (v1) with a
  migration chain and validation (unknown upgrades dropped, caps enforced). Only progress is
  saved (coins, rating, levels, stats); a load starts a fresh, empty day. Two slots (latest +
  previous) so an interrupted write never loses everything; an unreadable save is parked, a
  save from a newer app version is never overwritten. Autosave every 5 s and when the app
  goes to the background.
- **Offline progress (`src/sim/offline.ts`):** the real sim runs headless for 3 minutes with
  the saved upgrades (staff seat people slowly), measures coins/second, and pays 50 % of that
  for the time away, capped at 2 h (upgrades will raise it in M6). The sim is paused while the
  "Welcome back" screen is up, so collecting is never lost. The ×2 button is a 3-second fake
  ad (placeholder, no ad SDK).
- **Balance bot (`npm run balance`):** a greedy "cheapest affordable" manager with a 1.2 s
  reaction plays N minutes headless and prints the timeline, dead zones (> 3 min with nothing
  to buy), upgrade floods (> 30 buys/min) and income explosions (> ×4 per minute). A test
  guards the first 15 minutes. Runs through Vite's SSR loader (no new dependency).
- **Scenery behind the walls** (`MapDef.backdrop`) is render-only and baked into the background
  before the walls, so the walls hide it correctly. (Props are depth-sorted *on top of* the
  background, so a tree placed behind a wall used to draw over it.)

## Economy & pacing (M1–M2, `src/data/economy.ts`, `src/data/staff.ts`)

- Dishes: fries 4 coins (cook 3.5 s), burger 8 coins (cook 6 s).
- Customer types: regular, rushed (low patience, fast-service bonus), tourist (priciest dish,
  big tips), student (cheapest dish, small tips).
- Arrivals: Poisson, 2.4 + 0.8 × rating per minute, never more than 16 s apart.
- Headless pacing check (attentive player, 5 min): ~6 customers/min, ~50 coins/min, rating
  climbs 3.0 → 4.9; slower players still progress (25 served in 5 min with 5 s reactions).
  Proper balance bot + dead-zone detection comes with the upgrade economy in M3.
- M3 pacing (greedy bot, seed 1): first purchase 0:00 (start with 10 coins), first milestone
  2:38, burger unlocked 8:12, first new table 12:05. Coins/min: 31 at 1 min → 470 at 5 →
  1.3K at 13 → 93K at 24 → 1.5M at 40 → 3M at 60. No dead zones in 60 minutes. One "power
  spike" around minute 23–25 (burger 25, fridge 25 and fries 50 milestones land together:
  ~40 buys/min) — kept on purpose, it feels great. After ~45 min purchases slow to 5–8/min:
  that is where the next building tier (M5) must arrive.
- Global multipliers (quality, tips) grow slowly on purpose: they stack with every recipe
  level. The first tuning had them at ×1.5 per milestone and income exploded to billions by
  minute 17 — the balance bot caught it.
- Kitchen (M2): 5 plates, washing 3 s per plate (a tap on the sink = +34 %), plating 0.45 s,
  bussing 0.7 s. Starting roster: cook + waiter + dishwasher; in M4 the game starts with the
  cook only and you hire the rest (then the "no plates" bottleneck shows up early on purpose).

## Performance

Headless Chromium, software GL (SwiftShader, **no GPU**), 844×390 @2x:

| Scene | Entities | Frame build (our code) | FPS (software GL) |
|-------|----------|------------------------|-------------------|
| Game, dev build | ~30 | 0.6–0.9 ms | 14.6 |
| Game, production build | ~30 | 0.6 ms | 17 |
| Game + stress (+60 walkers) | 89 | 2.4–2.6 ms | 5.5 |
| M2 game, zoom 1, dev build | ~28 | 0.7–1.2 ms | 12–17 |
| M2 game, zoomed in ×1.6 (vector background) | ~28 | 0.6–1.3 ms | 5–10 |
| M2 game, production build | ~28 | — | 14–15 |
| M3 game, production build | ~25 | 0.6–1.4 ms | 17.8 (14.5 with the upgrade panel open) |

Frame build (CPU work per frame) is far below the 16.6 ms budget; the low FPS is software
rasterization. **Not yet measured on a phone** — the owner should check the FPS overlay with
"+60" on. If GPU-bound on mid-range Android: batch tinted sprites with `drawAtlas` per tint.

## How to verify

- `npm run check` — typecheck + 127 unit tests.
- `npm run balance -- --minutes 60` — the pacing report.
- `npm run web` (browser) or `npm start` + Expo Go (phone).
- `npm run export:web` — production web build in `dist/`.

## Known issues / not verified

- Not run on a physical Android/iOS device yet (sandbox has no device).
- Customers enter/leave through the front door of the building, but there is no visible door
  frame yet (front walls are cut away by design).
- Expo DevTools fails to launch in the sandbox (runs as root) — harmless.
- Sound & music: the settings row is a placeholder until audio lands (M7).
- Seating is still manual (auto-seat "Host" comes in M6); while the app is closed the offline
  estimate assumes slow seating by the staff.
- Very large numbers in floating "+N" texts use JS numbers (fine up to ~1e308); the HUD and
  menus use `Big`.
