# Restaurant Tycoon — Progress Log

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Project setup, Skia scene (native + web), fixed-timestep loop, big numbers, perf overlay, style test | ✅ Done |
| M1 | Customer lifecycle end to end + juice; **pivot to isometric, landscape, big pannable/zoomable map** | ✅ Done |
| M2 | Kitchen tickets, waiter delivery (A* already in), clean-dishes loop with a dishwasher | ✅ Done |
| M3 | Economy, upgrade catalog engine, save/load, offline progress, balance sim | ✅ Done |
| M4 | Applicants, hiring, wages, morale, staff cards | ✅ Done |
| M5 | Building tiers, construction sequence, build mode, decor (+ chairs, couples, patience types, Lv 100 expansions) | ✅ Done |
| M5b | New HUD, opening animation, first run: welcome, names, how to play, pointing-hand tutorial (owner requests) | ✅ Done |
| M5c | Customer reviews (a good review = a bonus) and rewards that grow with better service (owner request) | ✅ Done |
| M6 | Shift manager for the waiters (owner request), Rush hour, Upgrades screen (search / can buy / best value), applicant shortlist | ✅ Done |
| M7 | Quests and restaurant levels (owner request) | ✅ Done |
| M7a | Balance pass, then the pay-to-win item shop with gems and star workers (owner request) | ✅ Done |
| M8a | Owner requests from the late game: perf (baked glows, tiled background), wages due under the money, best value everywhere; more food (6 dishes), two more buildings (palace, empire), fountain & piano decor | ✅ Done |
| M9 | Owner requests: big upgrades take time (crews, timers, tap to hurry, gems to finish), bulk x1/x10/x100/max, restaurant level caps every 100 levels, deeper buildings with a bigger kitchen, rugs, moving decor | ✅ Done |
| M10 | Owner fixes (shop scrolls, only the tapped piece glows, late-game lag pass 2), second sink, weather | ✅ Done |
| M11 | Sound effects, music loop and vibration (owner approved), switches in the settings | ✅ Done |
| M7b | Full polish: audio, haptics, weather, settings | — |
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
- The coin counter and the stars must look crisp and nice ("ugly right now"): since M5b the
  top bar is a React Native overlay (real bold font, big glossy coin/star icons, dark glass
  pills with a gold rim, a day strip and a rating strip) — see HUD below.
- An opening animation when the app starts ("food or a loading bar, your choice"); the food
  row was then removed at the owner's request ("doesn't look that good"): sunburst, title with
  a chef hat landing on it, loading bar with a rolling coin, cooking phrases.
- The phone app closed at the first touch (no error anywhere) → touch handling rebuilt
  (see Camera / Input below and Known issues).
- Owner ideas done in M5: tables with more chairs and couples; customers who can wait longer
  or not, shown clearly; stations that expand with a new design after many upgrades (Lv 100).
  The host/hostess already exists (hired once the team has 3 people).
- Done in M5b: the **welcome / first-run screens and how-to-play tutorial** ("very important";
  a local profile only, no real accounts).
- Done in M5c: **customer reviews** (a good one is a bonus) and **more reward the better the
  service**. Also a "test money" button in the settings (testing section) so the owner can try
  everything.
- Done in M6: the **shift manager** (אחמ"ש) who runs the waiters.
- Owner requests for the next stages: a **list of tasks to level up** (quests, M7); then
  **balance** the game; then make it **pay-to-win**: gems and an **item shop** where gems also
  buy **star workers** ("PTW"). This replaces the brief's "fair monetization" decision. Purchases
  stay simulated (no real payment SDK, store accounts or native build) until the owner says so.
- Done in M11 (owner approved downloads and two packages): **sound and vibration**.
  kenney.nl is blocked by this environment's network policy, so every sound is synthesized
  by `node scripts/make-sounds.mjs` (oscillators, noise, envelopes; 13 effects and an 18 s cafe
  loop, 1.2 MB of WAV in assets/sounds): the game owns its audio, no licenses. `expo-audio`
  (~57.0.5) plays them, `expo-haptics` (~57.0.3) vibrates; both are in Expo Go, no native build.
  Sounds follow the sim's events (coins, serving, upgrades, milestones, crews, payday, reviews,
  rush, a dropped dish), throttled per sound; switches for sound, music and vibration.
