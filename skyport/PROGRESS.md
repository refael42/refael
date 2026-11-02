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
| M1 Dirt strip | done | see below |
| Modern restyle | done | requested by the owner, see below |
| M2 First staff | done | see below |
| M3 Economy & upgrades | done | see below |
| M4 Full staff system | done | see below |
| M5 Airport tiers | done | see below |
| M6 Terminal & passengers | next | |

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

### M1 — the dirt strip (done)
- Tier 1 layout (`src/data/tiers.ts`): dirt runway, one stand, hut, fuel pump, windsock, road, fence.
- Flight state machine (`src/sim/game/flights.ts`): inbound → holding → final → landing → rollout →
  taxiIn → deboarding → turnaround → boarding → doorsClosed → taxiOut → holdShort → lineUp → takeoff,
  plus diverted. Runway is exclusive (landings first); planes circle with draining patience and divert.
- Player taps (one finger): clear to land, send fuel truck, start boarding, clear for takeoff.
  Off-screen requests show a marker at the screen edge; tapping it acts and pans to the plane.
- Passengers walk out of the hut to a waiting area, board, and arriving ones walk into the hut.
- Fuel truck drives over, fuels (no boarding before fuel), drives back; requests queue.
- Pay at liftoff = (landing fee + parking + passenger fee) × mood (0.7–1.3) × punctuality (1.15 / 0.85).
  Rating = moving average of mood. Fast service pays ~1.8× slow service per flight.
- HUD (coins, diamonds, rating, day/time), flight card, toasts, settings (language, FPS, art test).
- Ground is recorded once and baked into image tiles (8 → 38 FPS in software rendering).
- Tests: full lifecycle order, runway exclusivity, determinism, diversion, turnaround dependencies,
  fast-vs-slow economics, 2-hour soak. Browser test taps the plane through a full flight.
- Balance (`npm run balance -- --seed 1`): ~54 coins/min, ~39 per flight, 100% on time with a 1.5 s bot.

### Modern restyle (done, owner request)
- Art: hue-matched thin outlines instead of black line art, flat icons, colored action pins
  (green land, amber fuel, blue boarding, indigo takeoff), low-poly trees, smooth ground with soft
  blurred patches and mowing stripes (no checkerboard), clean runway with edge lights.
- UI: light "glass" theme (frosted white capsules, soft shadows, 24 px radius), floating flight card
  with a route line and colored action button, iOS-style switch and segmented language control,
  dark loading screen with glow.
- This replaces the spec's "dark outlines" style; the rest of section 17 still applies.

### M2 — first staff (done)
- Taxi graph (`src/sim/game/graph.ts`): one-way edges, a DAG from the runway exit to the stands
  to the hold-short point. Planes reserve each edge together with its end node before entering
  and release them when the tail clears.
- Deadlock rule (found by the 2000-flight test): a departure may leave its stand only after
  reserving the whole shared stretch up to the first "safe" (departure-only) edge, so departures
  only wait at their stand or in the departure queue, never on the arrival lane.
- Three stand plots on the apron (one built; M3 builds the rest).
- Baggage service: a tug with carts unloads and loads; doors close only after bags and boarding;
  fueling not during boarding. Pending actions are a bitmask; the card shows one button each.
- Staff: tower controller (landings/takeoffs), fueler, baggage handler and check-in agent
  (boarding; it is a "start" role in the spec and boarding otherwise stays manual). One applicant
  per role, hire cost and daily wage, max 2 per role. Applicants use hash01, not the shared RNG.
- UI: bottom bar, staff sheet, multi-action flight card, "waiting for taxiway" marker.
- Tests: graph is a DAG; 2000 flights on 3 stands — 0 diverted, min ground separation 1.66 tiles,
  longest ground wait 17 s, runway exclusive; hiring limits/money; a full crew runs the airfield;
  wages once per game day; hiring does not touch the shared RNG.

### M3 — economy, upgrades, save (done)
- Upgrade catalog (`src/data/upgrades.ts`, 14 lines for the dirt strip): ticket counter, landing fees,
  snack kiosk, billboard (traffic), new stands (build time), faster pump, lighter carts, second
  truck/cart (build time), taxiway grading, runway lights, benches, staff coffee, night manager.
- Costs grow geometrically in whole coins; x1 / x10 / x100 / MAX; income lines double at levels
  10, 25, 50, 75, 100. One construction crew; tapping the crane speeds it up.
- "Best value": estimated income gain per coin from a per-source income history (landing, parking,
  passenger fees, kiosk); shown as a pill above the bottom bar and at the top of the sheet.
