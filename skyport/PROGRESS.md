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
| M11 Events | done | weather, birds, debris, emergencies, VIPs, air shows; medical cases, celebrities, historic planes, real-date holidays (the undercover inspector moves to M12 with the reviews) |
| Big terminals | done | owner request: open-roofed Terminal 1 (small airfield on) and a big Terminal 3 (city airport on), every step from the curb to the plane in view; apron buses |
| The hub (tier 6) | done | Concourse D satellite with a people mover, Terminal 3 grows, a railway station |
| The mega hub (tier 7) | done | Terminal 4 for the jumbos (3 jumbo gates), Globetrail, a second cargo stand |
| M12a cleanliness | done | litter, cleaners, bins, the rating breakdown panel |
| Sharp zoom | done | owner request: sprites and the ground drawn again at the zoom's resolution when close in |
| M12b reviews | done | 244 lines in he/en by topic, a reviews tab, a bonus for good reviews |
| The night | done | owner request: dusk, night and dawn; runway, approach and strobe lights, floodlight masts, lamps, headlights; posted guards |
| Ground services | done | owner request: GPU, belt loader, catering truck, pushback tug, stairs truck round parked planes; chocks, cones; stand stop bars and restraint lines; a detailed jet bridge |
| Airport security | done | owner request: guards, cameras, a 3-level fence, patrol cars, a dog team, drone defence; unattended bags, drones and holes in the fence |
| Upgrade versions | done | owner request: the kiosk, billboard (animated LED), benches, tower (blinking beacon) and radar change look as they level up; a pop when bought |
| M13c festivals & flash deals | done | a themed festival every 3 game days with three prizes and a trophy; a 40% deal every 3 real hours |
| M13b daily gift & wheel | done | a 7-day streak of gifts, a free spin every 4 real hours, odds shown, extra spins for diamonds |
| M13a manager & achievements | done | levels with coins and chests (double income), 19 achievements with four medals each |
| Calm screen | done | owner request: fewer messages, one rule for all of them, at most two at once |
| M12c+d Aviation Guide | done | stars every 7 days for 6 parts, the undercover inspector (rumor, suspects, VIP care, notebook), ceremony, pylon |
| The skyport (tier 8) | done | vertiport with electric air taxis (Hoverly), the airport hotel |

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

### M11 — events (part 1)
- Events table (`src/data/incidents.ts`): kind, first tier, weight, duration, warning, cooldown.
  One every 8–15 minutes from the small airfield on, picked by weight with hashes (never the
  shared RNG); one runway closure at a time.
  - Thunderstorm (announced 45 s ahead): no landings, takeoffs or fueling for 75 s. Rain
    streaks, a dark sky, lightning flashes.
  - Birds (regional on): a flock wheels over the touchdown zone; the next plane to land takes a
    bird and gets an inspection by the mechanic. "Bird control" upgrade makes flocks rarer.
  - Debris on the runway: closed until the yellow inspection car (checkered flag, light bar)
    drives out from the new fire station, picks it up and drives back.
  - Emergency: an inbound plane declares one; it lands before everyone (no takeoff or other
    landing ahead of it), two crash tenders roll out beside the runway with red lights, the
    runway is inspected 20 s after it lands. In time: the airline's thanks (coins, reputation,
    rating); left circling past 3 minutes: blame.
  - VIP flight: red carpet with brass stanchions to the door and a black car; happy and on time
    it tips as much again as it pays (and the airline likes you more).
  - Air show (announced 2 minutes ahead): the runway closes for 60 s, three aerobatic planes
    loop over the field trailing smoke, a crowd lines the apron, tickets sell.
  - Weekend (game days 6–7): fuller planes; the HUD says so.
- Fairness: through a storm or an air show nobody circling loses patience; during any closure
  parked planes' slots move with it (the airline knows).
- Screen: a bell in the HUD with a red count opens "Events" (what is happening, what to do, time
  left, "Clear to land" and "Show the plane" for an emergency, how recent ones went); toasts for
  every step; emergency and VIP chips on the flight card; storm/closure as hold reasons.
- Found and fixed through the balance runs: airline offers were capped by the stands of their plane
  size per airline, so three large-jet airlines could all be offered the same two gates (a tier-4
  pile-up of "no free stand"). Offers and expansions now count what the other contracts already
  fly on those stands. Tier 4 capacity 42 flights a day.
- Balance (bot, 4 h, seeds 1/7/13): tier 4 at 155–178 min; 37/25/27 diverted (M10: 27/27/11), on
  time 68/66/78%, 11–19 hangar checks. Events add some pressure; seed 13's old tier-4 pile-up is
  gone.
- Test switch `inc=storm|birds|fod|emergency|vip|airshow` (starts it, under way, camera on it).

### M11 — events (part 2)
- Medical case: an inbound plane reports a sick passenger. It gets landing priority (like an
  emergency). Once cleared, an ambulance (white box, red band, yellow-and-green checks,
  blue-and-red lights) comes in by road through the depot gate and waits on the apron. When the
  plane is at its stand, the ambulance pulls up by the service door on the far side.
  - Nobody gets off before the patient: two paramedics wheel the stretcher across, then the
    ambulance drives off up the road.
  - In time: the airline's thanks (coins, reputation, rating). Left circling past 5 minutes, the
    patient is flown elsewhere (blame).
- Celebrity: a private jet (the Kestrel at an FBO stand, else a light twin, in Velvetjet colors)
  pays 3x and carries the star and a small entourage. You choose in Events:
  - "Let the press in" (default): paparazzi with flashes and a TV camera along the red carpet.
    A happy, on-time visit makes the news, giving +15% passengers on new flights for a game day
    (a "buzz" card in Events). A bad visit costs rating.
  - "Keep it private": bodyguards in black. A good visit tips as much again as it pays.
  - Either way the star walks the carpet to a black limousine.
- Historic plane: a polished-metal propliner ("Silver Star", its own livery whoever flies it)
  asks to visit. Land it and it stands on show for 3 minutes before it may board.
  - Display: a velvet rope with brass posts in front of it, visitors along the rope (some
    strolling, photo flashes), a ticket booth with a striped awning, an information sign.
  - Tickets: 0.5 coins a second x tier pay x rating, counted live in Events, paid when the show
    ends; then it flies on like any other.