- Done in M10 (owner report): the **shop scrolls** (also quests and settings: a card is no
  longer a button around its list); **only the tapped piece is outlined**; **late-game lag**:
  off-screen culling, no aura on chairs, low detail for the crowd of tables when zoomed far out
  (+13-15% fps in the test browser), and polled UI re-renders only when a value changes (the
  whole game screen used to re-render twice a second). Also a **second sink** in the deep
  kitchens and **weather** (sunny / cloudy / rain: rain streaks and a grey sky; rain = fewer
  walk-ins, more patient guests; the first 3 days are always sunny).
- Done in M9 (owner requests): **big upgrades take time** so the game does not race (milestones,
  new recipes, stoves, showpieces, buildings, restaurant levels; 2 crews, more in the shop), and
  can be **sped up** (tap the site) or **finished with gems**; **bulk buying** x1/x10/x100/max for
  upgrades and staff training (the button always shows, enabled when affordable); **every 100
  levels the restaurant must level up** (restaurant level, built once 5 tracks hit the cap) to
  open the next 100 of everything; quest levels renamed **stages**; the map grows **in more
  directions** (grand/palace/empire are deeper, toward the street) with a **bigger kitchen**
  (up to 5 stoves, a 5-dish pass); **design**: a rug per table group, a painting per wall
  section; **placement**: tap near a tile to snap, tap a placed piece to move it.
  Balance bot: bistro ~35 min, grand ~54, palace ~82, restaurant level 2 ~77 min, 0 quits.
- Done in M8a (from late-game screenshots): less lag when zoomed, "best value now" in every
  upgrade panel, the day's wages under the money, **more food** (falafel, shawarma, hummus,
  schnitzel, shakshuka, ice cream), **more map areas** (food palace with a marble floor, food
  empire with velvet, each a lot further down the street) and **more designs** (fountain, grand
  piano). Balance bot: bistro ~33 min, grand ~50, palace ~69, empire ~112; dishes open from 6 min
  (burger) to 70 min (ice cream); no dead zones.

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
- **Camera + input (`src/render/camera.ts`, `src/render/touches.ts`, unit tested):** React
  Native's own responder touches on the **JS thread** — one finger drags, two pinch around
  their middle, a short still touch taps, a quick release glides (JS `requestAnimationFrame`).
  The camera lives in JS and is handed to the UI thread as one shared value per change; the
  UI thread only draws. No react-native-gesture-handler and no gesture worklets: that setup
  (gesture callbacks as UI-thread worklets) closed the app natively on the owner's Android
  phone at the first touch, with nothing in the terminal; it was removed rather than guessed
  at. On web, `touch-action: none` keeps the browser from zooming the page; the mouse wheel
  zooms the map.
- **Input → sim:** a tap draws a ripple (via a shared value), the JS thread hit-tests in screen
  space against `tapTargets()` and queues an explicit command (`seat`/`serve`/`clean`)
  applied at the next fixed step → deterministic, replayable, testable.
- **Dev builds freeze what goes to the UI thread:** Reanimated/worklets (dev only, native only)
  lock every array/object sent to the UI thread, and later writes are silently ignored. So the
  snapshot sends copies (e.g. `bumps: [...s.bumpAt]`), never live game arrays.
