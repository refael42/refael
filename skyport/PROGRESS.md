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
| M6 Terminal & passengers | done | see below |
| M7 Airlines | done | see below |
| M8 Full fleet | done | see below |
| M9 Advanced ATC | done | see below |
| M10 Maintenance & fuel | done | see below |
| M11 Events | next | weather events, birds, FOD, emergencies, VIPs, celebrities, air show, holidays |

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

### M6 — terminal & passengers (done)
- Departing passengers walk in from the parking lot and queue in serpentine lines (belt barriers,
  rows 0.5 tile apart): check-in counters -> security scanners -> airside door -> hut/terminal.
  More counters / scanner lanes come from upgrades; a check-in agent speeds up the counters.
- Baggage: every check-in sends a bag along the conveyor. A passenger checked in after the
  plane's bags were already loaded is a lost bag (mood hit, toast, counted in stats).
  Arriving passengers wait at the claim carousel until their bags are unloaded (or 45 s).
- Shops: passengers with time before boarding visit the kiosk and really buy (amount from the
  passenger type, more when early, times the tier pay). Sales show as a floating coin.
- New upgrades: more counters, scanner lanes, faster scanner, faster conveyor. Tapping a desk or
  scanner opens the terminal upgrades.
- Headless check (seed 5, 15 min): 1 counter -> 4 lost bags, 10 s average queue; with 3 counters
  and 2 lanes -> 0 lost bags, 4.7 s queue; shop sales ~1K at kiosk level 5.
- Hebrew fix: "a ← b" effect lines read backwards when both sides were Latin ("x1 ← x1.25");
  `translate` now adds right-to-left marks around the arrow (tested).
- Test switch `cam=x,y,zoom` for close-up screenshots.

### M7 — airlines (done)
- Every arrival now comes from an airline contract. A new game starts with Meadowlark Air
  (regional, 10 flights a day); offers arrive every 2–3 minutes like job applicants and expire.
  Contract slots per tier (2 at the dirt strip, 3 at the small airfield, up to 9).
- Seven airline kinds in a data table (low-cost, regional, national, cargo, luxury, charter,
  private): pay, flights a day, turnaround allowance, on-time goal, loyalty, season length,
  required facilities. Two new fictional airlines (Cloudberry Air, Paperkite) for tier 2.
- Negotiation: ask for +15% pay (chance grows with reputation; a "no" loses the offer and a
  little reputation) or give a 12% discount for more flights. One try per offer.