- Holidays on real dates: the UI sends the device's date (command `setToday`, so the sim stays
  deterministic). `sim/game/calendar.ts` works out the Hebrew calendar arithmetically (molad and
  postponements); the dates are checked against known ones, e.g. Rosh Hashanah 2023–2027,
  Hanukkah 2025, and Independence Day moving off the weekend in 2024 and 2025.
  - Holidays: Rosh Hashanah, Sukkot, Hanukkah, Tu BiShvat, Purim, Passover, Independence Day,
    Lag BaOmer and Shavuot, plus New Year and Halloween.
  - Each holiday plus its travel days before it: planes 5–30% fuller (stacks with weekends).
  - Decorations: string lights chasing along the terminal roof and holiday-colored bunting over
    the front, plus a centerpiece on the roof:
    - a gold hanukkiah with one more candle lit each night, and the shamash;
    - a sukkah with a palm roof and hanging fruit;
    - apples and honey;
    - saplings;
    - masks and falling confetti;
    - Elijah's cup and matzah;
    - Israeli flags, with fireworks;
    - wheat sheaves;
    - a balloon arch, with fireworks;
    - pumpkins that glow (at the dirt strip, by the hut).
  - Lag BaOmer has a bonfire on the grass with flickering flames and sparks.
  - A toast, a "Day n · holiday" label in the HUD, and a card in Events.
- Help: new "Events" and "Holidays" topics.
- Test switches:
  - `inc=medical|celebrity|celebrityPrivate|historic`;
  - `hol=<id>&holday=<n>` (pretend it is that day of a holiday);
  - after a warp the welcome hint no longer covers screenshots.
- The undercover aviation inspector and the "rumor" (spec section 13) move to M12, where the
  reviews and the Aviation Guide live.
- Balance (bot, 4 h, seeds 1/7/13): tier 4 at 162/166/155 min, 49/19/27 diverted, on time
  74/75/77%. Part 1 for comparison: 178/–/155 min, 37/25/27 diverted, 68/66/78%. The new
  visitors add some load (the historic plane holds a stand for 3 minutes) but nothing piles up.
- Tests: the fault-rate test now measures over three games (a few hundred arrivals) instead of one
  hundred: new incident flights shifted which arrivals the hash picks, and one game was too few
  to say "about 3%".

### Big terminals (owner request, after M11)
"Make the airport really big, like Ben Gurion with several terminals; the terminal a building
without a roof so you see everything inside, every step from arriving at the airport to boarding
and takeoff."

- Terminal 1 (`src/data/terminals.ts`, from the small airfield on) replaces the closed box and
  the plaza. It is an open-roofed building:
  - tall back walls with windows, low glass front walls, glass partitions, sliding doors;
  - glass canopies over the curb doors;
  - floors by zone: check-in, security (yellow line), a carpeted departures lounge, arrivals.
  Inside:
  - check-in counters with the belt to a baggage room outside;
  - the security queue and scanners;
  - a lounge with rows of seats, a café, a board, a fountain and bins;
  - arrivals with the carousel, restrooms and an ATM;
  - hanging pictogram signs.

  The tower and radar moved west to make room.
- Terminal 3 (from the city airport on), north of the gates, takes the big jets (large stands and
  up); Terminal 1 keeps the small and medium planes.
  - Landside: its own road from the north with a curb, taxi boxes, a bus bay and a stop, zebra
    crossings, and a three-deck garage with cars on top.
  - Departures: two entrances, a check-in hall with two islands of counters and self check-in
    kiosks, six security lanes, passport control with booths and officers (international
    airport), a walk-through duty free (shelves of perfume, chocolate, drinks; a till), and a food
    court (stalls, tables).
  - The concourse: gate lounges with seats and gate desks by the jet bridges, and a business
    lounge with sofas.
  - Arrivals: along the concourse into a corridor, passport control (international), the
    baggage hall with three carousels, customs, the arrivals hall (car rental, ATM) and out to
    the curb.
- Sim:
  - Passengers belong to a terminal.
  - Queues and service points are one generic station line, used for check-in, security, and
    passport control out and in.
  - Terminal 3 has two counters and lanes for each one of Terminal 1.
  - Duty free sells 1.6x the kiosk.
  - Waiting passengers move from the food court to their gate once the plane is at its jet
    bridge.
  - A long queue bunches up at its end instead of spilling past it.
- Tests:
  - On every tier, nobody walks through a wall: each step of every person is checked against
    every wall, so people only cross walls at doors.
  - Terminal 3 is busy at the city and international airports.
  - Two real bugs found by these tests were fixed:
    - a smaller plane at a jet-bridge gate: its passengers went straight through walls to it;
    - the passport queue was too close to a partition.
- E2E:
  - `terminal-t2`, `terminal-t3`, `terminal-t3-intl` and `terminal-t3-wide` (these wait until
    Terminal 3 has passengers);
  - the hook adds `terminals()`.
- Balance (bot, 4 h, seeds 1/7/13): tier 4 at 157/163/153 min, 15/25/17 diverted (M11: 49/19/27),
  on time 73/77/81%.

#### Apron buses
- From the regional airport on, Terminal 1 flights at a remote stand (more than 5 tiles from the
  building) or at a jet-bridge gate are served by bus (`src/sim/game/buses.ts`). There are two
  buses, 18 riders each.
  - Departing passengers walk from the lounge out of the gate door to the bus stop. The bus fills
    up, drives along the apron lane, parks beside the plane, and they climb the stairs.
  - Arriving passengers come down the stairs and wait. A bus picks them up, brings them back to
    the stop, and they walk in through the arrivals door to the carousel.
- Fix: a gridlock on the taxiways (tier 4, wind turning). A plane reserved the next edges by their
  straight length, but the drawn route cuts the corners and is shorter, so the plane could stop
  past its reservation. Reservations now keep 0.5 tiles of slack (`CORNER_SLACK`).
- Tests:
  - remote and near stands;
  - buses carry passengers both ways, never more than 18 at once.
- E2E: `apron-bus`.
- Balance (bot, 4 h, seeds 1/7/13): tier 4 at 152/152/166 min, 22/17/10 diverted, on time
  77/72/82%.

#### The hub (tier 6)
The last big stage is playable now (the mega hub and the skyport stay "coming soon").
- Layout (`HUB` in `src/data/tiers.ts`): the world is 90 x 52 tiles.
  - The parallel taxiway runs on east to a new stand lane in front of Concourse D.
  - The cargo apron moves to the far east end.
  - The gates by Terminal 3 are reached from the parallel taxiway in one turn.
  - In the other runway direction, departures turn off the parallel taxiway before the new lane.
- Terminal 3 grows 3 tiles east (`T3_HUB`): a third exit, a fourth carousel, five passport booths
  for arrivals, an info desk, a sculpture, and the people-mover station at the end of the
  concourse. Its road now leaves to the east.
- Concourse D (`CONCOURSE_D`) is a satellite in the apron, open-roofed like the terminals. It has:
  - three jet-bridge gates (D1 large, D2 and D3 huge; upgrade line `gatesD`);
  - a duty free, a food court and a business lounge;
  - gate lounges with seats and desks, and a play corner;
  - its own people-mover station.