- **`[trace]` lines** (`src/trace.ts`, dev only) mark app start, boot, canvas size, asset bake,
  the first touches and every tap hit in the Metro terminal: after a native crash the last
  line shows how far the app got.
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
- **Building tiers (M5, `src/data/buildings.ts`, `src/data/maps.ts`, `src/sim/game/construction.ts`):**
  - Diner (14 wide) → Bistro (20) → Grand restaurant (26). Maps are generated per tier; tier 0
    is exactly the old hand-made diner (a test compares them). The room grows sideways into
    the lot next door, so everything already built keeps its place. Each tier: new carpet and
    wall colors, more table spots (7 → 15 → 23), more staff places, customers ×1.5 / ×2.2,
    prices ×1.6 / ×2.5. The kitchen stays the same (cook speed upgrades scale it).
  - The building is an upgrade row (anchored to the "for sale" sign on the lot). Rows capped
    by floor space (tables, extra stoves) take their cap from the current building.
  - Buying it closes the restaurant for 6 s (the line goes home, no rating hit): scaffolding
    goes up piece by piece, dust, camera shake and a pan to the site. Then the state is
    rebuilt in place on the new map (same object, so the loop and the UI keep working) with
    coins, levels, rating, team, day and decor; a flash and "The restaurant grew!" reveal it.
  - The tier is just the `building` level: saves need no new field for it.
- **Chairs and couples (M5):** "More chairs" (tap a table) adds a chair opposite the first at
  the next table (rows are two tiles apart, so chairs only fit on the x sides). That chair's
  backrest is its own prop, so it draws in front of the person sitting with their back to us.
  Couples come with 40 % × (share of two-chair tables): side by side in line, seated with one
  tap, each orders and pays, they leave together; two plates to clear. Staff serve from the
  table's front edge now (the side went to the chair).
- **Patience you can read (M5):** every patience bar has an icon: lightning (in a hurry),
  clock (normal), snail (takes their time). New "relaxed" customers are very patient; they
  come once 40 have been served, so the opening stays as balanced as before.
- **Build mode (M5, `src/sim/game/build.ts`):** pick a piece, tap a green tile, place it.
  A tile is buildable only on dining floor nothing needs now or in any bigger building, and
  only if every chair, table and work spot stays reachable with every table and second chair
  in place (a flood fill from the door). Decor: flower bed, floor lamp (glows at night),
  aquarium (fish swim; from the Bistro), golden statue (from the Grand restaurant); each has
  a "place one more" row and an endless track with four looks. Save v3 keeps positions;
  a piece whose spot is gone moves to the nearest free tile.
- **Expansions (M5):** milestone tier 5 = level 100. The stove, sink, fridge and street sign
  get a bigger model (chef's range with a copper hood, industrial dishwasher with a steam
  tower, walk-in fridge, lit billboard) in a puff of building dust; the row says "+ bigger!"
  on the way there. Everything else keeps the gold aura (from Lv 75).
- **HUD (M5b, `src/ui/Hud.tsx`):** coins top left, the day in the middle, the rating top right,
  in both languages (coins fly to fixed spots). The canvas only reports, through one shared
  value, coins still in the air and how many coins/stars have landed: the counter rolls up as
  they land (never shows money that has not arrived) and the icons bounce on each landing.
  Polled at 15 Hz (coins) and 2 Hz (day, rating) — never per frame. The icons are vector art
  baked once into PNGs at the screen's density. This replaced the sharp HUD atlas.
- **Opening animation (M5b, `src/ui/Splash.tsx`):** plays on every launch. The game mounts
  under it once the intro has played (its loading would stutter the intro on web) and it
  fades out as soon as the art is baked (`onReady` from the canvas); a tap skips the wait.
- **First run (M5b):** welcome (with the language choice) → manager and restaurant names
  (optional; a dice suggests names; kept in the settings store on this phone only) → three
  how-to-play cards → a tutorial: a white glove taps what to do next and a message says it
  (seat a customer → serve the dish → coins and tips → buy an upgrade → hire a helper →
  "you run the place now"). Each step ends by itself when it is done (`src/sim/tutorial.ts`,
  pure and tested: a scripted new player finishes in ~100 s of game time); Skip any time.
  The game is frozen behind the welcome screens. A player who already has a save only picks
  names (no lessons). Reset progress starts the whole first run again. The names show on the
  welcome-back screen, the "restaurant grew" banner and in the settings (editable), where
  "How to play" also lives.