- Reputation per airline (0–100): on time +2, late -4, diverted -10, mood and lost bags count,
  loyal airlines forgive more. High reputation sends bigger planes and lets you ask for more
  flights. Unhappy airlines warn, then leave after 4 more bad flights; your last airline never
  leaves (it cuts flights instead, so the game can't dead-end). Charters run a 3-day season and
  pay a 20% bonus when the goal was met.
- Capacity: stands x 14 flights a day, capped by the taxiways (30 / 42 a day on the two maps).
  The airlines panel shows traffic against capacity; the "best value" upgrade stops pushing
  marketing when the airport is full. The tower spaces planned arrivals so the runway gets a
  steady flow.
- Flight board: departures / arrivals with split-flap times and flight codes, statuses
  (scheduled, approach, holding, landed, on time, boarding, gate closed, delayed with an
  expected time, departed, cancelled). Tap a live flight to jump to it on the map.
- Bottom bar: 6 buttons (upgrades, staff, airlines, board, airport, build); they fit one row on a
  phone and split into two even rows on very small screens.
- Balance (bot, 90 min, seed 1): 344 flights, 80% on time, tier 2 at 10.2 min, 2 airlines left
  when the bot pushed past capacity.
- Save version 5 (contracts, offers, reputation by airline id) with migration: older saves keep
  the starter airline, plus Bluefin Express at tier 2. The schedule itself is rebuilt on load.

### Landscape only (owner request, after M7)
- `app.json` locks native builds to landscape. On the web, a phone or tablet held upright gets a
  "turn your phone sideways" screen over the game (the game keeps running underneath).
- Panels (upgrades, staff, airlines, airport) open as a full-height side drawer on the end side
  (right, or left in Hebrew) so the map stays visible; toasts move into the visible part.
- Landscape phones get a compact bottom bar with the best-value tip beside it (when it fits).
- Every browser scenario now runs in landscape (844x390, 667x375, 568x320, tablet 1180x820),
  plus one upright phone that must show the rotate screen.

### Art detail pass (owner request, after M7)
- Fuel truck rebuilt: cab with wraparound windows, mirrors, grille and headlights, three axles
  with hubcaps, striped side skirts, a strapped tank with a red band, walkway and hatches, hose
  cabinet and tail lights. Baggage train: a tug with a seated driver under a canopy, carts with
  rails and suitcases with handles. Both blink an amber roof beacon while working.
- Private cars (sedan, hatchback, SUV, van, taxi, pickup, shuttle bus) in 12 paint jobs, drawn in
  16 directions. Background traffic (render only, a pure function of the sim clock): cars drive
  down the access road, stop at the curb with hazards blinking, U-turn and drive away; the parking
  lot fills up as more flights are served.
- Aircraft lights: red and green wingtips, a white tail light, a flashing red beacon while engines
  run, white strobes in the air and on the runway, a landing light on final and takeoff.
- Ground: road edge lines, dashed center line, a zebra crossing where passengers cross, a second
  row of parking bays with aisle arrows, stand numbers painted on the apron. Props: street lamps,
  a parking sign, taxiway signs, luggage trolleys, planters, cones around plots still to build.
  The field fence stops where the terminal, road and parking lot form the boundary.
- Gallery shows every car and vehicle; `cam=` works there too, and `follow=1` keeps the camera on
  a plane for close-up screenshots.

### M8 — full fleet (done)
- Tiers 3–5 are playable. Regional: the runway moves south and gets a parallel taxiway (every
  plane leaves at the first exit and taxis to its stand off the runway), two medium stands and a
  private-jet stand by its lounge (FBO). City: a glass pier with jet bridges (one gate takes
  wide-bodies) and a cargo apron. International: a second runway for departures only, reached by a
  taxiway around the west end (no runway crossings), and a helipad.
- 10 of the 11 aircraft fly (Condor waits for the mega-hub). Big jets are drawn less exaggerated so
  they fit; airliners are stored smaller in the atlas, and the atlas holds only the current tier's
  liveries (rebuilt on a tier upgrade).
- Stands by size: a plane gets the smallest free stand it fits; special stands (FBO, cargo, pad)
  take only their own kind. Stands are built through upgrade lines (medium stands, FBO, gates,
  cargo apron, helipad); a VIP lounge line; more trucks and carts at the bigger tiers.
- Airlines: national carriers need jet bridges and a lounge, cargo needs the apron, luxury needs
  the FBO. Offers are capped by the stands that fit the airline's planes; the offer card warns
  when signing would push traffic past capacity.
- Wake turbulence: after a heavy, a light plane waits up to 10 s (super: 14 s) on that runway.
  At tier 5 landings and takeoffs no longer wait for each other. Helicopters fly straight to the
  pad. Freighters carry pallets (no passengers). Jet bridges: boarding from the gate, faster, and
  a mood bonus. Passengers on airliners walk in groups (one figure = several passengers).
- Fixed a ground deadlock that only big maps can show: a departure leaving a waiting spot now
  reserves the whole shared stretch up to the next one (it never stops where arrivals pass).
- Tests: every layout is a DAG with reachable stands and no overlapping parked planes; stand fit,
  needs, wake, two runways, helicopter, freighter, jet bridge; 2000 mixed flights on the
  international map with one plane per runway, no collisions and no jams.
- Balance (bot, 4 h, seeds 1/7/13): tier 3 at ~56 min, tier 4 at ~146–151 min, 3–4% diverted.
- Test switch `full=1`: everything of the tier built and its airlines signed (screenshots).

### M9 — advanced air traffic control (done)
- Weather is a pure function of the seed and the clock (keyframes every 150 s, wind regimes that
  last ~20 game minutes), so it is never saved and every game has its own. Mostly an easterly;
  now and then a westerly. Fog banks from the small airfield on (never on the dirt strip).
- Crosswind limits per wake class (light planes give up first); fog closes the runway below the
  ILS minimum (ILS levels 0–3). Tower upgrades shorten wake gaps and make missed approaches rarer;
  radar lets planes hold longer and allows more in the air.
- Runway direction follows the wind on tiers 3–5 (own taxi routes for each direction). A runway
  change is done like at a real airport: arrivals hold, nobody new pushes back, the departures
  already out leave the old way, and once the ground is clear the runway turns (about a minute).
  Without that, departures still headed the old way could block the new arrival lane (a real
  deadlock found by the balance bot at tier 4; a test now flips the wind every 3 minutes).
- Go-around: at the threshold a plane climbs away if the runway is still taken, or now and then
  from an unstable approach (crosswind near the limit, fog); it comes back around. The tower may
  clear the next approach while the plane ahead is still rolling out, if it should be off in time.
- Diversions from other airports: every 7–15 minutes (from the small airfield on) a plane low on
  fuel asks to come in. It pays double; if you can't take it, it goes on elsewhere without
  counting against you.
- Reverse-direction hold points got a dog-leg so a waiting jet's tail is off the shared lane, and a
  departure entering a shared stretch reserves on until its whole tail fits on the waiting spot
  (a test checks every layout and direction).
- Screen: HUD weather chip (wind arrow in screen space, knots, fog badge, red on strong crosswind),
  a fog layer over the map, the windsock streams with the wind, a turning radar beside the tower,
  toasts (runway change, fog in/out, crosswind, go-around, diversion request), and the flight
  card says why a cleared plane is still circling (fog, crosswind, runway change, wake, runway).
- ESLint set up (`npm run lint`, Expo config). The React Compiler is not enabled, so its
  compiler-only rules are off (the game loop keeps state in refs on purpose).
- Test switch `wx=fog|cross|west|calm`: fixed weather for screenshots.
- Fairness: fog is never thicker than the best ILS the tier can buy (tier 2: ILS 1 is enough;
  tier 3: ILS 2; from tier 4: ILS 3), so fog is a problem the player can solve. A diversion in
  fog, crosswind or during a runway change counts as a delay (not a failure) with the airline;
  slots of parked planes move with a runway change; patience drains half as fast during one.
  Diversions from elsewhere only come in when there are two free stands and a quiet sky.
- Balance (bot, 4 h, seeds 1/7/13): tier 3 at 55–58 min, tier 4 at 144–155 min (as in M8);
  0.6–4% diverted, ~1.5% go-arounds, 9–14 guest (diverted-in) flights landed; on time 87/68/87%.
  Seed 7 is harder than in M8 (more lateness at tier 3), the other two are as good or better.

### M10 — maintenance & fuel (done)
- Fuel farm (from the small airfield; the dirt strip pump never runs dry): a stock in liters that
  the fuel trucks draw from. When stock plus what is on its way falls below 45%, an order goes out
  by itself and a tanker drives in by road (main road, service road, a gate in the north fence)
  and unloads at the fuel bay. An empty farm leaves the truck waiting at the plane.
- Suppliers: budget (cheap, often late), regular (reliable) and green (dearer; every flight it
  goes into gets a little mood). Urgent orders cost 2.2× and arrive in 45 s. Airlines pay for the
  fuel pumped into their planes (a small margin; the game is not running dry). Upgrade line
  "Fuel farm" (more tanks, sized so each tier's traffic can bridge a tanker's lead time).
- Mechanics (new staff role, regional airport on) and technical faults (AOG): about one arrival in
  twenty is grounded at its stand until the mechanics' van comes and fits spare parts from the
  parts store (its own suppliers, urgent orders, "Parts store" line). No part in stock: the
  mechanic waits for the delivery. A hired mechanic sends the van by himself; otherwise it is a
  tap (a red wrench bubble). The airline allows for part of the repair in the schedule.
- Hangar (regional on, 2nd bay at the city airport): contracted airlines send their smaller planes
  in for A and B checks when a bay is free and the sky is quiet. A check is mechanic work with
  parts, pays 5× / 14× the landing fee, lifts the airline's mood a little, and a hangar makes faults
  rarer. The hangar has its own one-way taxi loop so no link crosses another (a test checks the
  clearance of every hangar link against every other link).
- Taxi rule tightened: a departure entering a shared stretch reserves on until its whole tail fits
  on the waiting spot including the gap it stops short (found as a reverse-ops deadlock at tier 4).
- Tier 4's runway capacity is now 44 flights a day (one runway for both, wake gaps behind jets).
- Art: fuel farm with up to four tanks (ladders, railings, hazard diamonds, pipes to a pump skid,
  bund wall, extinguisher, no-smoking sign) and a live level gauge; parts warehouse with an open
  roller door, colored shelves, a forklift and pallets; arched hangar with lit open doors; gate
  booth with a raised boom; service road; fuel tanker semi, parts box truck and mechanics' van
  (roof ladder, lockers, beacon); mechanic in navy coveralls with a red toolbox and a welding
  flicker; warning triangle and cones around a grounded plane.
- Screen: "Supplies" panel (stock gauge with the reorder mark, use per minute, how long it lasts,
  deliveries on the way, supplier cards, urgent order, hangar status), toasts, a fault chip and a
  repair meter on the flight card.
- Test switches `fault=1` (a grounded plane, selected) and `tanker=1` (deliveries unloading).
- The atlas builds only the vehicles a tier uses (tanker from the small airfield, van and parts
  truck from the regional airport), so loading stays as fast as in M9 (~4.8 s on the headless
  test browser). The save/reload browser test now waits for the game to be ready instead of a
  fixed 2.5 s (it was on the edge already in M9).
- Balance (bot, 4 h, seeds 1/7/13): tier 3 at 57–59 min, tier 4 at 150–177 min (M9: 144–155);
  27/27/11 diverted (M9: 5/36/23), on time 72/72/82% (M9: 87/68/87%), 17–28 hangar checks,
  9–12 faults, the fuel farm ran dry at most once. Each new system (faults, checks, fuel) adds a
  little pressure at the single-runway city airport; softened until the total matched M9's
  (faults 3% of arrivals with the repair in the schedule, checks only with a quiet sky).

### Playable build (owner request, after M10)
- `npm run pack:play` makes `artifacts/play/` (relative paths, bundles in `js/`, plus `page.html`, a
  fragment for hosts that wrap the page) that runs from any sub-path. Published as a private
  Artifact for the owner to play in the browser (saves stay in that browser). CanvasKit loads
  from a relative path now.
- Zoom (owner request): the mouse wheel zooms toward the cursor (a trackpad pinch too); on a
  phone two fingers zoom, and the browser leaves map gestures to the game (no page zoom or
  scroll). Browser tests drive a real wheel and a real two-finger pinch.
- Clearer how-to-play (owner request): 21 goals lead from the first landing to the helipad of the
  international airport, one at a time: what to do, how, progress, a coin reward, and "show me"
  (the hand points at the right button, or at a plane). A new goal opens in full for 15 s, then
  folds into a chip. A "?" button opens "How to play": the five taps of a turnaround with the
  same bubbles as over the planes, then money, staff, upgrades, airlines, growing the airport,
  building, weather, supplies, maintenance and controls (later topics marked with the tier that
  opens them). Old saves skip goals already done, without back pay.

## Notes / decisions
- The game lives in `skyport/` inside the `refael` repo (the repo root is a different app). The owner
  left the choice open; it stays here (no extra repo to set up).
- Web test switches (web only): `?seed=N&warp=S&auto=1&speed=K&select=1&hook=1&screen=gallery&stands=N&crew=1&money=N&panel=staff|upgrades&tier=N&build=1&cam=x,y,zoom&panel=airlines|board&tab=0|1&follow=1&full=1&wx=fog|cross|west|calm&fault=1&tanker=1`.
  Any of them disables loading/saving unless `save=1` is added.
- Planes are drawn 1.35× larger than "true" size (`ART_SCALE`) so they read on a phone.
- Skia on web: `canvaskit.wasm` is copied to `public/` by `postinstall`; `Root.web.tsx` loads it
  with `WithSkiaWeb` before importing any module that touches Skia.