- People mover (`src/sim/game/apm.ts`): a two-car train shuttles between the stations.
  - It waits 6 s or more with its doors open, then accelerates and brakes into the next station.
  - It carries up to 30 figures. People get off first, then on.
  - Passengers for a D gate ride out and walk to their gate (some stroll past the shops first).
  - Arrivals at D walk to the platform, ride in, and go on to passport control in Terminal 3.
  - If a plane leaves without them, they ride back.
- Railway (`src/sim/game/rail.ts`): a commuter train calls at the station by Terminal 3 every
  80 s. Its timetable is a pure function of the clock. The line runs between two tunnel portals.
  - While the train is in, some departing passengers get off it and walk down to the curb.
  - Some arriving passengers walk up to the platform and leave on the next train.
- Art:
  - the people-mover car and its guideway;
  - double-deck coaches with cab cars, the platform roof, the entrance pavilion, tunnel portals;
  - a train pictogram sign, a kids' play corner and a sculpture;
  - more farmland east.
- Two new goals: grow into a hub, open Concourse D. New help topics: terminals, the hub.
- Tests (`tests/hub.test.ts`):
  - Concourse D's gates;
  - the train timetable;
  - the people mover carries people both ways, never more than 30;
  - D gates serve flights;
  - people come and go by train;
  - nobody walks through a wall at the hub.

  Tier 6 also joins the fleet tests (in each runway direction, 600 flights, the wind turning) and
  the wall test.

#### The mega hub (tier 7)
Playable now (the skyport, tier 8, stays "coming soon").
- Terminal 4 (`T4_BUILDING`) is the long-haul terminal for the jumbos, built on Terminal 3's
  plan (`shiftBuilding`, `shiftStations`) east of Concourse D. It has:
  - its own loop road off the eastbound road, a garage, a curb with taxis and a bus stop;
  - check-in, security, passport control, a duty free and a food court;
  - three jumbo gates (E1-E3, upgrade line `gatesE`) instead of two;
  - arrivals with carousels and customs; a sculpture and a play corner.
- Only the jumbos (the Condor) park at its gates (`exact` stands), and their passengers use
  Terminal 4 from the curb to the plane (`terminalFor` = 2). The terminal code works for any
  big terminal now (`bigTerminal`, the `toClaim` way into the baggage hall, `homeRoute3`).
- A new long-haul airline, Globetrail (wide-bodies and jumbos), from the mega hub.
- The cargo apron moves to the far east end again and gets a second stand and shed
  (`cargoApron` level 2, from the mega hub).
- The world is 112 tiles wide; the railway's east tunnel moves out with it.
- Fixes found by the new tests:
  - the stroll through Concourse D's shops could walk through the lounge's glass wall;
  - the lounge seats of a gate at the end of a pier could land outside the wall.
- Goals: grow into a mega hub, open a jumbo gate.
- Tests: the jumbos and Terminal 4; tier 7 in the fleet tests (each runway direction, the wind
  turning, with jumbos) and in the wall test.

  With the jumbos' wake the landing runway is busier, so the tier 7 wind test flies as many
  flights a day as the tier 6 one.

#### The skyport (tier 8)
The last stage is playable now; every tier has a map.
- Vertiport: three pads for electric air taxis beside the old helipad (upgrade line `vertiport`).
  They are dark, with a ring of cyan lights and a V.
  - The Skytaxi is a new aircraft: a small capsule with four rotors on arms, 2-4 passengers.
  - It lands straight down on a pad (no runway, no taxiway), like the helicopters.
  - A new airline, Hoverly, flies them.
- The airport hotel stands west of Terminal 3: a glass tower on a stone base with rows of rooms
  (some lit), a star sign on the roof, a canopy over the door, and a forecourt with a fountain.
  Terminal 3's road runs on to its door. Some departing passengers spent the night there and
  walk over to the terminal.
- Goals: become a skyport, open the vertiport. A help topic: the skyport.
- Tests: the air taxis use the new pads; hotel guests walk to Terminal 3.

### M12a — cleanliness and the rating breakdown (done)
- Litter: passengers waiting on the busy floors drop cups, wrappers and cans.
  - The busy floors are the clean areas: rectangles inside one zone, so no wall runs through them.
    They are the lounges, food courts, gate lounges and halls of every terminal and of
    Concourse D.
  - About 1 in 300 per passenger-second. More bins (new upgrade) cut it by up to 75%.
  - At most 8 pieces per area.
- Cleaners: a new staff role from the small airfield on, up to 10 (the other roles stay at 2).
  - Each one looks after an area: walks to the nearest piece, bends down and picks it up, or makes
    rounds of the area.
  - If their area stays clean, they move on to the dirtiest area nobody looks after.
  - They wear teal with a light vest and push a trolley.
- A dirty airport costs mood when the doors close (up to 0.14), and so rating.
- Rating breakdown (`src/sim/game/rating.ts`): tap the star in the top bar for the rating panel.
  - Five bars: on time, short queues, clean terminals, bags arrive, happy passengers.
  - A tip for the weakest part.
- The bot hires a cleaner for every two areas.
- Tests (`tests/cleaning.test.ts`):
  - the areas are inside one building with no wall through them;
  - litter piles up without cleaners, and cleaners clean it up;
  - more than two cleaners can be hired;
  - a clean airport rates higher.
- E2E: `m12-cleaners`, `m12-litter` (close-ups via a new `lookAt` hook), `m12-rating`.

### M12b — passenger reviews (done)
- 244 lines (`src/data/reviews.ts`) in English and Hebrew across 27 topics:
  - things going wrong: long lines, lost bags, delays, dirty halls, passport control;
  - the airport's features: jet bridges, the apron bus, the train, the people mover, the hotel,
    air taxis, jumbos, the food court and the duty free, the dirt strip, a big airport;
  - who writes: families, business travellers, students, older travellers, VIPs;
  - the weather, holidays and on-time flights.
- About half of the flights that leave get a review (`src/sim/game/reviews.ts`).
  - The topic comes from what the flight lived through, worst first: a lost bag, being late,
    dirty halls, the average wait in line.
  - Then what the airport has: a jet bridge, the bus, the people mover, Terminal 4, the train,
    the hotel, a holiday.
  - Sometimes it is about who wrote it. The line is picked by hash.