- **Service grade and reviews (M5c, `src/sim/game/reviews.ts`, numbers in `src/data/reviews.ts`):**
  every paying customer grades the visit 1–5 stars by the patience they had left (stars pop
  over their head). The grade scales the whole bill (×0.55 … ×1; good play earns five stars,
  so the old pace is kept there) on top of the mood tip. One in four groups writes a review
  (at most one per 45 s, not before the 8th guest): a card under the rating with the stars,
  a line, a name and the bonus — 4★ = one more bill, 5★ = two more bills and "Trending" (+20 %
  arrivals for 15 s). The balance bot (near-perfect service) builds the bistro at 31:00
  (was 33:56); a slow player (4 s reactions) gets 3–5★ and earns less, as intended.
- **Balance pass (M7a):** 2-hour bot run: no dead zones or income jumps; bistro ~31 min, grand
  restaurant ~1 h; a slower player (3 s reactions) opens the bistro at ~40 min. Endless quest
  levels were ~27 min apart late (the "serve" goal grew too fast) → now ~12 min.
- **Item shop / pay-to-win (M7a, `src/data/shop.ts`, rules in `src/sim/shop.ts`):** 💎 gems
  under the coins (tap = shop). 20 to start, +10 per restaurant level-up; gem packs are a
  **demo** (a confirm dialog says no money is charged; ₪ prices are only shown). Spend gems on:
  income boosts (x2 for 30 min, x5 for 10 min; the time left shows next to the gems), time
  warps (1 h / 4 h of the recent income rate, at once), **star workers** for every job (level 6,
  top skills in the job's stats, charmer + workaholic, gold badge; only if there is room), and
  permanent perks (all prices x1.5, customers x1.25, cooking x1.5, tips x2; one each, they also
  count for offline earnings). Save v5 (gems, perks, a running boost); older saves get 20 gems.
- **Quests and restaurant levels (M7, `src/data/quests.ts`, rules in `src/sim/quests.ts`):** the
  restaurant has a level; each level is three goals (upgrade X to Lv N, serve N, earn N, hire a
  job, team of N, rating, tables, five-star reviews, decor, turbo, combo, open the bistro...).
  A done goal is claimed for coins; claiming the last one levels the restaurant up with a bonus
  (x3 that goal's reward), a banner and confetti. Levels 1–10 are hand-made to teach the game in
  order; after them levels are generated forever. Progress is read from the state (all-time
  counters), so goals already met when a level opens are just done. Save v4 (+ quests and the
  counters for five-star reviews, turbo uses and the best combo); v3 saves start at level 1.
  Rewards are small on purpose (the bot reaches level 10 around 36 min); with them the bistro
  came ~20 % sooner, so it now costs 3.6M (was 2M): the bot builds it at 29–32 min over three
  seeds. The bot now also claims quests, uses turbo for a turbo goal, and gives a bonus to anyone
  close to quitting (gossips wear the rest down; without it 15 people quit in 90 minutes).
- **Shift manager (M6, `SHIFT` in `src/data/staff.ts`):** a job hired from applicants once the
  team has two waiters and five people (one at a time). Red suit, clipboard, posted at the end
  of the pass: calls out ready dishes (the guest closest to losing patience first), waiters work
  +20 % faster (at charm 5) and tire 40 % less, the floor team gains morale, and every ~9 s the
  manager walks to the most impatient seated guest and calms them (+35 % patience, a heart).
- **Rush hour (M6, `RUSH`):** hold the 🔥 button (next to the gear): everyone works +60 % faster
  while the meter lasts (8 s), each second costs every worker 1 % morale; the meter refills in
  40 s. The screen edges glow orange while it runs.
- **Upgrades screen (M6):** opens on "★ Best value" (the 12 best gains per coin, from a pure
  estimate in `src/sim/economy/value.ts`, weights `VALUE` in `src/data/balance.ts`); a search
  box across everything, a "Can buy" filter, and a "★ Best value" tag on the best affordable row.
- **Applicant shortlist (M6):** "👍 Recommended" on the waiting applicant with room, no bad
  habits, at least typical skill for their level, who is the best hire for the money.
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
- M5 pacing (seed 1, 90 min): bigger building at 33:56 (target 30–45 min; the bot saves up
  for it once it costs ≤ 3 minutes of income), the Grand restaurant at about 1 h. Coins/min:
  528 at 6 → 121K at 25 → 2M at 37 → 30M at 60 → ~600M at 85. Late game buys 14–23
  things a minute (was 4–6 before decor). No dead zones, no income explosions. Floods of
  ~50 buys/min at minutes 24–26 (second cook + couples) and 31–42/min around the building.
- Couples are the reason two-chair tables pay: a single guest at one still leaves the second
  chair empty. Chairs cost 200 × 2.3^n, so they ramp up slowly.

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
| Same, JS-thread touches (another sandbox session) | ~27 | — | 12.9–13.5 |
| M5 diner / bistro / grand, production build | 40 / 69 / 111 | 1.2 / 2.1 / 1.7 ms | 10–12 / 12 / 13–14 |
| M5b busy diner, new RN HUD overlay | ~45 | — | 12.3 |
| M5b new game during the tutorial (glove + message) | 27 | 0.7 ms | 16–18 |

Frame build (CPU work per frame) is far below the 16.6 ms budget; the low FPS is software
rasterization. **Not yet measured on a phone** — the owner should check the FPS overlay with
"+60" on. If GPU-bound on mid-range Android: batch tinted sprites with `drawAtlas` per tint.

## How to verify

- `npm run check` — typecheck + 234 unit tests.
- `npm run balance -- --minutes 60` — the pacing report.
- `npm run web` (browser) or `npm start` + Expo Go (phone).
- `npm run export:web` — production web build in `dist/`.

## Known issues / not verified

- Not run on a physical Android/iOS device by me (sandbox has no device or emulator). The
  first-touch crash on the owner's phone is fixed (touches moved off gesture-handler worklets
  to plain React Native touches) — confirmed by the owner.
- The M5b build closed on the phone during the opening animation (no error; fine in the
  browser): a plain helper (`iconCenter`) was called from the HUD anchors, which the canvas
  runs on the UI thread every frame. Fixed, and `tests/worklets.test.ts` now reads the source
  and fails on any UI-thread code (worklets and Reanimated callbacks) that calls one of our
  plain functions — the same kind of bug as the first-touch crash.
- Not seen on a phone yet: the name fields with the on-screen keyboard in landscape (the card
  sits at the top of the screen so the keyboard has room), and the opening animation's timing
  on a real device.
- Tutorial "hire a helper" waits for an applicant at the door and enough coins for the
  signing fee; a new player keeps serving meanwhile (or taps Skip).
- Customers enter/leave through the front door of the building, but there is no visible door
  frame yet (front walls are cut away by design).
- Expo DevTools fails to launch in the sandbox (runs as root) — harmless.
- Sound: checked in the browser that every file loads and plays (no errors), but I cannot
  listen in the sandbox; vibration is not felt on a real phone yet either.
- Seating is manual until you hire a host (M4); while the app is closed the offline estimate
  assumes slow seating by the staff. Deeper automation comes in M6.
- Staff jobs are still simple loops; workers never take breaks (energy only lowers speed).
- Tables stay on their fixed spots (only decor can be moved in build mode).
- The bot puts decor on the free tile nearest the back corner, so its rooms look clustered;
  players choose.
- Applicants only come one or two at a time at the door; there is no job board / ads yet.
- Very large numbers in floating "+N" texts use JS numbers (fine up to ~1e308); the HUD and
  menus use `Big`.
