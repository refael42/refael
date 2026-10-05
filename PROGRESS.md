# Restaurant Tycoon — Progress Log

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Project setup, Skia scene (native + web), fixed-timestep loop, big numbers, perf overlay, style test | ✅ Done |
| M1 | Customer lifecycle end to end + juice; **pivot to isometric, landscape, big pannable/zoomable map** | ✅ Done |
| M2 | Kitchen tickets, waiter delivery (A* already in), clean-dishes loop with a dishwasher | ✅ Done |
| M3 | Economy, upgrade catalog engine, save/load, offline progress, balance sim | ✅ Done |
| M4 | Applicants, hiring, wages, morale, staff cards | ✅ Done |
| M5 | Building tiers, construction sequence, build mode, decor | ⏳ Next |
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
- The coin counter and the stars must look crisp (the first HUD looked low quality on the
  phone): chunky gradient pills with a gold rim; icons and digits baked at screen resolution.
- First phone run crashed after the first touch → fixed in the M3 hotfix (see Known issues).

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
  - Old per-frame pictures are disposed by hand a few frames later **on web only** (CanvasKit
    objects are not GC'd). On native the JS GC frees them; disposing by hand there raced the
    UI thread and was the prime suspect for the first-touch crash on the owner's phone.
  - The canvas props are stable and the component is memoized: re-rendering it at 2 Hz
    (HUD polling) used to rebuild the gesture handlers mid-touch.
  - **HUD sharp sprites:** coin, stars, sun/moon and the digits are baked a second time at
    screen resolution (`pixelRatio × 2.7`, mipmapped) and drawn like any sprite. They were
    vector pictures first: as sharp, but replaying their paths every frame cost ~35 % of the
    frame rate on a software GPU (10 → 14.7 fps after the switch).
- **Camera:** pan (with inertia via `withDecay`) + pinch around the focal point (mouse wheel
  on web), all on the UI thread, clamped to the map.
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
- **Staff (M2, `src/sim/game/staff.ts`):** staff are sim entities with
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
- **Save (M3, `src/sim/save.ts`, `src/store/persistence.ts`):** versioned JSON (v2 since M4:
  adds the team, the day number and hires; v1 saves migrate to the old cook + waiter + washer
  team) with a migration chain and validation (unknown upgrades dropped, caps enforced, bad
  workers dropped). Only progress is saved (coins, rating, levels, stats, team); a load starts
  a fresh, empty day. Two slots (latest +
  previous) so an interrupted write never loses everything; an unreadable save is parked, a
  save from a newer app version is never overwritten. Autosave every 5 s and when the app
  goes to the background.
- **Offline progress (`src/sim/offline.ts`):** the real sim runs headless for 3 minutes with
  the saved upgrades and team (staff seat people slowly), measures coins/second, subtracts the
  team's wages, and pays 50 % of that for the time away (nothing if wages eat it all), capped at 2 h (upgrades will raise it in M6). The sim is paused while the
  "Welcome back" screen is up, so collecting is never lost. The ×2 button is a 3-second fake
  ad (placeholder, no ad SDK).
- **Balance bot (`npm run balance`):** a greedy "cheapest affordable" manager with a 1.2 s
  reaction plays N minutes headless and prints the timeline, dead zones (> 3 min with nothing
  to buy), upgrade floods (> 30 buys/min) and income explosions (> ×4 per minute). A test
  guards the first 15 minutes. Runs through Vite's SSR loader (no new dependency).
- **Staff management (M4, `src/sim/game/people.ts`, `applicants.ts`, `workers.ts`):**
  - A worker is a *person* (name, look, 4 stats 1–10: speed, quality, charm, stamina, up to 2
    traits, level, daily wage) plus job state (XP, morale, energy, unpaid days, trial).
  - Five jobs with a cap each (`src/data/staff.ts`): cook (one per stove), waiter (3), washer
    (1), host (1, seats the queue by itself) and cleaner (2, busses tables); host and cleaner
    open once the team has 3 people. The game starts with **one cook**; everyone else is hired.
  - Applicants walk to the door with a CV bubble and wait 70 s. A missing cook is always the
    first applicant (and comes within seconds), so a kitchen can never deadlock.
  - Hire = pay a signing fee (1 day of wage) · trial = free today, decide at the end of the
    day · "offer less" = −20 % once, accepted ~55 % (less for better people) · no thanks.
  - **Day = 120 s** (clock in the HUD, dusk/night tint, lamps glow). Payday at the end of each
    day, in hiring order; anyone unpaid loses morale, after 2 unpaid days they quit.
  - Work rate = speed stat × energy × morale (0.7–1.1) × (scolded ×1.25) × (night owl at
    night). Morale moves with events: paid +0.05, unpaid −0.35, bonus +0.3, scold −0.15, raise
    yes/no ±0.2, a gossip on the team −0.04 per payday; below 0.12 at payday people quit.
    Energy drains while busy (less with stamina) and refills while idle.
  - XP from every job; levels add a stat point and +25 % wage; ranks (silver star at Lv 3,
    gold at Lv 6) show on the uniform. Lv 2+ ask for raises (at least +20 %, up to the market wage,
    never more than +50 % at once); refusing costs morale.
  - Manager actions on the worker card: bonus (morale), train (pay for a level), scold (fast
    for 25 s, morale down), change job (switches after the current task), fire (two taps).
  - Traits (`src/data/traits.ts`): perfectionist, clumsy (drops a dish now and then — the
    plate goes dirty and the order is cooked again), charmer (tips), night owl, gossip
    (spreads bad morale on payday), workaholic, cheerful (cheap but weaker).
  - Applicants get better (higher level) as the restaurant hires more.
- **Taps (M4):** an action wins over a person, a person over a station; tapping a worker or an
  applicant opens their card and rings them on the map.
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
  bussing 0.7 s. Since M4 the game starts with the cook only and you hire the rest, so the
  "no plates" bottleneck shows up early on purpose.
- M4 pacing (bot hires by need, seed 1, 60 min): first upgrade 0:00, first hire 0:42
  (washer), waiter 1:29, first milestone 4:04, host 17:11, 2nd waiter 21:21, cleaner 21:35,
  2nd cook 26:28 → team of 7, **0 quits**. Coins/min: 528 at 6 → 4.3K at 18 → 369K at 30 →
  2.3M at 42 → 5M at 60. No dead zones; one flood at minutes 22–26 (32–35 buys/min) right
  after the second cook — the same kind of power spike as M3, kept.
- Wages are priced in portions of fries (Lv 1: 2–3 portions per day), so they grow with the
  menu prices; levels, stats and raises push them further. The burger price went
  8 → 14 so unlocking it never lowers income.

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
| M4 game, production build, vector HUD | ~27 | 0.9 ms | 10 (M3 build on the same machine: 16) |
| M4 game, production build, sharp-atlas HUD | ~27 | 0.7–0.9 ms | 14.7 (16.9 with the staff panel open) |

Frame build (CPU work per frame) is far below the 16.6 ms budget; the low FPS is software
rasterization. **Not yet measured on a phone** — the owner should check the FPS overlay with
"+60" on. If GPU-bound on mid-range Android: batch tinted sprites with `drawAtlas` per tint.

## How to verify

- `npm run check` — typecheck + 152 unit tests.
- `npm run balance -- --minutes 60` — the pacing report.
- `npm run web` (browser) or `npm start` + Expo Go (phone).
- `npm run export:web` — production web build in `dist/`.

## Known issues / not verified

- Not run on a physical Android/iOS device by me (sandbox has no device). The owner's first
  phone run crashed after the first touch; the hotfix (web-only picture disposal, stable
  memoized canvas) is pushed but **not confirmed yet** — if it still crashes, the red-screen
  text or the terminal output is needed.
- Customers enter/leave through the front door of the building, but there is no visible door
  frame yet (front walls are cut away by design).
- Expo DevTools fails to launch in the sandbox (runs as root) — harmless.
- Sound & music: the settings row is a placeholder until audio lands (M7).
- Seating is manual until you hire a host (M4); while the app is closed the offline estimate
  assumes slow seating by the staff. Deeper automation comes in M6.
- Staff jobs are still simple loops; workers never take breaks (energy only lowers speed).
- Applicants only come one or two at a time at the door; there is no job board / ads yet.
- Very large numbers in floating "+N" texts use JS numbers (fine up to ~1e308); the HUD and
  menus use `Big`.