- Good reviews (4 and 5 stars) earn a bonus (12 and 25 coins times the tier's pay) to collect in
  the new Reviews tab of the rating panel. That tab shows the average, the latest 40 reviews (name,
  flight, stars, line, when) and the collect button.
- Reviews and the bonus are saved.
- Tests (`tests/reviews.test.ts`):
  - more than 200 lines, both languages;
  - bad topics rate low and good ones high;
  - flights leave reviews;
  - a lost bag comes first;
  - the bonus is collected and survives a save.
- Fixes found by the new runs:
  - a smaller plane at a jet-bridge gate is served by the apron bus, so its Terminal 1 passengers
    wait in the lounge (they used to walk out to the pier and back through a wall);
  - the fault-rate test counts walk-around faults only, not bird strikes;
  - jet-bridge gates are for airliners only: a small plane used to take one when the small
    stands were full, and the big jets (Concourse D, Terminal 3) then had nowhere to park.

### Sharp close zoom (owner request, after M12b)
"Zoomed in, the game looks pixelated." The sprites are drawn once into an atlas at 2 pixels per
world pixel (4095 x 6820 at the skyport, so there is no room to grow it), airliners at 0.62 of
that, and the ground is baked into tiles at 1. On a phone at zoom 2.4 that is stretched up to 7x.
- Sprites: when the zoom needs more than the atlas has, each sprite on screen is drawn again from
  its vectors (`renderSprite`) at 2 to 4 times the atlas resolution.
  - Five a frame, so nothing stutters.
  - 12 M pixels are kept, oldest out first.
  - They are drawn in depth order with the rest of the atlas.
- Ground: it is recorded twice. The full picture becomes the baked tiles. A crisp layer has
  everything sharp (lines, markings, floors, carousels, roads) without the base grass, the
  blurred patches and the soft shadows.
  - Close in, tiles of the crisp layer are drawn at this zoom's resolution over the baked tiles,
    one a frame, nearest the middle of the screen first, 14 M pixels kept.
  - Soft things look fine scaled up, and blurs would be slow to redraw every frame.
- Measured at zoom 2.4 in the software-rendered test browser (relative): 7.8 FPS before (blurry),
  10.2 FPS now (sharp). Drawing the vectors every frame instead was 1.4 to 2.2 FPS.
- Debug switches `novec=1` and `nocrisp=1` turn each part off. The hook gives `frames()`,
  `atlas()` and `lookAt(x, y, zoom)`.
- E2E: `zoom-close-t3`, `zoom-close-plane`, `zoom-close-t1`.
- Memory, found by the skyport's vertiport run (zoom 2.1): the offscreen surfaces were never freed.
  - On the web, every sprite drawn again also left its surface and a copy of its pixels behind
    (makeNonTextureImage reads them out). The canvas memory ran out within seconds.
  - Now `takeImage` frees the surface and keeps its snapshot, which owns the pixels.
  - Images dropped from the caches, and the old atlas and tiles after a tier change, are freed four
    frames later, so no frame still drawing them is affected.
  - `makeSurface` returns null when there is no memory, instead of throwing.

### M12c+d — the Aviation Guide and the undercover inspector (done)
Like a restaurant guide, for airports (`src/sim/game/guide.ts`).
- An edition every seven game days, at 08:00 on days 8, 15, 22 and so on, gives up to three
  stars for how the week went. Six parts, each 0 to 1:
  - safety: diversions, and go-arounds at 0.4 each, per landing;
  - punctuality: on-time departures;
  - infrastructure: the tier, the stands built of the tier's, comfort upgrades;
  - service: the average wait in line (stricter than the passengers: 5 s is fine, 40 s as bad as
    it gets) and lost bags;
  - cleanliness and comfort: sampled every 5 s through the week (comfort also counts the comfort
    upgrades).
- The week's numbers are the stats since the last edition (a base is kept), so a bad week can be
  made up for.
- Stars at 0.65, 0.8 and 0.9 of the weighted score.
  - The second star is only for a city airport (stage 3) on, the third for an international one
    (stage 5) on. The guide tab says so when that is what holds a star back.
  - Each edition pays 300 coins a star (times the tier's pay). A star never had before gives
    5 diamonds. Each star brings 4% more flights.
- Balance, before the stricter version (bot, seeds 1 and 7, 300 minutes): 2 stars from the first
  edition (score 0.83 to 0.87 at the city airport) and 3 stars by minutes 210 to 280 at stage 4.
  That was too easy, so the third star now needs stage 5, and the thresholds and the queue part
  are stricter.
- The inspector: the day before an edition, between 09:00 and 14:00, a rumor goes round.
  - Four passengers on their way out look suspicious. They are picked from the ones furthest from
    their plane, so there is time to find them.
  - One of them, by hash, is the inspector.
  - The player gives one of them the VIP care (once).
  - When the inspector boards they are revealed: the right pick adds 0.05 to the week's score.
  - Their notebook is written: a line for each part (good, fair or poor) and one for the VIP care.
    That is 63 lines in he/en (`src/data/guideNotes.ts`), first person, with no gendered words
    about the inspector in Hebrew.
- Saved: stars, best, edition, the latest scores, the week's base and samples, the visit and the
  notebook. An older save waits for the next edition: none comes out at once on load.
- UI:
  - the Guide tab of the rating panel shows the stars, when the next edition is out, the suspects
    (with "show" and "VIP care"), the week so far with a bar to the next star and "what is
    missing" (the two weakest parts with tips), and the notebook;
  - a "find the inspector" chip under the HUD, and toasts;
  - a magnifier bobs over each suspect (a star over the one getting the VIP care); tapping one
    opens the guide;
  - a ceremony when an edition is out: the stars pop in, a new star or a lost one, the coins and
    diamonds;
  - the guide's pylon in front of the main terminal shows the stars (Terminal 3, else Terminal 1,
    else by the hut).
- The bot gives the VIP care to the first suspect still around (a guess, like a player).
- Tests (`tests/guide.test.ts`):
  - the notebook lines;
  - the edition and rumor times;
  - scores, stars and the weakest parts;
  - weekly scores;
  - an edition's rewards (diamonds only for a new best);
  - the rumor, the suspects, picks refused and taken, the reveal, the bonus and the notebook;
  - a wrong pick;
  - the rumor at the hub (figures that stand for groups count);
  - old and new saves.
- E2E: `m12-rumor`, `m12-suspects`, `m12-ceremony`, `m12-guide`, `m12-guide-notebook`,
  `m12-pylon-t3`, `m12-pylon-t1`. The hook adds `guide()`, `rumorNow()`, `publishNow()` and
  `guideSet(stars, edition)`.

### A livelier world (owner request: "invest in the design", after the land)
- A forest of two loose rows of trees runs round the world's edges, so the map no longer just
  stops. It leaves gaps where roads leave the map.
- The countryside has:
  - clumps of tall grass;
  - clusters of wild flowers (white, yellow, pink, lilac);
  - bushes and small rocks;
  - all kept off the field, the land, the roads, the buildings, the railway and the pond.
- The pond has a sandy shore and lily pads, one in flower.
- The sky:
  - cloud shadows drift over everything with the wind, faster in a strong wind (by day);
  - every 40 s or so a flock of seven birds may cross the map in a V, flapping.

### The land: the airport grows to the sides (owner request, after the baggage)
"The parking lot is not joined to the road. Make the field bigger to the sides, a game that grows
in tycoon style, like Clash of Clans and Hay Day. Invest in everything; learn how first."
- What I learned first (a quick read of what Supercell's games do):
  - growth comes as land: you clear plots of obstacles (trees, rocks), for coins and time;
  - buildings on the land make coins you come back to collect, and level up;
  - the art keeps chunky shapes, few colours, clear silhouettes and one consistent style.
- The parking lot by Terminal 1 is joined to the road now:
  - a driveway from the access road into its middle aisle, with kerbs, a give-way line and arrows;
  - the three bays by the driveway are for cars that turn in from the road, park for a while,
    back out and drive away (`lotCars` in `traffic.ts`).
- Land expansions (`data/land.ts`, `sim/game/land.ts`):
  - south of the widest fence lies wild land in plots of 6 x 4.5 tiles, in two rows: 18 at the
    small airports (their world is wider now: 64 x 52), 26 at the hub, 32 at the Mega hub and the
    Skyport;
  - a country road runs from the west edge along the land, and another between the rows;
  - any plot of the first row can be bought, and a plot of the second once the one north of it is
    the airport's. One plot is cleared at a time;
  - a plot costs two minutes of the airport's income (at least 1,600 x the tier's pay), 45% more
    for each plot owned. It takes 40 s to clear, 25 s more for each plot owned (10 min at
    most). Diamonds rush it. Clearing finds 1 or 2 diamonds and gives the manager experience.
- Facilities, one per cleared plot, levels 1 to 5 (each level 2.2x the price, 30 s more to
  build):
  - car rental (coins, more with more passengers served);
  - long-term parking (slow, holds 30 min);
  - solar farm (pays in by itself);
  - flight school (coins and manager experience at each collection);
  - logistics centre (the most coins, more with cargo work);
  - passenger garden (no coins: +1.2% passenger mood a level).
- Earnings: a level-1 facility makes about 6% of the airport's income, a level-5 one about 20%.
  It fills up to its cap; tap its coin bubble to collect.
- On the map (`render/land.ts`, art in `render/art/land.ts`):
  - a wild plot is a deeper meadow with tall grass, survey stakes and a rope round it, and
    obstacles: trees, pines, rocks, boulders, bushes, stumps, old sheds and straw bales. A sign
    with the price stands on each plot for sale;
  - while a plot is cleared, two workers go from obstacle to obstacle in dust, the obstacles go
    one by one, and a bar shows how far it is;
  - an owned plot is a mown lawn with a hedge and a drive from the road;
  - each facility has its own ground (asphalt, gravel, a grass strip, paths) and pieces that
    multiply with its level:
    - car rental: an office with flags and rows of cars;
    - parking: up to 24 cars and a ticket booth;
    - solar farm: rows of panels;
    - flight school: a hangar, trainers, and one flying circuits;
    - logistics centre: warehouses and trucks;
    - garden: a fountain, flower beds, trees and benches;
  - a crane and a bar while a facility is built; a bobbing gold coin bubble when it has coins.
- Tapping a plot opens its panel (`LandPanel.tsx`):
  - wild: the price and time to clear, why it cannot be bought yet, the progress and a diamond
    rush;
  - owned: the six facilities to pick from;
  - a facility: its level, coins a minute, what it holds, collect, and upgrade.
  Messages: the land is cleared (+diamonds), a facility's level is ready, coins pop up when
  collected.
- Trees keep off the land, its roads and the pond (trees used to grow in the pond).
- Tests: `land.test.ts`:
  - where the plots lie at every tier;
  - buying, clearing, diamonds and experience;
  - the rush;
  - building, upgrading, filling up, the cap and collecting;
  - the solar farm and the garden;
  - obstacles;
  - the save.
- E2E: `land-buy`, `land-pick`, `land-collect`, `land-overview`. The hook adds `land()` and
  `landSet()`.

### Baggage in 3D, and what needs you stands out (owner request)
"The conveyor looks very low quality and the animation is terrible; and make things a bit more
emphasized so it is clear."
- Baggage (`render/baggage.ts`, art in `render/art/baggage.ts`):
  - the check-in conveyor of every terminal is built in 3D, piece by piece: short legs, steel side
    rails and a black rubber belt whose ribs move along it;
  - a bag (eight kinds: six hard-shell suitcases with ridges, a handle and a tag, two duffels with
    a strap) goes on behind the counter at each check-in, rides the belt at its speed, turns the
    corner and goes into the baggage room. It replaces the flat bag icon that slid over
    everything;
  - the claim carousels are 3D:
    - a steel skirt with a kick strip, a belt of plates that turns, and an island with the feed
      hatch and its rubber curtain;
    - the island is drawn on its own, so bags on the far side pass behind it;
    - each passenger waiting there has their bag going round; the belt stops when nobody waits;
  - the floor keeps a soft shadow under each, and a yellow keep-clear ring round each carousel.
- What needs you (`drawGame.ts`):
  - each request bubble has a glowing halo in its action's colour, and the plane gets a ring of
    that colour on the ground: green to land, amber for fuel, blue for boarding, purple to take
    off, pink for bags, red for a repair;
  - once a request has waited 15 s (or a holding plane is running out of patience) both turn red
    and pulse faster;
  - the edge markers for planes off screen glow too;
  - progress bars are a little thicker.
- Tests: `baggage.test.ts`:
  - a bag goes on behind its counter;
  - it rides at the belt speed, turns the corner and is gone at the end;
  - a far counter puts nothing on;
  - each terminal has its own belt.
- E2E: `baggage-belt`, `baggage-carousel`. The hook adds `beltBags()` and `atClaim()`.

### Owner tools (owner request: "lots of money to see the upgrades")
- Hidden in the settings: tap the title "Settings" five times and an "Owner tools" section opens:
  - 1T coins and 1,000 diamonds (command `ownerGift`);
  - build the next stage now, its needs and cost waived (command `ownerTier`). It is built in
    3 s and opens once no plane is on the ground, like any new stage.
- The settings panel scrolls now (it overflowed on a landscape phone).
- Tests: `owner.test.ts`. E2E: `owner-tools` (five taps, the gift, the next stage).

### The ILS on the map (owner request: more of what an airport needs, after the tower)
The ILS line (landing in fog) was only a number. It now stands on the map (`ilsParts` in
`tower.ts`, art in `objects.ts`):
- the localizer: a row of antennas on a low steel frame across the runway's line, past its far
  end, red caps at its ends and an equipment hut beside it;
- the glideslope: a red-and-white mast with three antenna panels facing the approach, beside the
  touchdown zone on the side away from the terminals, with a hut at its foot;
- the versions:
  - CAT I (level 1): one of each, for landings toward the east;
  - CAT II (2): a wider localizer with more antennas, and a monitor post out toward the
    approach;
  - CAT III (3): a second set for landings the other way.
- Each piece moves out along the runway to the spot with the most room from the taxiways (a
  wide-body's wing), within 4 tiles of the end and inside the fence. A test checks every airport
  from the small airfield to the Skyport.
- Tapping the localizer or the glideslope opens the tower panel. The upgrades panel shows the ILS
  category as its version.
- E2E: `ils-cat1-loc`, `ils-cat2-gs`, `ils-cat3-west`, `ils-cat3-east-t7`, `ils-cat2-east-t5`,
  `ils-tap` (it waits for a moment with no plane near the mast, then taps it). The hook adds
  `ilsTap()`.

### The control tower in the game (owner request, after the night)
"Is there a control tower? Make it part of the game, not only the look." It is now: tap it on the
map (or the weather station by it) and it opens its own panel (`TowerPanel.tsx`). Sim in
`sim/game/tower.ts`.
- Ten levels (were five). Each takes a build (60 s to 6 min) and opens with the airport:
  two at the small airfield, all ten at the Skyport.
  - Levels 1 to 5: wake gaps 10% shorter each (to 50%) and go-arounds 12% rarer each (to 60%).
  - Levels 6 to 10: go-arounds 3% rarer each.
- Some levels bring a tower ability:
  - 2, ground control: planes taxi 10% faster;
  - 4, approach control: planes in the hold keep their patience 25% longer;
  - 6, automatic clearances: the tower clears a landing or a takeoff itself once the plane has
    waited 5 s and nobody else has (your own taps and the controllers still come first);
  - 8, surface radar: a further 30% off the go-arounds that are left;
  - 10, integrated operations: planes fly the approach 10% faster.
- Four looks: the small tower, the tall one (level 3), the modern one (6), and the mega tower
  (9): a tapering white shaft with a light strip, a two-storey glass cab, a gold band, a white
  roof and two radar balls. The beacon sits on top of each.
- A new runway upgrade, the weather station (3 levels):
  - storm warnings 1.5x, 2x, then 2.5x earlier;
  - crosswind go-arounds 15% rarer a level;
  - a forecast in the tower panel: wind and visibility in an hour, two at level 3;
  - on the map it stands on the grass north of Terminal 1: a fenced square with a louvred
    screen, a rain gauge, a wind vane and cups that turn faster in a stronger wind. A weather
    radar dome joins them at level 3. Trees keep off its square.
- The tower panel:
  - the tower card: its look, level, ten pips (gold rims for the levels with an ability), how
    much shorter the gaps and how much rarer the go-arounds, what the next level adds, and the
    upgrade button (price and build time, or "being built", or the tier that opens the next
    level);
  - the five abilities, active or locked with their level;
  - the traffic now: in the air, waiting for you, on the ground, go-arounds and diversions so
    far, controllers on duty with a button to Staff;
  - the tower's equipment: the weather station, the approach radar and the ILS, each with its
    level, what the next one does and a buy button; and the forecast, with a storm countdown when
    one is announced.
- A panel opened by a tap on the map no longer closes at once from that same tap's click
  (`Sheet.tsx` ignores backdrop presses in its first 450 ms).
- New icons: tower and lock.
- Tests: `tower.test.ts`:
  - the ten levels, the abilities and the names;
  - each level helps;
  - wake gaps;
  - automatic clearances at level 6 and not at 5;
  - the weather station's warning lead, crosswind and forecast;
  - building a level.
- E2E: `tower-tap` (a real tap on the tower opens the panel), `tower-panel-max`,
  `tower-panel-equipment`, `tower-v1-meteo`, `tower-v2`, `tower-v3`, `tower-mega`. The hook adds
  `towerTap()`.

### The night (owner request: the small details, after the ground services)
The clock ran through the night but the game never got dark. Now it does
(`nightOf` in `drawGame.ts`).
- Dusk from 18:00 to 20:00, night until 05:00, dawn until 07:00.
- The world takes a blue tint, at most 42%. It is drawn under the lights and the bubbles
  (`scene.ts`), so they stay bright.
- Lights at night:
  - white edge lights along every paved runway, green across the threshold and red across the far
    end;
  - the runway-lights line has versions:
    - edge lights (level 1);
    - approach lights (5): a row of nine and a crossbar before the threshold planes land toward,
      which follows the wind;
    - a running strobe along them (12);
  - the street lamps glow amber;
  - moving cars have headlights;
  - the terminal halls glow warm.
- Floodlight masts (a new apron upgrade, 3 levels; +3% staff speed a level):
  - tall poles with a head of four lamps beside the airliners' stands, every other stand, then all;
  - at night an amber light up top and a pool on the stand, white LED at level 3.
- The HUD shows a moon by the clock at night.
- Guards are posted at each terminal's security checkpoint. A patrol car parks at Terminal 3's curb
  once there are patrol cars.
- E2E: `night-apron`, `night-runway`. Many scenarios warp to 420 s, which is now night (23:48):
  their screenshots are dark, as the game is.

### Ground services and the small details (owner request, after security)
"Invest in the small details of the design" and "everything a real airport has".
- Five new ground vehicles, modelled like the others (16 directions, shadows):
  - the ground power unit: a vented yellow trailer with a cable reel and a green panel light;
  - the belt loader: a white chassis with a hazard-striped skirt, the driver at the side, a dark
    belt between yellow rails rising to the hold;
  - the catering truck: a cab, and a white box with a blue band and a roller door, lifted on
    scissor arms, with a railed platform out to the door;
  - the pushback tug: long, low and black, a yellow deck with chevrons, a low cab with a beacon, an
    orange tow bar;
  - the stairs truck: a cab and a flight of steps with handrails up to a blue canopy.
- Round each parked plane, by its phase (`drawGroundService` in `drawGame.ts`):
  - chocks at the nose wheel;
  - for the airliners, cones off both wingtips and behind the tail;
  - the belt loader at the forward hold (ahead of the wing) while bags come and go;
  - the ground power unit by the nose;
  - the catering truck at the back right door during the turnaround and boarding;
  - a stairs truck at the front door of a remote stand (city airport on);
  - the pushback tug at the nose of a jet-bridge plane while it boards and closes up.
- New vehicle upgrades:
  - ground power units (3 levels): +2% comfort a level;
  - catering trucks (10 levels): 0.5 coins of sales on board per passenger a level;
  - pushback tugs (3 levels): +4% taxi speed a level.
  - The equipment shows on the map once the line is bought; chocks, cones, belt loaders and stairs
    are always there.
- Stand markings:
  - a white stop bar across the lead-in where the nose wheel stops;
  - round the airliners' stands, a thin red dashed line that ground vehicles must not cross.
- The jet bridge:
  - a rotunda on a column with a ring of windows;
  - a tunnel with a strip of windows and its ribs;
  - a wheeled leg (two struts, a bogie, two wheels);
  - a cab with its control window, the black bellows at the plane, a yellow gate sign and a
    warning light.
- E2E: `gse-turnaround`, `gse-boarding`, `gse-remote`. The hook adds `planes()`.

### Airport security (owner request, after the upgrade versions)
"More airport security." `src/sim/game/security.ts`, a new upgrade category and staff role, and three
incidents.
- Guards (a new staff role from the small airfield, up to 8):
  - they walk rounds of the halls;
  - when a bag is noticed, the guard of its hall walks to it; with no guard there, the nearest
    one comes over, out of sight for the walk through the corridors, then in at the hall's edge.
    No walking through walls;
  - the bot hires one for every two halls.
- Security upgrades (a "Security" category):
  - cameras (10 levels): a bag is noticed sooner. On the map, poles at the terminals' and the
    fence's corners, one more a level;
  - the security fence (3 levels): a taller fence with more wires, then barbed wire, then sensor
    boxes with green lights. Holes in it get rarer;
  - patrol cars (2): white with a blue-and-yellow band and a blue light bar. They go round inside
    the fence and answer a hole in it or a drone;
  - a sniffer dog team: bags are checked twice as fast, and the dog walks with the first guard;
  - drone defence (2 levels): drone closures are shorter.
- Scanner versions with the scanner speed line: the X-ray tunnel (1), a round glass body scanner
  beside it (8), a CT scanner in place of the X-ray box (15). The world is rebuilt when the
  version or the fence's level changes.
- Incidents:
  - unattended bag: next to a passenger in a hall, or along a hall's front edge.
    - Security lanes work at half speed until it is checked.
    - It is noticed after 22 s, 2 s less a camera level.
    - A guard checks it in 8 s (4 s with the dog).
    - Within 35 s is a bonus (40 times the tier's pay). With no guards, the city's security comes
      after 60 s.
    - On the map, the bag stands in a ring of yellow-and-black tape with a blinking warning.
  - drone (from the city airport): every runway closes for 45 s, 30% less a drone-defence level and
    20% less with a patrol car out at the runway end. On the map, a hovering quadcopter with a
    blinking red light.
  - hole in the fence (from the regional airport): the runways hold until a patrol car (or the
    inspection car) has driven to it and checked it. It is rarer with a better fence. On the map,
    cones and a blinking warning.
- The security level (0..1): cameras, the fence, patrols, guards for the halls, the dog team,
  drone defence. It counts for a quarter of the Aviation Guide's safety, and it makes bags rarer.
- Tests (`tests/security.test.ts`):
  - names in both languages;
  - the level and what each part does;
  - a bag: slow lanes, a guard, the bonus;
  - a bag without guards;
  - a drone, and a shorter drone with defence and a patrol;
  - a hole in the fence, with and without a patrol car;
  - security incidents in a real game.
- The review test plays 2,000 s instead of 1,500. The new role changes the seed's draw of
  applicants and so the flights, and 1,500 s was just short of the six reviews it checks for.
- E2E: `sec-bag`, `sec-drone`, `sec-breach`, `sec-scanners`, `sec-panel`. The hook adds
  `security(kind)` and `guards()`.
  - `apron-bus` now runs at 4x with a longer wait. The seed's first remote-stand flight comes later
    since the draw changed; the buses work as before.
- Balance (bot, seed 1, 90 minutes): 303 flights, 7 diversions.

### Upgrade versions and animations (owner request, after M13c)
"Grow the upgrades, with different versions of them, and animations where needed." The upgrades you
see on the map change look as they level up (`src/data/versions.ts`, names in `ver.<id>.<n>`):
- Snack kiosk: a snack cart (level 1), the kiosk (10), a café with a terrace of two tables under
  parasols (25), a glass food shop with a sign (50).
- Billboard: a painted board on wooden posts (1), the big billboard (6), an LED screen on a steel
  pole (14), a twin LED tower (24).
  - The LED screens are animated: four adverts (a plane or a cup, colors, lines of text) that
    change every 3 seconds; the twin tower's two screens are one advert apart.
- Benches: a bench and parasol (1), two benches (10), shaded pergolas with climbing plants (20).
- Control tower: it grows. Small (levels 0 to 1), tall with a wider cab (2), modern with a flared
  shaft and a radar ball on the roof (4).
  - The taller two have a red beacon that blinks. The tower moved from the baked statics to the
    frame's drawing (`world.tower`), so it changes as soon as it is bought.
- Radar: the mast (1), a bigger, faster-turning antenna (2), a white radome that does not turn
  (3).
- Animations when buying:
  - the `upgraded` event now carries the upgrade and the level it reached;
  - a sparkle pops over the thing on the map;
  - a new version gets a ring of sparkles and a "New look: ..." message (an answer to the
    player, so it always shows).
- The upgrades panel shows the version and the next one ("Version 3/4: Café with a terrace · level
  50: Glass food shop").
- Tests (`tests/versions.test.ts`): each line is an upgrade, in order, within its levels and named
  in both languages; versions by level; the bought event says what and to which level.
- E2E:
  - `ver-look-1`: the LED screen;
  - `ver-look-4`: the twin LED tower;
  - `ver-cafe`: the café;
  - `ver-tower`: the modern tower and the radome;
  - `ver-panel`: the version lines.
  - The hook adds `setUpg(levels)` and `tower()`.

### M13c — festivals and flash deals (done)
`src/sim/game/festival.ts`.
- A festival runs for three game days, one after another, each with a theme. Which one comes next
  is a hash of the seed and its number, among those open at the tier, never the same twice in a
  row. The themes and what earns points:
  - On-Time Week: planes that leave on time;
  - Charter Days: small planes;
  - Family Fest: 4 and 5 star reviews;
  - VIP Gala: VIP and celebrity tips;
  - Jumbo Days: the big jets;
  - Cargo Rush: cargo flights.
- Three prize tiers, paid as the points come in: 300, 800 and 2,000 coins (times the tier's pay)
  and 0, 5 and 15 diamonds. The top tier also gives that festival's trophy (kept for the career).
- A flash deal every three real hours (the phone's clock) for twenty minutes: the best upgrade right
  now (no construction ones) at 40% off, once a window. `addLevel` buys the one level.
- Saved: the festival, its points and prizes, the trophies, the deal's window and whether it was
  used.
- UI: a small festival card opposite the goal card (name, time left, a three-part bar, points), and
  the deal chip under it while a deal is on (-40%, the upgrade, the price, minutes left). The
  inspector chip stacks with them. Messages for a new festival (news, so it obeys the calm rule), a
  prize and a bought deal.
- Tests (`tests/festival.test.ts`): festivals in turn, open at the tier, never twice in a row;
  points only from the theme, prizes and the trophy; a real game earns points; the deal (the best
  upgrade, the price, once a window, a new window, the end); the save.
- E2E: `m13-festival` (the page clock set to the start of a deal window). The hook adds `fest()`.

### M13b — the daily gift and the lucky wheel (done)
Both run on the phone's clock (`src/sim/game/daily.ts`). The UI sends it in as real minutes since
1970 (`setNow`, at start and every minute), so the game itself stays deterministic.
- Daily gift: one a real day, seven days of a streak:
  - 200 coins, 5 diamonds, 500 coins, 5 minutes of double income, 10 diamonds, 1,500 coins, a
    chest (coins times the tier's pay); then day 7's while the streak lasts;
  - a missed day starts the streak over; a clock that goes back gives nothing.
- Lucky wheel: a free spin every four real hours, more for 10 diamonds each.
  - Eight segments with their odds shown: coins (30%, 20%, 9%), diamonds (18%, 6%, 1% for 50),
    double income (12%), a chest (4%).
  - Where a spin lands is a hash of the seed and the spin's number. A test checks 20,000 spins
    land as often as the odds say.
- Saved: the last gift's day, the streak, the last free spin and the spin count. The clock is not
  saved; it comes from the phone again.
- UI:
  - a gift button in the HUD with a red dot when the gift or a free spin is ready;
  - the daily panel: the seven days (today's lit), the collect button, the wheel (drawn with Skia,
    turning to the prize), the free and paid spin buttons, the odds;
  - a message for the gift (the wheel shows its prize itself).
- Tests (`tests/daily.test.ts`): no gift before the clock is known; a gift a day, growing with the
  streak; a missed day; a clock going back; the odds; the free spin every four hours and paid
  spins; the save.
- E2E: `m13-daily`, `m13-wheel`. The hook adds `daily()`.
- Also: the fuel-farm order test keeps the manager far from a level-up, so level coins do not
  count as change.

### M13a — manager level and achievements (done)
The manager's career (`src/sim/game/career.ts`), read off the game's events each step.
- Experience:
  - a flight that leaves: 2 + paxMax/60 (bigger planes give more);
  - an upgrade level: 2;
  - a hire: 5;
  - a goal: 10;
  - a milestone: 5;
  - a new stage: 40 times the stage;
  - a guide star: 20;
  - the inspector found: 15;
  - an emergency landed: 10;
  - an event handled well: 8;
  - a five-star review: 1.
- Levels need `25 * level^1.25` experience. Each pays 50 coins times the level (times the tier's
  pay).
- Every fifth level brings a chest: 10 diamonds and double income for 3 minutes. Every flight's
  pay is doubled while it lasts; a second chest adds to the time.
- 19 achievements (`src/data/achievements.ts`), each with bronze, silver, gold and diamond medals:
  - flights, passengers, coins earned, on-time departures;
  - stands, staff, airline contracts, stage, upgrade levels;
  - five-star reviews, guide stars, inspectors found;
  - emergencies, hangar checks, diverted planes taken in, events handled well, holidays;
  - shop sales, manager level.
- Collecting a medal gives 2, 5, 10 or 25 diamonds. Career counters keep what the stats do not
  (and the best ever of what can go down), for a later new airport.
- Saved: level, experience, chests, the boost, the counters, the medals collected. The last event
  read is not saved (events are not either).
- UI:
  - a level badge in the HUD with an experience bar, and a red dot when there is a chest or a
    medal to collect;
  - the manager panel: the level, experience, what the next level brings, the chests with their
    open button and the boost left; the achievements with medal pips, progress to the next one and
    the collect button;
  - messages for a level, a chest and a medal (they answer the player, so they always show).
- The upgrade overspend test now keeps the manager far from a level-up, so level coins do not
  count as change.
- Tests (`tests/career.test.ts`): the level curve; experience from play, level coins and chests;
  opening a chest (diamonds, double income, refused without one); medals collected once; the
  counters from events; achievement names in both languages; the career in a save.
- E2E: `m13-career`, `m13-chest`, `m13-achievements`. The hook adds `career()` and
  `careerSet(level, chests)`.
- Balance (bot, seed 1, 300 minutes): level 5 at minute 13, 10 at 58, 15 at 206. Medals by then:
  mostly silver, gold for the shop sales, diamond for nothing yet.

### A calm screen (owner request, after M12)
"Make sure the screen does not fill up with junk that pops up; it should not bother the player."
- Messages now follow one rule (`toast` in `GameScreen.tsx`):
  - answers to what the player just did always show (a refused tap, a hire, a signed contract,
    a goal done, the next stage);
  - warnings show, but the same one not again within 12 s;
  - good news and info show at most one every 6 s, and are dropped otherwise;
  - two at a time at most (was three).
- No message any more where the map or a button already says it:
  - planes asking to land or take off (the bubble and the edge markers; only for the first three
    flights);
  - trucks busy, wages paid, an applicant (only the rare ones), a staff level-up, a raise request,
    a trial ended (the staff button's dot);
  - an airline offer or a happy airline (the airlines button's dot);
  - a lost bag, the fog lifting, a delivery, a repair or check done (the coins fly up);
  - the runway car, the ambulance, a staff slip.
- The test bot's refused taps are not shown.
- A new goal's card folds to its title after 8 s (was 15).
- Measured with a probe on a busy international airport (60 s of play): messages on screen 63% of
  the time, up to three at once, before; 10% and one at a time after.
  - On the small airfield: 5%.
- Toasts have a `testID` for tests.

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
- Web test switches (web only): `?seed=N&warp=S&auto=1&speed=K&select=1&hook=1&screen=gallery&stands=N&crew=1&money=N&panel=staff|upgrades&tier=N&build=1&cam=x,y,zoom&panel=airlines|board&tab=0|1&follow=1&full=1&wx=fog|cross|west|calm&fault=1&tanker=1&inc=storm|birds|fod|emergency|vip|airshow`.
  Any of them disables loading/saving unless `save=1` is added.
- Planes are drawn 1.35× larger than "true" size (`ART_SCALE`) so they read on a phone.
- Skia on web: `canvaskit.wasm` is copied to `public/` by `postinstall`; `Root.web.tsx` loads it
  with `WithSkiaWeb` before importing any module that touches Skia.