- Upgrades show up in the world: kiosk, billboard, benches, the crane on the plot being built.
- Save (`src/sim/save.ts`): versioned JSON, autosave every 8 s, on background and on exit.
  `clean*` checks and clamps every field; derived things are recomputed; planes and passengers
  are not restored (the airfield resumes with empty stands). Future-version saves are kept
  untouched and the game does not overwrite them. v1 -> v2 migration.
- Sim time continues across loads; construction stores remaining seconds, so time away is a
  subtraction. Offline pay = max(recent net rate, floor) × time × 0.5 × staff coverage, capped
  at 2 h + night manager levels. "Welcome back" card.
- Balance (`npm run balance -- --seed 1`, 90 min): 299 purchases, longest gap without a purchase
  1.1 min, 2nd stand at min 18, 3rd at min 36, income 54 -> ~7,000 coins/min, 0 diversions.
- Tests: bulk = sum of singles, whole-coin prices, MAX never overspends, caps, milestones, build
  crew/rush, vehicles, effects raise pay, save round trip, hostile save file, future/corrupt files,
  v1 migration, offline floor/cap/clock-backwards, construction while away.
  Browser: upgrades sheet, 25-min bot game, welcome-back from a fixture, real save -> reload.

### M4 — full staff system (done)
- Applicants arrive on their own (every ~75–135 s, up to 5, each leaves after ~10 min) with a
  CV line, rarity (common 60% … mythic 0.5%), 1–2 traits, a level and pre-spent talents.
  Rarer = faster, higher level, pricier. The first pool is one modest applicant per role.
- Hire, negotiate (one try: cheaper deal or they walk away; harder for rare people), or a trial
  shift (2 min, fee paid only if you keep them; one trial at a time).
- Work gives XP; level-ups give talent points (speed, stamina, precision, charm, efficiency,
  loyalty; max 5 each). Energy drains per job; tired people take a 25 s break.
  Mood drifts with rest, fair pay and gossiping coworkers; speed × (0.8 + 0.4 × mood); quit at 0.
- Traits: diligent (+10%), charming (happier passengers), night owl, workaholic, clumsy
  (drops bags: the job takes longer), gossip.
- Raises: rare, one open request at a time; yes / half / no (half may be refused); unanswered
  for a day counts as no. Fire (team mood dips) and transfer to another role.
- All of it uses per-game hashes (seed mixed in), never the shared RNG.
- Balance: at a human pace of 6 taps/min, a crew earns ~4,400 coins/min vs ~460 without staff
  (and 25 diversions). `npm run balance -- --seed 1 --apm 6 [--no-staff]`.
- UI: staff sheet with Team / Applicants tabs, CV cards, talents, transfer, fire, raise and trial
  banners; badge on the Staff button when something needs you. Save version 3 (+ migration).
- Heroes (mythic free characters from packs/events) come with the shop (M18).

### M5 — airport tiers (done)
- Tier table for all 8 tiers (names, requirements, build time, pay and traffic multipliers).
  Tier 1 (dirt strip) and tier 2 (small airfield) are playable; tiers 3–8 show as "coming".
- Tier 2 grows the map in every direction and keeps every tier-1 node and stand in place:
  longer asphalt runway with markings, taxiways with yellow centerlines, 5 stands, a terminal
  and a control tower, a new airline, pay x2, traffic x1.3. Stand upgrades go to level 4 there.
- Growing is a construction project (cost, flights served, rating; 90 s; tap the crane to rush).
  When it finishes, new landings wait until no plane is on the ground, then the map switches —
  no taxi route ever spans two maps. Tested with 2000 flights on the 5-stand map.
- Build mode: drag the kiosk, benches and billboard; green/red tile under the ghost; spots are
  checked (not on runways, taxiways, stands, buildings), snapped to half tiles, saved.
- First launch: language, manager and airport names with a dice, three "how to play" cards; then
  a pointing-hand tutorial (land -> bags/fuel -> board -> takeoff -> upgrades -> buy -> staff,
  skippable). Loading screen: a little plane rolls down the runway bar and lifts off.
- Balance: tier 2 reached at minute ~11–16 (seeds 7, 13, 1); target was ~10.
- Save version 4 (tier build, names, decorations) with migration.

## Notes / decisions
- The game lives in `skyport/` inside the `refael` repo (the repo root is a different app).
- Web test switches (web only): `?seed=N&warp=S&auto=1&speed=K&select=1&hook=1&screen=gallery&stands=N&crew=1&money=N&panel=staff|upgrades`.
  Any of them disables loading/saving unless `save=1` is added.
- Planes are drawn 1.35× larger than "true" size (`ART_SCALE`) so they read on a phone.
- Skia on web: `canvaskit.wasm` is copied to `public/` by `postinstall`; `Root.web.tsx` loads it
  with `WithSkiaWeb` before importing any module that touches Skia.
