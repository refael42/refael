/** The airfield: canvas + camera + taps + HUD + flight card + toasts. */
import { levelCap, UPGRADES, upgradeDef } from '../../data/upgrades';
import { INCIDENTS, VISITORS, type IncidentKind } from '../../data/incidents';
import { HOLIDAYS } from '../../data/holidays';
import { groundPlane, spawnFlight } from '../../sim/game/flights';
import { capacity, placeOrder, storeActive, STORE_KINDS } from '../../sim/game/supplies';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PixelRatio, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { SkImage } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIRLINES } from '../../data/airlines';
import { useDir, useLang, useT, type TKey } from '../../i18n';
import { attachWebZoom, makeCamera, updateCamera, useCameraResponder, viewToWorld, type DragHandler } from '../../render/camera';
import { tierDef } from '../../data/tiers';
import { TierPanel } from './TierPanel';
import { SupplyPanel } from './SupplyPanel';
import { GoalCard, type GoalView } from './GoalCard';
import { HelpPanel } from './HelpPanel';
import { IncidentsPanel } from './IncidentsPanel';
import { RatingPanel } from './RatingPanel';
import { CareerPanel } from './CareerPanel';
import { DailyPanel } from './DailyPanel';
import { FestivalCard, type DealView, type FestView } from './FestivalCard';
import { versionOf } from '../../data/versions';
import { ACHIEVEMENTS, MEDALS } from '../../data/achievements';
import { GuideCeremony, type GuideNews } from './GuideCeremony';
import { bubbleAnchor, constructionSite, decorItems, drawGame, type Indicator } from '../../render/drawGame';
import { Effects } from '../../render/effects';
import { isoX, isoY, screenToWorld, Z_PX } from '../../render/iso';
import { ATLAS_SCALE, renderSprite } from '../../render/atlas';
import { CRISP_TILE, renderCrispTile } from '../../render/ground';
import { H_SHADOWS, H_SPRITES, HEADER, makeRenderRes, SHADOW_STRIDE, SnapWriter, SPRITE_STRIDE, type RenderRes } from '../../render/scene';
import { SceneCanvas } from '../../render/SceneCanvas';
import { buildSprites, type SpriteSet } from '../../render/sprites';
import { frameStats, recordFrame, useFrameLoop } from '../../render/useFrameLoop';
import { buildWorld } from '../../render/world';
import { useSettings } from '../../settings/store';
import { AIRCRAFT, aircraftIndex, planeArt } from '../../data/aircraft';
import { RARITIES, STAFF_ROLES } from '../../data/staff';
import {
  applyOffline,
  airlineBlocker,
  applyStructural,
  contractSlots,
  makeOffer,
  signOffer,
  counterCount,
  laneCount,
  switchTier,
  bestOffer,
  checkTier,
  decorPos,
  decorSpotOk,
  botAirlines,
  activeIncidents,
  approachBlocker,
  Big,
  isWeekend,
  epochDay,
  nextHoliday,
  startIncident,
  stormActive,
  currentGoal,
  GOALS,
  goalReward,
  type GoalTarget,
  botBuys,
  canExpand,
  repOf,
  botCommands,
  botHires,
  clockText,
  formatBig,
  foggedIn,
  gameClock,
  weather,
  layoutOf,
  maxPerRole,
  REJECT,
  staffCount,
  wagesPerDay,
  WANT,
  type GameEvent,
  type GameState,
  type OfflineResult,
  PST,
  railTrain,
  cleanliness,
  publishEdition,
  startRumor,
  xpToNext,
  medalsToClaim,
  giftReady,
  spinIn,
  FESTIVALS,
  DEAL_OFF,
  flashDeal,
  festivalLeft,
  formatDuration,
} from '../../sim';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';
import { saveGame } from './persistence';
import { UpgradesPanel } from './UpgradesPanel';
import { WelcomeBack } from './WelcomeBack';
import { FpsMeter } from '../FpsMeter';
import { GameController } from './controller';
import { readDebugParams } from './debugParams';
import { FlightCard } from './FlightCard';
import { flightCode, sameView, viewOf, WANT_ACTION, type FlightView } from './flightInfo';
import { BottomBar, type BarItem } from './BottomBar';
import { sideWidth } from './Sheet';
import { AirlinesPanel } from './AirlinesPanel';
import { FlightBoard } from './FlightBoard';
import { Hud, sameHud, type HudData } from './Hud';
import { personName, StaffPanel, type StaffView } from './StaffPanel';
import { SettingsPanel } from './SettingsPanel';
import { TOAST_MS, Toasts, type Toast } from './Toasts';

const debug = readDebugParams();

function hudOf(c: GameController): HudData {
  const s = c.state;
  const clock = gameClock(s.time);
  const w = weather(s);
  // the wind vector on the iso screen (x right, y down), as a rotation from "up"
  const sx = Math.cos(w.windTo) - Math.sin(w.windTo);
  const sy = (Math.cos(w.windTo) + Math.sin(w.windTo)) / 2;
  const windDeg = (Math.atan2(sy, sx) * 180) / Math.PI + 90;
  const fog = foggedIn(s) ? 2 : w.vis < 0.6 ? 1 : 0;
  return {
    money: formatBig(s.money),
    diamonds: String(s.diamonds),
    rating: Math.round(s.rating * 10) / 10,
    day: clock.day,
    time: clockText(s.time),
    windDeg,
    windKt: Math.round(w.speed),
    fog,
    cross: s.wxCross,
    haze: Math.round(Math.max(0, 1 - w.vis) * 20) / 20,
    storm: stormActive(s),
    incidents: activeIncidents(s).length,
    weekend: isWeekend(s.time),
    holiday: s.holiday,
    level: s.career.level,
    xp: Math.floor((s.career.xp / xpToNext(s.career.level)) * 20) / 20,
    careerDot: s.career.chests > 0 || medalsToClaim(s) > 0,
    daily: giftReady(s).ready || spinIn(s) === 0,
  };
}

export interface Boot {
  state?: GameState;
  /** Names chosen on the first launch. */
  profile?: { manager: string; airport: string };
  /** Seconds since the save was written. */
  away?: number;
  /** Don't autosave (test URL, or a save from a newer version must stay untouched). */
  saveBlocked: boolean;
  futureSave: boolean;
}

export function GameScreen({ sprites: initialSprites, boot, onGallery }: { sprites: SpriteSet; boot: Boot; onGallery: () => void }) {
  // the atlas holds the liveries of the current tier; a bigger airport rebuilds it
  const [sprites, setSprites] = useState(initialSprites);
  const [rebuilding, setRebuilding] = useState(false);
  const t = useT();
  const insets = useSafeAreaInsets();
  const showFps = useSettings((s) => s.showFps);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const snap = useSharedValue<Float32Array>(new Float32Array(0));
  const res = useSharedValue<RenderRes | null>(null);
  const offset = useRef({ x: 0, y: 0 });

  const ctrl = useMemo(() => {
    const c = new GameController(debug.seed ?? 20261101, boot.state);
    c.speed = debug.speed;
    if (debug.tier >= 2) switchTier(c.state, debug.tier);
    if (debug.build) for (const id of ['kiosk', 'benches', 'billboard']) c.state.upg[id] = id === 'benches' ? 10 : 1;
    if (debug.stands > 0) {
      c.state.upg.stand = Math.max(0, debug.stands - 1);
      c.state.upgRev++;
      applyStructural(c.state);
    }
    if (debug.money > 0) c.state.money = c.state.money.add(debug.money);
    if (debug.full) fullAirport(c.state);
    const WX: Record<string, { windTo: number; speed: number; vis: number }> = {
      fog: { windTo: Math.PI, speed: 6, vis: 0.08 },
      cross: { windTo: Math.PI / 2 + 0.2, speed: 22, vis: 1 },
      west: { windTo: 0.15, speed: 14, vis: 1 },
      calm: { windTo: Math.PI, speed: 5, vis: 1 },
    };
    if (debug.wx && WX[debug.wx]) c.state.wxForce = WX[debug.wx];
    if (debug.crew) {
      c.state.money = c.state.money.add(5000);
      for (const a of c.state.applicants.slice()) c.send({ type: 'hire', applicantId: a.id });
      c.tick(1000 / 30);
      c.state.money = c.state.money.sub(Math.min(c.state.money.toNumber(), 5000));
    }
    if (debug.warp > 0) {
      // fast-forward for tests (the bot plays only with auto=1)
      for (let i = 0; i < debug.warp * 30; i++) {
        if (debug.auto && i % 3 === 0) for (const cmd of [...botCommands(c.state, { reaction: 1 }), ...botHires(c.state), ...botAirlines(c.state)]) c.send(cmd);
        if (debug.auto && i % 150 === 0) for (const cmd of botBuys(c.state)) c.send(cmd);
        c.tick(1000 / 30);
      }
      c.takeEvents();
    }
    // screenshots: a grounded plane at its stand
    if (debug.fault) {
      const f = c.state.flights.find((x) => x.dockedAt > 0 && x.offBlockAt === 0 && !x.check && x.aog === 0);
      if (f) groundPlane(c.state, f);
    }
    // screenshots: an incident under way (announced ones skip their warning)
    // (celebrityPrivate: the celebrity with the press kept out)
    const incKind = debug.inc === 'celebrityPrivate' ? 'celebrity' : debug.inc;
    if (incKind && INCIDENTS.some((d) => d.kind === incKind)) {
      // an emergency or a medical case needs a plane in the air to declare it
      if (incKind === 'emergency' || incKind === 'medical') spawnFlight(c.state);
      if (incKind === 'celebrity') c.state.stats.served = Math.max(c.state.stats.served, 10);
      const inc = startIncident(c.state, incKind as IncidentKind, (p) => spawnFlight(c.state, p));
      if (inc && inc.state === 'announced') inc.at = c.state.time;
      if (inc && debug.inc === 'celebrityPrivate') c.send({ type: 'celebPrivacy', incident: inc.id, private: true });
      // (let it get going: the car or the trucks on their way, the visitor on the ground)
      const atStand = incKind === 'vip' || incKind === 'celebrity' || incKind === 'historic' || incKind === 'medical';
      const ahead = atStand ? 300 : incKind === 'fod' ? 6 : 2;
      const vf = inc?.flight ? c.state.flights.find((x) => x.id === inc.flight) : undefined;
      for (let i = 0; i < 30 * ahead; i++) {
        // the visitor: until it is at its stand (the carpet out, the press there, the visitors around)
        if ((incKind === 'vip' || incKind === 'celebrity') && vf && vf.dockedAt > 0 && c.state.time - vf.dockedAt > 4) break;
        if (incKind === 'historic' && vf && vf.dockedAt > 0 && c.state.time - vf.dockedAt > 20) break;
        // the medical case: the paramedics at the door
        if (incKind === 'medical' && inc && inc.units[0]?.state === 'work') break;
        if (atStand && vf && !vf.landCleared && i % 30 === 0) c.send({ type: 'clearLanding', flightId: vf.id });
        if (incKind === 'emergency' && vf && !vf.landCleared && i % 30 === 0) c.send({ type: 'clearLanding', flightId: vf.id });
        if (debug.auto && i % 3 === 0) for (const cmd of botCommands(c.state, { reaction: 1 })) c.send(cmd);
        c.tick(1000 / 30);
      }
      c.takeEvents();
    }
    // screenshots: a tanker unloading at the fuel farm (and, from the regional airport, the parts van)
    if (debug.tanker && storeActive(c.state, 'fuel')) {
      for (const k of STORE_KINDS) {
        if (!storeActive(c.state, k)) continue;
        c.state.stores[k].stock = capacity(c.state, k) * 0.3;
        placeOrder(c.state, k, true);
      }
      for (const d of c.state.deliveries) d.eta = c.state.time;
      for (let i = 0; i < 30 * 200 && c.state.deliveries.some((d) => d.state !== 'unloading'); i++) c.tick(1000 / 30);
      c.takeEvents();
    }
    // the real date, for the holidays (a test can pretend it is one)
    c.send({ type: 'setToday', day: todayFor(debug.hol, debug.holDay) });
    return c;
  }, []);
  // past midnight the date moves on
  useEffect(() => {
    if (debug.hol) return;
    // (the phone's clock, for the daily gift and the wheel: real minutes)
    ctrl.send({ type: 'setNow', minutes: Math.floor(Date.now() / 60000) });
    const id = setInterval(() => {
      ctrl.send({ type: 'setToday', day: todayFor(null, 1) });
      ctrl.send({ type: 'setNow', minutes: Math.floor(Date.now() / 60000) });
    }, 60000);
    return () => clearInterval(id);
  }, [ctrl]);
  const [tier, setTier] = useState(ctrl.state.tier);
  useEffect(() => {
    const want = tierCombos(tier);
    const have = sprites.combos;
    if (sprites.tier >= tier && want.every(([a, c]) => have.some(([x, y]) => x === a && y === c))) return;
    setRebuilding(true);
    // let the overlay paint before the (synchronous) atlas build
    const id = setTimeout(() => {
      setSprites(buildSprites({ combos: want, tier }));
      setRebuilding(false);
    }, 60);
    return () => clearTimeout(id);
  }, [tier, sprites]);
  const L = layoutOf(tier);
  // which stands are built, as a string so the world is rebuilt only when it changes
  const [openSig, setOpenSig] = useState(() => ctrl.state.standOpen.map((o) => (o ? '1' : '0')).join(''));
  // counters, lanes and the fuel farm size in one number (each a digit)
  // (and the fence's level and the scanners' version: digits above those)
  const [stations, setStations] = useState(() => versionOf('scanner', ctrl.state.upg.scanner ?? 0) * 10000 + (ctrl.state.upg.fence ?? 0) * 1000 + (ctrl.state.upg.fuelFarm ?? 0) * 100 + counterCount(ctrl.state) * 10 + laneCount(ctrl.state));
  const world = useMemo(
    () =>
      buildWorld(L, sprites, tier, openSig.split('').map((c) => c === '1'), Math.floor(stations / 10) % 10, stations % 10, Math.floor(stations / 100) % 10, Math.floor(stations / 1000) % 10, Math.max(1, Math.floor(stations / 10000))),
    [L, sprites, tier, openSig, stations],
  );
  const cam = useMemo(() => {
    const c = makeCamera(isoX(L.camera.center[0], L.camera.center[1]), isoY(L.camera.center[0], L.camera.center[1]), L.camera.zoom);
    c.minZoom = 0.32;
    c.maxZoom = 2.2;
    c.bounds = world.bounds;
    return c;
    // the camera is created once; bounds follow the world below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    cam.bounds = world.bounds;
  }, [cam, world]);
  const writer = useMemo(() => new SnapWriter(), []);
  const fx = useMemo(() => new Effects(), []);
  useEffect(() => {
    fx.belt = L.terminal.belt.map((p) => ({ x: isoX(p[0], p[1]), y: isoY(p[0], p[1], 0.12) }));
  }, [fx, L]);

  const [hud, setHud] = useState<HudData>(() => hudOf(ctrl));
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  selectedRef.current = selected;
  const [card, setCard] = useState<FlightView | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(0);
  const [settings, setSettings] = useState(false);
  const [panel, setPanel] = useState<string | null>(debug.panel);
  /** A new edition of the Aviation Guide, for its ceremony. */
  const [guideNews, setGuideNews] = useState<GuideNews | null>(null);
  /** The wheel's last spin (it turns to it in the daily panel). */
  const [lastSpin, setLastSpin] = useState<{ seg: number; at: number } | null>(null);
  const [staffView, setStaffView] = useState<StaffView | null>(null);
  const [rev, setRev] = useState(0);
  const [upgCat, setUpgCat] = useState<'all' | 'terminal'>('all');
  const buildMode = panel === 'build';
  const dragRef = useRef<{ id: string; x: number; y: number; ok: boolean } | null>(null);
  const tutorial = useSettings((x) => x.tutorial);
  const setTutorial = useSettings((x) => x.setTutorial);
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;
  const [hand, setHand] = useState<{ x: number; y: number; text: TKey } | null>(null);
  // the current goal (polled with the HUD) and the "show me" pointer for it
  const [goal, setGoal] = useState<GoalView | null>(null);
  const showMe = useRef<{ target: GoalTarget; until: number } | null>(null);
  // a new goal opens in full for a while, then folds into a chip (tap to open again)
  const goalOpen = useRef<{ id: string; until: number }>({ id: '', until: 0 });
  const barPos = useRef<Record<string, { x: number; y: number }>>({});
  const barOrigin = useRef({ x: 0, y: 0 });
  const barWrapY = useRef(0);
  const [welcome, setWelcome] = useState<OfflineResult | null>(null);

  useEffect(() => {
    if (boot.profile) ctrl.send({ type: 'setProfile', manager: boot.profile.manager, airport: boot.profile.airport });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // offline earnings once, right after loading a save
  useEffect(() => {
    if (!boot.state || !boot.away) return;
    const r = applyOffline(ctrl.state, boot.away);
    ctrl.takeEvents();
    if (r.seconds >= 60) setWelcome(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave every few seconds, when the app goes to the background, and on exit
  useEffect(() => {
    if (boot.saveBlocked) return;
    const id = setInterval(() => saveGame(ctrl.state), 8000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') saveGame(ctrl.state);
    });
    const onHide = () => saveGame(ctrl.state);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(id);
      sub.remove();
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('pagehide', onHide);
      saveGame(ctrl.state);
    };
  }, [ctrl, boot.saveBlocked]);
  const lang = useLang();
  const [bump, setBump] = useState(0);
  const toastId = useRef(1);
  /** Names of people by id, so a "quit" toast can still name them. */
  const lastNames = useRef(new Map<number, string>());
  const indicators = useRef<Indicator[]>([]);
  /** Sprites drawn again at a higher resolution, oldest first, and their pixels. */
  const vecOrder = useRef<number[]>([]);
  const hiPixels = useRef(0);
  /** Images no longer drawn, freed a few frames later (a frame being drawn may still use them). */
  const trash = useRef<{ image: SkImage; frame: number }[]>([]);
  const frameNo = useRef(0);
  const safe = useRef({ top: 90, bottom: 0 });
  const lastToastKey = useRef<Record<string, number>>({});
  const lastNews = useRef(-1e9);
  /** Where the control tower stands (for the pop when its upgrade is bought). */
  const towerRef = useRef<[number, number] | null>(null);
  towerRef.current = world.tower;

  useEffect(() => {
    // (close in, the sprites and the ground switch to their vectors before their pixels would show)
    const dpr = Math.max(1, PixelRatio.get());
    // (what the old resources had and the new ones do not is freed)
    const prev = res.value;
    if (prev) {
      for (const h of prev.hi) if (h) trash.current.push({ image: h.image, frame: frameNo.current });
      for (const c of prev.crispTiles) trash.current.push({ image: c.image, frame: frameNo.current });
      if (prev.image !== sprites.atlas.image) trash.current.push({ image: prev.image, frame: frameNo.current });
      for (const tl of prev.tiles) if (!world.tiles.some((n) => n.image === tl.image)) trash.current.push({ image: tl.image, frame: frameNo.current });
    }
    res.value = makeRenderRes(sprites.atlas.image, sprites.atlas.rects, debug.noBg ? null : world.picture, debug.noBg ? [] : world.tiles, {
      vecZoom: debug.noVec ? Infinity : Math.max(0.9, 2.2 / dpr),
      bgZoom: Math.max(0.9, 1.3 / dpr),
      crisp: debug.noBg || debug.noCrisp ? null : world.crisp,
    });
    vecOrder.current = [];
    hiPixels.current = 0;
    if (debug.noStatics) world.statics.length = 0;
  }, [sprites, world, res]);

  // fit the zoom to the screen once we know its size
  const fitted = useRef(false);
  useEffect(() => {
    if (size.w <= 0 || fitted.current) return;
    fitted.current = true;
    cam.zoom = Math.max(0.45, Math.min(1.1, Math.min(size.w / 600, size.h / 560)));
    if (debug.cam) {
      cam.x = isoX(debug.cam[0], debug.cam[1]);
      cam.y = isoY(debug.cam[0], debug.cam[1]);
      cam.zoom = debug.cam[2];
    } else if (debug.inc) {
      // screenshots of an incident: look at it (its plane, or where it is)
      const inc = ctrl.state.incidents.find((i) => i.kind === (debug.inc === 'celebrityPrivate' ? 'celebrity' : debug.inc));
      const f = inc?.flight ? ctrl.state.flights.find((x) => x.id === inc.flight) : undefined;
      // (a visitor at its stand: a little toward the terminal, where the carpet, the press or the visitors are)
      const atStand = f && f.dockedAt > 0 && (f.celeb || f.historic || inc?.kind === 'medical');
      const at = f ? (atStand ? [f.x - 0.35, f.y - 1.0] : [f.x, f.y]) : inc && inc.x ? [inc.x, inc.y] : null;
      if (at) {
        cam.x = isoX(at[0], at[1]);
        cam.y = isoY(at[0], at[1]);
        cam.zoom = atStand ? 1.8 : 1.5;
      }
    }
  }, [size, cam, ctrl]);

  /**
   * Short messages, kept few so the screen stays calm. 'tap' answers what the
   * player just did (always shown); a warning needs attention (shown, never
   * twice in a row); good news and info show at most one every NEWS_GAP ms and
   * are dropped otherwise (what they say is on the map or a button's dot).
   * Two at a time at most.
   */
  const toast = useCallback((icon: Toast['icon'], text: string, tone: Toast['tone'] = 'info', key?: string, tap = false) => {
    const tnow = performance.now();
    const k = key ?? text;
    const last = lastToastKey.current[k] ?? -1e9;
    if (tnow - last < (tap ? 1500 : SAME_GAP)) return;
    if (!tap && tone !== 'warn') {
      if (tnow - lastNews.current < NEWS_GAP) return;
      lastNews.current = tnow;
    }
    lastToastKey.current[k] = tnow;
    setToasts((old) => [...old.filter((x) => tnow - x.at < TOAST_MS), { id: toastId.current++, icon, text, at: tnow, tone }].slice(-MAX_TOASTS));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (boot.futureSave) toast('warn', t('toast.saveFuture'), 'warn');
      // (not after a test fast-forward: the airfield is no longer new)
      else if (!boot.state && debug.warp === 0) toast('land', t('toast.welcome'), 'good');
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEvents = useCallback(
    (events: GameEvent[]) => {
      const s = ctrl.state;
      const codeOf = (id: number) => {
        const f = s.flights.find((x) => x.id === id);
        return f ? flightCode(f) : '';
      };
      for (const e of events) {
        switch (e.kind) {
          case 'landingCleared':
            if (tutorialRef.current === 1) setTutorial(2);
            break;
          case 'fuelStart':
          case 'bagsStart':
          case 'fuelQueued':
          case 'bagsQueued': {
            const f = s.flights.find((x) => x.id === e.a);
            if (tutorialRef.current === 2 && f && f.fuelState > 0 && f.bagState > 0) setTutorial(3);
            // (no message: the plane's bubble shows it is waiting for the truck)
            break;
          }
          case 'boardingStart':
            if (tutorialRef.current === 3) setTutorial(4);
            break;
          case 'takeoffCleared':
            if (tutorialRef.current === 4) setTutorial(5);
            break;
          case 'upgraded': {
            if (tutorialRef.current === 6) setTutorial(7);
            const def = UPGRADES[e.b];
            if (!def) break;
            // where it shows on the map (a decoration, the tower, the radar)
            const spot = upgradeSpot(s, def.id, towerRef.current);
            const was = versionOf(def.id, e.c - e.a);
            const now = versionOf(def.id, e.c);
            if (spot) {
              const sx = isoX(spot[0], spot[1]);
              const sy = isoY(spot[0], spot[1]) - 30;
              fx.sparkle(sx, sy);
              if (now > was && was > 0) for (let k = 0; k < 5; k++) fx.sparkle(sx + Math.cos(k * 1.26) * 26, sy - 10 + Math.sin(k * 1.26) * 16);
            }
            if (now > was && was > 0) toast('up', t('toast.newVersion', { name: t(`ver.${def.id}.${now}` as TKey) }), 'good', undefined, true);
            break;
          }
          // (the plane's bubble and the edge markers say it; a message only for the first few flights)
          case 'landingRequest':
            if (s.stats.served < 3) toast('land', t('toast.landingRequest', { code: codeOf(e.a) }), 'info', 'land');
            break;
          case 'takeoffRequest':
            if (s.stats.served < 3) toast('takeoff', t('toast.takeoffRequest', { code: codeOf(e.a) }), 'info', 'takeoff');
            break;
          case 'diverted':
            toast('warn', t('toast.diverted', { code: codeOf(e.c) }), 'warn', 'diverted');
            break;
          case 'runwayFlip':
            toast('wind', t('toast.runwayFlip'), 'info', 'flip');
            break;
          case 'fogIn':
            toast('fog', t('toast.fogIn'), 'warn', 'fog');
            break;
          // (the fog lifting is plain to see)
          case 'crosswind':
            toast('wind', t('toast.crosswind', { n: e.a }), 'warn', 'cross');
            break;
          case 'goAround':
            toast('takeoff', t('toast.goAround', { code: codeOf(e.a) }), 'warn', 'goAround');
            break;
          case 'diversionRequest':
            toast('fuel', t('toast.diversionRequest', { code: codeOf(e.a) }), 'good');
            break;
          // (a delivery: the tanker unloads on the map and the gauges fill)
          case 'supplyOut':
            toast('warn', t(e.a === 0 ? 'toast.fuelOut' : 'toast.partsOut'), 'warn', 'out' + e.a);
            break;
          case 'supplyLow':
            toast('coin', t('toast.supplyLow', { what: t(e.a === 0 ? 'sup.fuel' : 'sup.parts') }), 'warn', 'low' + e.a);
            break;
          case 'supplyOrdered':
            if (e.c === 1) toast('hourglass', t('toast.urgent'), 'info', 'urgent', true);
            break;
          case 'aog':
            toast('wrench', t('toast.aog', { code: codeOf(e.a) }), 'warn', 'aog');
            break;
          // (a repair done: the plane goes on, no message)
          case 'waitingPart':
            toast('hourglass', t('toast.waitingPart', { code: codeOf(e.a) }), 'warn', 'part');
            break;
          case 'checkRequest':
            toast('build', t('toast.checkRequest', { code: codeOf(e.a), check: t(e.b === 2 ? 'sup.checkB' : 'sup.checkA') }), 'info');
            break;
          case 'checkDone':
            // (the coins fly up from the hangar)
            fx.money(isoX(e.x, e.y), isoY(e.x, e.y, 0.3) - 20, Big.fromNumber(e.b).m, Big.fromNumber(e.b).e);
            break;
          case 'cmdRejected':
            // (the test bot's own taps are not the player's: no answer on screen)
            if (debug.auto) break;
            if (e.a === REJECT.noStand) toast('warn', t('toast.noStand'), 'warn', 'noStand', true);
            else if (e.a === REJECT.notReady) toast('hourglass', t('toast.notReady'), 'info', 'notReady', true);
            else if (e.a === REJECT.noMoney) toast('coin', t('toast.noMoney'), 'warn', 'money', true);
            else if (e.a === REJECT.limit) toast('team', t('toast.limit'), 'info', 'limit', true);
            else if (e.a === REJECT.badSpot) toast('warn', t('toast.badSpot'), 'warn', 'spot', true);
            else if (e.a === REJECT.needs) toast('warn', t('toast.needs'), 'warn', 'needs', true);
            break;
          case 'hired': {
            const m = s.staff.find((x) => x.id === e.b);
            const role = STAFF_ROLES[e.a];
            if (m && role) toast('team', t('toast.hired', { name: personName(m, lang), role: t(`role.${role.id}` as TKey) }), 'good', undefined, true);
            break;
          }
          // (wages: the coins go down, no message)
          case 'applicantArrived': {
            const R = RARITIES[e.b];
            // (only the rare finds: the staff button's dot says the rest)
            if (R && e.b >= 2) toast('team', t('toast.applicant', { rarity: t(`rarity.${R.id}` as TKey), role: t(`role.${STAFF_ROLES[e.a]?.id ?? 'atc'}` as TKey) }), 'good');
            break;
          }
          case 'negotiated':
            toast('team', e.a === 1 ? t('toast.negotiateOk') : t('toast.negotiateNo'), e.a === 1 ? 'good' : 'warn', undefined, true);
            break;
          // (a level up or a raise request: the staff button's dot, no message)
          case 'quit':
          case 'fired': {
            const name = lastNames.current.get(e.c);
            if (name) toast('warn', t(e.kind === 'quit' ? 'toast.quit' : 'toast.fired', { name }), 'warn');
            break;
          }
          // (a trial ended: the staff button's dot)
          case 'checkedIn':
            fx.bag();
            break;
          case 'sale':
            fx.sale(isoX(e.x, e.y), isoY(e.x, e.y) - 14, e.a, e.b);
            break;
          // (a lost bag: the rating and the reviews say it; an offer: the airlines button's dot)
          case 'contractSigned':
            toast('handshake', t('toast.signed', { name: AIRLINES[e.a]?.name ?? '' }), 'good', undefined, true);
            break;
          case 'offerResult': {
            const name = AIRLINES[e.a]?.name ?? '';
            if (e.b === 1) toast('tail', t('toast.offerDiscount', { name }), 'info', undefined, true);
            else toast('tail', e.c === 1 ? t('toast.offerMore', { name }) : t('toast.offerNo', { name }), e.c === 1 ? 'good' : 'warn', undefined, true);
            break;
          }
          case 'airlineWarning': {
            const name = AIRLINES[e.a]?.name ?? '';
            toast('warn', e.b === 1 ? t('toast.airlineCut', { name, n: e.c }) : t('toast.airlineWarning', { name }), 'warn');
            break;
          }
          case 'airlineLeft':
            toast('warn', t('toast.airlineLeft', { name: AIRLINES[e.a]?.name ?? '' }), 'warn');
            break;
          case 'contractExpanded':
            toast('up', t('toast.expanded', { name: AIRLINES[e.a]?.name ?? '', n: e.b }), 'good', undefined, true);
            break;
          case 'contractEnded': {
            const name = AIRLINES[e.a]?.name ?? '';
            if (e.c === 2) toast('tail', t('toast.contractEnded', { name }), 'info', undefined, true);
            else if (e.b > 0) toast('coin', t('toast.seasonBonus', { name, amount: formatBig(e.b) }), 'good');
            break;
          }
          case 'tierBuildStart':
            toast('build', t('toast.tierBuild', { tier: t(`tier.${tierDef(e.a).key}` as TKey) }), 'good');
            break;
          case 'tierUp': {
            toast('star', t('toast.tierUp', { tier: t(`tier.${tierDef(e.a).key}` as TKey) }), 'good', undefined, true);
            const NL = layoutOf(e.a);
            for (const st of NL.stands) fx.sparkle(isoX(st.pos[0], st.pos[1]), isoY(st.pos[0], st.pos[1]) - 20);
            fx.sparkle(isoX(NL.hut[0] + 1, NL.hut[1] + 0.7), isoY(NL.hut[0] + 1, NL.hut[1] + 0.7) - 40);
            break;
          }
          case 'incidentSoon': {
            const kind = INCIDENTS[e.a]?.kind;
            if (kind) toast(kind === 'airshow' ? 'plane' : 'cloud', t(`inc.${kind}.soon` as TKey, { t: Math.round(e.c) }), 'warn', 'inc' + kind);
            break;
          }
          case 'incidentStart': {
            const kind = INCIDENTS[e.a]?.kind;
            if (!kind) break;
            const inc = ctrl.state.incidents.find((i) => i.id === e.b);
            const code = inc?.flight ? codeOf(inc.flight) : '';
            const icon = INCIDENT_ICON[kind] ?? 'warn';
            const happy = kind === 'vip' || kind === 'airshow' || kind === 'celebrity' || kind === 'historic';
            toast(icon, t(`inc.${kind}.start` as TKey, { code }), happy ? 'good' : 'warn', 'inc' + kind);
            break;
          }
          case 'incidentEnd': {
            const kind = INCIDENTS[e.a]?.kind;
            // (emergencies and VIPs have their own moment when it happens)
            if (!kind || kind === 'emergency' || kind === 'vip' || kind === 'birds' || kind === 'medical' || kind === 'celebrity') break;
            if (kind === 'historic' && e.b <= 0) break;
            // (security: how it went, well or late)
            if (kind === 'bag' || kind === 'drone' || kind === 'breach') toast(e.b > 0 ? 'shield' : 'warn', t(`inc.${kind}.${e.b > 0 ? 'good' : 'bad'}` as TKey, { n: formatBig(Big.fromNumber(e.c)) }), e.b > 0 ? 'good' : 'info');
            else if (e.b > 0 && kind !== 'fod') toast('coin', t(`inc.${kind}.good` as TKey, { n: formatBig(Big.fromNumber(e.c)) }), 'good');
            else if (kind === 'storm') toast('sun', t('inc.storm.end'), 'good');
            else if (kind === 'fod') toast('check', t('inc.fod.good'), 'good');
            break;
          }
          case 'emergencyLanded':
            toast('check', t('inc.emergency.good', { n: formatBig(Big.fromNumber(e.b)) }), 'good');
            fx.money(isoX(e.x, e.y), isoY(e.x, e.y, 0.3) - 20, Big.fromNumber(e.b).m, Big.fromNumber(e.b).e);
            break;
          case 'emergencyMissed':
            toast('warn', t('inc.emergency.bad'), 'warn');
            break;
          case 'birdStrike':
            toast('warn', t('toast.birdStrike', { code: codeOf(e.a) }), 'warn', 'bird');
            break;
          case 'vipTip':
            toast('star', t('toast.vipTip', { code: codeOf(e.a), n: formatBig(Big.fromNumber(e.b)) }), 'good');
            break;
          // (the runway car drives out on the map)
          case 'weekend':
            toast('sun', t('toast.weekend'), 'good', 'weekend');
            break;
          case 'holiday': {
            const h = HOLIDAYS[e.a];
            if (h) toast('party', t(e.b > 0 ? 'toast.holiday' : 'toast.holidayRush', { name: t(`hol.${h.id}.title` as TKey) }), 'good', 'holiday');
            break;
          }
          // (the ambulance drives out on the map)
          case 'medicalDone':
            toast('medic', t('inc.medical.good', { n: formatBig(Big.fromNumber(e.b)) }), 'good');
            fx.money(isoX(e.x, e.y), isoY(e.x, e.y, 0.3) - 20, Big.fromNumber(e.b).m, Big.fromNumber(e.b).e);
            break;
          case 'medicalMissed':
            toast('warn', t('inc.medical.bad'), 'warn');
            break;
          case 'celebDocked':
            toast('camera', t(e.b ? 'toast.celebPress' : 'toast.celebPrivate'), 'good', 'celeb');
            break;
          case 'celebTip':
            toast('star', t('toast.celebTip', { n: formatBig(Big.fromNumber(e.b)) }), 'good');
            fx.money(isoX(e.x, e.y), isoY(e.x, e.y, 0.3) - 20, Big.fromNumber(e.b).m, Big.fromNumber(e.b).e);
            break;
          case 'buzz':
            toast('camera', t('toast.buzz'), 'good');
            break;
          case 'badPress':
            toast('warn', t('toast.badPress'), 'warn');
            break;
          case 'exhibitOpen':
            toast('ticket', t('toast.exhibitOpen'), 'good');
            break;
          case 'reviewBonus':
            toast('coin', t('toast.reviewBonus', { n: formatBig(Big.fromNumber(e.a)) }), 'good', undefined, true);
            setBump(1);
            break;
          case 'rumor':
            toast('search', t('toast.rumor'), 'warn', 'rumor');
            break;
          case 'vipCare':
            toast('star', t('toast.vipCare'), 'good', undefined, true);
            fx.sparkle(isoX(e.x, e.y), isoY(e.x, e.y) - 16);
            break;
          case 'inspectorLeft':
            toast(e.a === 1 ? 'star' : 'guide', t(`toast.inspector.${e.a}` as TKey), e.a === 1 ? 'good' : 'info', undefined, true);
            break;
          case 'managerLevel':
            // (a level is earned: always worth a word; a chest gets its own)
            toast(e.c ? 'chest' : 'up', e.c ? t('toast.managerChest', { n: e.a }) : t('toast.managerLevel', { n: e.a, c: formatBig(Big.fromNumber(e.b)) }), 'good', 'level', true);
            setBump(1);
            break;
          case 'festivalStart': {
            const fd = FESTIVALS[e.a];
            if (fd && e.b > 0) toast('party', t('toast.festivalStart', { name: t(`fest.${fd.kind}.name` as TKey) }), 'good', 'fest');
            break;
          }
          case 'festivalPrize': {
            const fd = FESTIVALS[e.a];
            if (fd) toast(e.b === 3 ? 'star' : 'party', t('toast.festivalPrize', { name: t(`fest.${fd.kind}.name` as TKey), n: e.b }), 'good', undefined, true);
            if (e.x > 0) setBump(1);
            break;
          }
          case 'dealBought':
            toast('check', t('toast.dealBought'), 'good', undefined, true);
            break;
          case 'dailyGift':
            toast('gift', t('toast.dailyGift', { n: e.a }), 'good', undefined, true);
            if (e.x > 0) setBump(1);
            break;
          case 'wheelSpun':
            // (the wheel turns in the panel and shows the prize)
            setLastSpin({ seg: e.a, at: e.id });
            break;
          case 'chestOpened':
            toast('diamond', t('toast.chestOpened', { g: e.a }), 'good', undefined, true);
            break;
          case 'medal': {
            const a = ACHIEVEMENTS[e.a];
            if (a) toast('star', t('toast.medal', { medal: t(`medal.${MEDALS[Math.max(0, e.b - 1)]}` as TKey), name: t(`ach.${a.id}` as TKey), g: e.c }), 'good', undefined, true);
            break;
          }
          case 'guideEdition':
            setGuideNews({ edition: e.c, stars: e.a, prev: e.b, coins: e.x, gems: e.y });
            if (e.x > 0) setBump(1);
            break;
          case 'goalDone': {
            const g = GOALS[e.a];
            if (g) toast('star', t('toast.goalDone', { goal: t(`goal.${g.id}` as TKey), n: formatBig(Big.fromNumber(e.b)) }), 'good', undefined, true);
            setBump(1);
            break;
          }
          case 'milestone':
            toast('star', t('toast.milestone'), 'good');
            break;
          case 'buildStart':
            toast('wrench', t('toast.buildStart'), 'info', undefined, true);
            break;
          case 'buildDone': {
            toast('check', t('toast.buildDone'), 'good');
            const site = layoutOf(s.tier).stands[Math.min(e.a, layoutOf(s.tier).stands.length - 1)];
            if (site) fx.sparkle(isoX(site.pos[0], site.pos[1]), isoY(site.pos[0], site.pos[1]) - 20);
            break;
          }
          case 'paid':
            fx.money(isoX(e.x, e.y), isoY(e.x, e.y, 0.3) - 20, e.a, e.b);
            break;
          case 'touchdown':
          case 'liftoff':
            fx.dust(isoX(e.x, e.y), isoY(e.x, e.y), 5);
            break;
          case 'fuelDone':
          case 'boardingDone':
            fx.sparkle(isoX(e.x, e.y), isoY(e.x, e.y) - 24);
            break;
        }
      }
    },
    [ctrl, fx, t, toast, lang, setTutorial],
  );

  useEffect(() => {
    fx.onCoinArrive = () => setBump(1);
  }, [fx]);
  useEffect(() => {
    if (bump <= 0) return;
    const id = setTimeout(() => setBump(0), 120);
    return () => clearTimeout(id);
  }, [bump]);

  // HUD and card polling, twice per second, with shallow compare
  useEffect(() => {
    const id = setInterval(() => {
      const h = hudOf(ctrl);
      setHud((old) => (sameHud(old, h) ? old : h));
      const g = currentGoal(ctrl.state);
      const gp = g?.progress(ctrl.state);
      const gv: GoalView | null = g && gp ? { id: g.id, index: ctrl.state.goal, total: GOALS.length, have: gp.have, need: gp.need, reward: formatBig(Big.fromNumber(goalReward(ctrl.state, g))) } : null;
      setGoal((old) => (old && gv && old.id === gv.id && old.have === gv.have && old.reward === gv.reward ? old : gv));
      if (gv && goalOpen.current.id !== gv.id) goalOpen.current = { id: gv.id, until: performance.now() + GOAL_OPEN_MS };
      const sel = selectedRef.current;
      const f = sel ? ctrl.state.flights.find((x) => x.id === sel) : undefined;
      const hold = f && f.landCleared && (f.phase === 'holding' || f.phase === 'inbound') ? (approachBlocker(ctrl.state, f) ?? '') : '';
      const v = f ? viewOf(f, repOf(ctrl.state, f.airline), hold, ctrl.state.time) : null;
      if (sel && !f) setSelected(0);
      setCard((old) => (sameView(old, v) ? old : v));
      setNow(performance.now());
      const st = ctrl.state;
      const openNow = st.standOpen.map((o) => (o ? '1' : '0')).join('');
      setOpenSig((old) => (old === openNow ? old : openNow));
      setTier((old) => (old === st.tier ? old : st.tier));
      const sig = versionOf('scanner', st.upg.scanner ?? 0) * 10000 + (st.upg.fence ?? 0) * 1000 + (st.upg.fuelFarm ?? 0) * 100 + counterCount(st) * 10 + laneCount(st);
      setStations((old) => (old === sig ? old : sig));
      updateTutorial();
      setRev((r) => r + 1);
      // copies, so the panel re-renders when people change (polled, not every frame)
      const sv: StaffView = {
        money: st.money.toNumber(),
        staff: st.staff.map((m) => ({ ...m, traits: m.traits.slice(), talents: m.talents.slice() })),
        applicants: st.applicants.map((a) => ({ ...a, traits: a.traits.slice(), talents: a.talents.slice() })),
        wages: wagesPerDay(st),
        time: st.time,
        tier: st.tier,
      };
      setStaffView(sv);
      for (const m of st.staff) lastNames.current.set(m.id, personName(m, lang));
    }, 250);
    return () => clearInterval(id);
  }, [ctrl]);

  const autoSelected = useRef(false);
  useFrameLoop((dtMs) => {
    if (size.w <= 0) return;
    const t0 = performance.now();
    if (debug.auto) for (const cmd of botCommands(ctrl.state, { reaction: 1.5 })) ctrl.send(cmd);
    const alpha = ctrl.tick(dtMs);
    const ev = ctrl.takeEvents();
    if (ev.length) onEvents(ev);
    if (debug.select && !autoSelected.current && ctrl.state.flights.length > 0) {
      autoSelected.current = true;
      const grounded = debug.fault ? ctrl.state.flights.find((f) => f.aog === 1 && !f.check) : undefined;
      setSelected((grounded ?? ctrl.state.flights[0]).id);
    }
    cam.viewW = size.w;
    cam.viewH = size.h;
    if (debug.follow) {
      const f = ctrl.state.flights[0];
      if (f) cam.target = { x: isoX(f.x, f.y), y: isoY(f.x, f.y, f.z) };
    }
    updateCamera(cam, dtMs / 1000);
    fx.update(dtMs / 1000, cam);
    writer.begin(cam.x, cam.y, cam.zoom);
    writer.sky = 0x8fce78;
    drawGame(
      writer,
      ctrl.state,
      sprites,
      world,
      cam,
      fx,
      {
        selected: selectedRef.current,
        alpha,
        time: performance.now() / 1000,
        safeTop: safe.current.top,
        safeBottom: safe.current.bottom,
        build: buildModeRef.current ? { drag: dragRef.current?.id ?? null, x: dragRef.current?.x ?? 0, y: dragRef.current?.y ?? 0, ok: dragRef.current?.ok ?? false } : undefined,
      },
      indicators.current,
    );
    const out = writer.finish();
    snap.value = out;
    // close in: draw the sprites on screen again at the resolution this zoom needs (a few a frame, no stutter)
    const r = res.value;
    if (r && cam.zoom >= r.vecZoom) {
      let budget = VEC_PER_FRAME;
      const from = HEADER + out[H_SHADOWS] * SHADOW_STRIDE;
      const n = out[H_SPRITES];
      const dpr = Math.max(1, PixelRatio.get());
      for (let k = 0; k < n && budget > 0; k++) {
        const s = out[from + k * SPRITE_STRIDE];
        if (s >= sprites.atlas.count) continue;
        // (device pixels per atlas pixel at this zoom, rounded up; at most 4)
        const f = Math.min(4, Math.max(2, Math.ceil((cam.zoom * dpr * out[from + k * SPRITE_STRIDE + 3]) / ATLAS_SCALE - 0.15)));
        const have = r.hi[s];
        if (have && have.f >= f) continue;
        const hi = renderSprite(sprites.atlas, s, f);
        if (!hi) break;
        if (have) {
          hiPixels.current -= have.image.width() * have.image.height();
          trash.current.push({ image: have.image, frame: frameNo.current });
        } else vecOrder.current.push(s);
        r.hi[s] = hi;
        hiPixels.current += hi.image.width() * hi.image.height();
        budget--;
      }
      // (only so much kept: the oldest go first)
      while (hiPixels.current > VEC_PIXELS && vecOrder.current.length > 0) {
        const old = vecOrder.current.shift()!;
        const h = r.hi[old];
        if (h) {
          hiPixels.current -= h.image.width() * h.image.height();
          trash.current.push({ image: h.image, frame: frameNo.current });
        }
        r.hi[old] = null;
      }
      if (budget < VEC_PER_FRAME) res.value = { ...r };
    }
    // close in: the sharp ground layer, tile by tile at this zoom's resolution (one a frame)
    const r2 = res.value;
    if (r2 && r2.crisp && cam.zoom >= r2.bgZoom) {
      const dpr = Math.max(1, PixelRatio.get());
      const f = Math.min(4, Math.max(1.5, Math.ceil(cam.zoom * dpr * 2) / 2));
      const hw = cam.viewW / 2 / cam.zoom;
      const hh = cam.viewH / 2 / cam.zoom;
      const tx0 = Math.floor((cam.x - hw) / CRISP_TILE);
      const tx1 = Math.floor((cam.x + hw) / CRISP_TILE);
      const ty0 = Math.floor((cam.y - hh) / CRISP_TILE);
      const ty1 = Math.floor((cam.y + hh) / CRISP_TILE);
      let made: ReturnType<typeof renderCrispTile> = null;
      // (the one nearest the middle of the screen first)
      let best = Infinity;
      let pick: [number, number] | null = null;
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const key = ty * 100000 + tx;
          const have = r2.crispTiles.find((t) => t.key === key);
          if (have && have.f >= f) continue;
          const d = Math.hypot((tx + 0.5) * CRISP_TILE - cam.x, (ty + 0.5) * CRISP_TILE - cam.y);
          if (d < best) {
            best = d;
            pick = [tx, ty];
          }
        }
      if (pick) made = renderCrispTile(r2.crisp, pick[0] * CRISP_TILE, pick[1] * CRISP_TILE, f, pick[1] * 100000 + pick[0]);
      if (made) {
        const keep: typeof r2.crispTiles = [];
        for (const t of r2.crispTiles) {
          if (t.key === made.key) trash.current.push({ image: t.image, frame: frameNo.current });
          else keep.push(t);
        }
        keep.push(made);
        // (only so much kept: the oldest go first)
        let px = keep.reduce((a, t) => a + t.image.width() * t.image.height(), 0);
        while (px > CRISP_PIXELS && keep.length > 1) {
          const old = keep.shift()!;
          px -= old.image.width() * old.image.height();
          trash.current.push({ image: old.image, frame: frameNo.current });
        }
        res.value = { ...r2, crispTiles: keep };
      }
    }
    // (freed once no frame can still be drawing them)
    frameNo.current++;
    while (trash.current.length > 0 && trash.current[0].frame < frameNo.current - 4) trash.current.shift()!.image.dispose();
    recordFrame(performance.now() - t0);
  });

  const act = useCallback(
    (id: number, want?: number) => {
      const f = ctrl.state.flights.find((x) => x.id === id);
      if (!f) return;
      const a = WANT_ACTION[want ?? f.want];
      if (a) ctrl.send({ type: a.cmd, flightId: f.id });
    },
    [ctrl],
  );

  const onTap = useCallback(
    (vx: number, vy: number) => {
      // edge markers first: act and pan to the flight
      for (const ind of indicators.current) {
        if (Math.hypot(vx - ind.vx, vy - ind.vy) < 30) {
          const f = ctrl.state.flights.find((x) => x.id === ind.id);
          if (f) {
            act(f.id);
            setSelected(f.id);
            cam.target = { x: isoX(f.x, f.y), y: isoY(f.x, f.y, f.z) };
          }
          return;
        }
      }
      const p = viewToWorld(cam, vx, vy);
      // the inspector's day: a suspect (or the magnifier over one) opens the guide
      const visit = ctrl.state.guide.visit;
      if (visit && !visit.done) {
        for (const q of ctrl.state.people) {
          if (!visit.suspects.includes(q.id)) continue;
          const sx = isoX(q.x, q.y);
          const sy = isoY(q.x, q.y);
          if (Math.hypot(p.x - sx, p.y - (sy - 22 - 10 / cam.zoom)) * cam.zoom < 26 || Math.hypot(p.x - sx, p.y - (sy - 8)) * cam.zoom < 18) {
            setPanel('guide');
            return;
          }
        }
      }
      const T = layoutOf(ctrl.state.tier).terminal;
      for (const c of [...T.counters.slice(0, counterCount(ctrl.state)), ...T.lanes.slice(0, laneCount(ctrl.state))]) {
        if (Math.hypot(p.x - isoX(c[0], c[1]), p.y - (isoY(c[0], c[1]) - 10)) * cam.zoom < 26) {
          setUpgCat('terminal');
          setPanel('upgrades');
          return;
        }
      }
      const site = constructionSite(ctrl.state);
      if (site) {
        const sx = isoX(site.at[0], site.at[1]);
        const sy = isoY(site.at[0], site.at[1], 0.9);
        if (Math.hypot(p.x - sx, p.y - sy) * cam.zoom < 46) {
          ctrl.send({ type: 'rushBuild' });
          fx.sparkle(sx, sy - 20);
          return;
        }
      }
      let best = 0;
      let bestD = Infinity;
      for (const f of ctrl.state.flights) {
        const art = planeArt(f.aircraft);
        const sx = isoX(f.x, f.y);
        const sy = isoY(f.x, f.y, f.z) - (art.radius + art.gear) * Z_PX;
        const dPlane = Math.hypot(p.x - sx, p.y - sy) * cam.zoom;
        let d = dPlane - Math.max(0, art.length * 14 * cam.zoom);
        if (f.want !== WANT.none) {
          const b = bubbleAnchor(f, cam.zoom);
          d = Math.min(d, Math.hypot(p.x - b.x, p.y - b.y) * cam.zoom - 10);
        }
        if (d < bestD) {
          bestD = d;
          best = f.id;
        }
      }
      if (best && bestD < 34) {
        const f = ctrl.state.flights.find((x) => x.id === best);
        if (f && f.want !== WANT.none) act(best);
        setSelected(best);
      } else {
        setSelected(0);
      }
    },
    [cam, ctrl, act],
  );

  const buildModeRef = useRef(false);
  buildModeRef.current = buildMode;
  // build mode: press a decoration, drag it, drop it on a green tile
  const drag = useRef<DragHandler | null>(null);
  drag.current = buildMode
    ? {
        start: (vx, vy) => {
          const p = viewToWorld(cam, vx, vy);
          for (const it of decorItems(ctrl.state)) {
            const d = decorPos(ctrl.state, it.id);
            if (Math.hypot(p.x - isoX(d[0], d[1]), p.y - (isoY(d[0], d[1]) - 14)) * cam.zoom < 40) {
              dragRef.current = { id: it.id, x: d[0], y: d[1], ok: true };
              return true;
            }
          }
          return false;
        },
        move: (vx, vy) => {
          if (!dragRef.current) return;
          const p = viewToWorld(cam, vx, vy);
          const w = screenToWorld(p.x, p.y);
          const x = Math.round(w.x * 2) / 2;
          const y = Math.round(w.y * 2) / 2;
          dragRef.current = { ...dragRef.current, x, y, ok: decorSpotOk(ctrl.state, dragRef.current.id, x, y) };
        },
        end: () => {
          const d = dragRef.current;
          dragRef.current = null;
          if (d) ctrl.send({ type: 'moveDecor', id: d.id, x: d.x, y: d.y });
        },
      }
    : null;
  const responder = useCameraResponder(cam, onTap, offset, drag);
  // web: mouse-wheel / trackpad zoom, and pinches stay with the map (not the page)
  const mapRef = useRef<unknown>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = mapRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    return attachWebZoom(el, cam);
  }, [cam]);

  // Browser-test hook (web only, ?hook=1): where things are on screen.
  useEffect(() => {
    if (!debug.hook || typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    w.__skyport = {
      flights: () =>
        ctrl.state.flights.map((f) => {
          const b = bubbleAnchor(f, cam.zoom);
          return {
            id: f.id,
            phase: f.phase,
            want: f.want,
            vx: (b.x - cam.x) * cam.zoom + cam.viewW / 2 + offset.current.x,
            vy: (b.y - cam.y) * cam.zoom + cam.viewH / 2 + offset.current.y,
          };
        }),
      indicators: () => indicators.current.map((i) => ({ ...i })),
      stats: () => ({ served: ctrl.state.stats.served, money: ctrl.state.money.toNumber(), time: ctrl.state.time, tier: ctrl.state.tier }),
      airlines: () => ({
        contracts: ctrl.state.contracts.map((c) => ({ id: AIRLINES[c.al].id, perDay: c.perDay, pay: c.pay })),
        offers: ctrl.state.offers.map((o) => ({ id: o.id, airline: AIRLINES[o.al].id, pay: o.pay, perDay: o.perDay, negotiated: o.negotiated })),
      }),
      toView: (x: number, y: number) => ({ vx: (isoX(x, y) - cam.x) * cam.zoom + cam.viewW / 2, vy: (isoY(x, y) - cam.y) * cam.zoom + cam.viewH / 2 }),
      decor: () =>
        decorItems(ctrl.state).map((it) => {
          const d = decorPos(ctrl.state, it.id);
          return { id: it.id, x: d[0], y: d[1], vx: (isoX(d[0], d[1]) - cam.x) * cam.zoom + cam.viewW / 2, vy: (isoY(d[0], d[1]) - 14 - cam.y) * cam.zoom + cam.viewH / 2 };
        }),
      selected: () => selectedRef.current,
      camera: () => ({ x: cam.x, y: cam.y, zoom: cam.zoom }),
      frames: () => frameStats.frames,
      atlas: () => ({ w: sprites.atlas.width, h: sprites.atlas.height, count: sprites.atlas.count, ms: sprites.atlas.buildMs }),
      incidents: () => ctrl.state.incidents.map((i) => ({ kind: i.kind, state: i.state, choice: i.choice, result: i.result, amount: i.amount })),
      holiday: () => ({ holiday: ctrl.state.holiday, day: ctrl.state.holidayDay, today: ctrl.state.today }),
      terminals: () => ({ t1: ctrl.state.people.filter((p) => p.term === 0).length, t3: ctrl.state.people.filter((p) => p.term === 1).length, t4: ctrl.state.people.filter((p) => p.term === 2).length }),
      buses: () => ctrl.state.buses.map((b) => ({ state: b.state, x: b.x, y: b.y, load: b.load.length })),
      apm: () => {
        const t = ctrl.state.apm;
        const n = (st: number) => ctrl.state.people.filter((p) => p.state === st).length;
        const b = layoutOf(ctrl.state.tier).sat?.building.box;
        const inD = b ? ctrl.state.people.filter((p) => p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]).length : 0;
        return { x: t?.x ?? 0, state: t?.state ?? 'none', at: t?.at ?? 0, load: t?.load.length ?? 0, waitT: n(PST.atApm), waitD: n(PST.atApmA), toD: n(PST.toApmA), inD };
      },
      clean: () => ({
        litter: ctrl.state.litter.length,
        sweepers: ctrl.state.sweepers.length,
        cleanliness: cleanliness(ctrl.state),
        at: ctrl.state.sweepers.map((w) => ({ x: w.x, y: w.y, near: ctrl.state.litter.filter((l) => l.area === w.area).length })),
        pieces: ctrl.state.litter.map((l) => ({ x: l.x, y: l.y, area: l.area })),
      }),
      // (tests: look at a spot)
      lookAt: (x: number, y: number, zoom: number) => {
        cam.target = null;
        cam.x = isoX(x, y);
        cam.y = isoY(x, y);
        cam.zoom = zoom;
      },
      guide: () => {
        const g = ctrl.state.guide;
        const v = g.visit;
        return {
          stars: g.stars,
          edition: g.edition,
          notes: g.notes.length,
          visit: v ? { suspects: v.suspects.length, picked: v.picked, done: v.done, result: v.result, here: v.suspects.filter((id) => ctrl.state.people.some((q) => q.id === id)).length } : null,
          suspects: v
            ? ctrl.state.people
                .filter((q) => v.suspects.includes(q.id))
                .map((q) => ({ id: q.id, x: q.x, y: q.y, vx: (isoX(q.x, q.y) - cam.x) * cam.zoom + cam.viewW / 2, vy: (isoY(q.x, q.y) - 8 - cam.y) * cam.zoom + cam.viewH / 2 }))
            : [],
        };
      },
      tower: () => world.tower,
      // (screenshots: start a security incident now; where its spot is)
      security: (kind: 'bag' | 'drone' | 'breach') => {
        const inc = startIncident(ctrl.state, kind, (p) => spawnFlight(ctrl.state, p));
        return inc ? { x: inc.x, y: inc.y } : null;
      },
      guards: () => ctrl.state.guards.map((g) => ({ x: g.x, y: g.y, target: g.target })),
      // (screenshots: these upgrade levels at once)
      setUpg: (lv: Record<string, number>) => {
        for (const [k, v] of Object.entries(lv)) ctrl.state.upg[k] = v;
        ctrl.state.upgRev++;
      },
      fest: () => ({ ...ctrl.state.fest, deal: flashDeal(ctrl.state)?.id ?? null }),
      daily: () => ({ ...ctrl.state.daily, gift: giftReady(ctrl.state), spinIn: spinIn(ctrl.state) }),
      career: () => ({ level: ctrl.state.career.level, xp: ctrl.state.career.xp, chests: ctrl.state.career.chests, toClaim: medalsToClaim(ctrl.state) }),
      // (screenshots: a manager at this level with chests to open)
      careerSet: (level: number, chests: number) => {
        ctrl.state.career.level = level;
        ctrl.state.career.xp = Math.floor(xpToNext(level) * 0.6);
        ctrl.state.career.chests = chests;
      },
      // (screenshots: the rumor now, an edition now, or a guide with these stars and a notebook)
      rumorNow: () => startRumor(ctrl.state),
      publishNow: () => publishEdition(ctrl.state),
      guideSet: (stars: number, edition: number) => {
        const g = ctrl.state.guide;
        g.stars = stars;
        g.best = Math.max(g.best, stars);
        g.edition = edition;
        g.notes = [1, 10, 19, 28, 38, 46, 55];
        g.noteResult = 1;
      },
      skytaxis: () => ctrl.state.flights.filter((f) => AIRCRAFT[f.aircraft]?.id === 'skytaxi').map((f) => ({ phase: f.phase, z: f.z, x: f.x, y: f.y })),
      rail: () => {
        const r = layoutOf(ctrl.state.tier).rail;
        return r ? { ...railTrain(r, ctrl.state.time), waiting: ctrl.state.people.filter((p) => p.state === PST.atRail).length } : null;
      },
    };
    return () => {
      delete w.__skyport;
    };
  }, [cam, ctrl, sprites]);
  const wide = size.w > size.h * 1.25;
  const fs = ctrl.state.fest;
  const festDef = fs.n >= 0 ? FESTIVALS[fs.kind] : null;
  const festView: FestView | null = festDef ? { kind: festDef.kind, icon: festDef.icon, points: fs.points, goals: festDef.goals, prizes: fs.prizes, left: formatDuration(festivalLeft(ctrl.state)) } : null;
  const fd = flashDeal(ctrl.state);
  const dealView: DealView | null = fd ? { id: fd.id, price: formatBig(fd.price), left: Math.ceil(fd.left), off: Math.round(DEAL_OFF * 100), canBuy: ctrl.state.money.gte(fd.price) } : null;
  const inspectorOn = !!ctrl.state.guide.visit && !ctrl.state.guide.visit.done && ctrl.state.guide.visit.picked === 0;
  const canHire =
    !!staffView &&
    (staffView.staff.some((m) => m.raise > 0 || m.trialUntil === 1 || m.points > 0) ||
      staffView.applicants.some((a) => staffView.money >= a.cost && staffCount(ctrl.state, a.role) < maxPerRole(a.role) && staffCount(ctrl.state, a.role) === 0));
  const offer = rev >= 0 ? bestOffer(ctrl.state, true) : null;
  const tierOk = rev >= 0 && checkTier(ctrl.state).ok;
  const airlineNews = rev >= 0 && (ctrl.state.offers.length > 0 || ctrl.state.contracts.some((c) => c.warned || canExpand(ctrl.state, c)));
  // landscape phones: compact bar, and the best-value tip beside it when there is room
  const short = size.h > 0 && size.h < 500;
  const barRow = short && size.w >= 800 && !!offer;
  const sidePanel = wide && (panel === 'upgrades' || panel === 'staff' || panel === 'airlines' || panel === 'airport' || panel === 'supplies' || panel === 'events' || panel === 'help');
  const barItems: BarItem[] = [
    { id: 'upgrades', icon: 'wrench', label: 'bar.upgrades', badge: !!offer },
    { id: 'staff', icon: 'team', label: 'bar.staff', badge: canHire },
    { id: 'airlines', icon: 'tail', label: 'bar.airlines', badge: airlineNews },
    { id: 'board', icon: 'board', label: 'bar.board' },
    { id: 'airport', icon: 'plane', label: 'bar.airport', badge: tierOk },
    // supplies: from the small airfield on (the dirt strip pump never runs dry)
    ...(ctrl.state.tier >= 2 ? [{ id: 'supplies', icon: 'fuel' as const, label: 'bar.supplies' as const, badge: ctrl.state.stores.fuel.out || ctrl.state.stores.parts.out || ctrl.state.stores.fuel.low || ctrl.state.stores.parts.low }] : []),
    { id: 'build', icon: 'build', label: 'bar.build' },
  ];

  /** Where the pointing hand goes for the current tutorial step (polled). */
  function updateTutorial() {
    const step = tutorialRef.current;
    const flightWith = (w: number) => ctrl.state.flights.find((f) => (f.wants & (1 << w)) !== 0);
    const atBubble = (w: number, text: TKey) => {
      const f = flightWith(w);
      if (!f) return setHand(null);
      const ind = indicators.current.find((i) => i.id === f.id);
      if (ind) return setHand({ x: ind.vx, y: ind.vy, text });
      const b = bubbleAnchor(f, cam.zoom);
      setHand({ x: (b.x - cam.x) * cam.zoom + cam.viewW / 2, y: (b.y - cam.y) * cam.zoom + cam.viewH / 2 - 10, text });
    };
    const atBar = (id: string, text: TKey) => {
      const p = barPos.current[id];
      setHand(p ? { x: p.x, y: p.y - 14, text } : null);
    };
    if (step <= 0) {
      // "show me" from the goal card: point at the button (or a plane) for a few seconds
      const sm = showMe.current;
      if (!sm || performance.now() > sm.until) {
        showMe.current = null;
        return setHand(null);
      }
      if (sm.target === 'flight') {
        const f = ctrl.state.flights.find((x) => x.want !== WANT.none);
        if (f) return atBubble(f.want, 'goal.tapBubble');
        // nothing to do right now: point at a plane and say when to tap
        const any = ctrl.state.flights[0];
        if (!any) return setHand(null);
        const b = bubbleAnchor(any, cam.zoom);
        return setHand({ x: (b.x - cam.x) * cam.zoom + cam.viewW / 2, y: (b.y - cam.y) * cam.zoom + cam.viewH / 2 - 10, text: 'goal.waitBubble' });
      }
      if (sm.target) return atBar(sm.target, 'goal.tapHere');
      return setHand(null);
    }
    if (step === 1) atBubble(WANT.clearLanding, 'tut.land');
    else if (step === 2) {
      const f = flightWith(WANT.bags) ?? flightWith(WANT.fuel);
      if (f) atBubble(f.want, 'tut.service');
      else setHand(null);
    } else if (step === 3) atBubble(WANT.board, 'tut.board');
    else if (step === 4) atBubble(WANT.clearTakeoff, 'tut.takeoff');
    else if (step === 5) atBar('upgrades', 'tut.upgrades');
    else if (step === 6) setHand(barPos.current.best ? { x: barPos.current.best.x, y: barPos.current.best.y - 10, text: 'tut.buy' } : null);
    else if (step === 7) atBar('staff', 'tut.staff');
  }

  // tutorial progress follows what you do
  useEffect(() => {
    if (tutorial === 5 && panel === 'upgrades') setTutorial(6);
    if (tutorial === 7 && panel === 'staff') setTutorial(0);
  }, [panel, tutorial, setTutorial]);
  const dir = useDir();
  const rtl = dir.rtl;


  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height, x, y } = e.nativeEvent.layout;
    offset.current = { x, y };
    setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const onCoinPos = useCallback(
    (x: number, y: number) => {
      fx.coinTarget = { x: x + 8, y: y + insets.top + 6 };
    },
    [fx, insets.top],
  );

  return (
    <View style={styles.root}>
      <View ref={mapRef as never} style={styles.fill} onLayout={onLayout} {...responder.panHandlers}>
        {size.w > 0 ? <SceneCanvas snap={snap} res={res} width={size.w} height={size.h} /> : null}
        {hud.storm ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.28)' }]} pointerEvents="none" testID="storm" /> : null}
        {hud.haze > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(226,232,240,${(hud.haze * 0.62).toFixed(2)})` }]} pointerEvents="none" testID="fog" /> : null}
      </View>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          onLayout={(e) => {
            safe.current.top = insets.top + 6 + e.nativeEvent.layout.height;
          }}
        >
          <Hud data={hud} onSettings={() => setSettings(true)} onHelp={() => setPanel('help')} onEvents={() => setPanel('events')} onRating={() => setPanel('rating')} onCareer={() => setPanel('career')} onDaily={() => setPanel('daily')} onCoinPos={onCoinPos} bump={bump} />
        </View>
        <View style={{ height: 8 }} />
        {/* with a side panel open, toasts move into the part of the map that is still visible */}
        <View style={sidePanel ? { [rtl ? 'marginLeft' : 'marginRight']: sideWidth(size.w) } : null}>
          <Toasts items={toasts.filter((x) => now - x.at < TOAST_MS)} now={now} />
        </View>
        {showFps ? (
          <View style={styles.fps} pointerEvents="none">
            <FpsMeter />
          </View>
        ) : null}
      </View>
      {goal && !card && !panel && !welcome && !settings ? (
        <View style={[styles.goal, { top: safe.current.top + 4 }, rtl ? { right: 10 + insets.right } : { left: 10 + insets.left }]} pointerEvents="box-none">
          <GoalCard
            goal={goal}
            open={now < goalOpen.current.until}
            onToggle={() => {
              goalOpen.current.until = now < goalOpen.current.until ? 0 : Infinity;
              setNow(performance.now());
            }}
            onHelp={() => setPanel('help')}
            onShow={() => {
              const g = currentGoal(ctrl.state);
              showMe.current = { target: g?.target ?? null, until: performance.now() + 5000 };
              updateTutorial();
            }}
          />
        </View>
      ) : null}
      {!card && !panel && !welcome && !settings && !guideNews && (inspectorOn || festView || dealView) ? (
        <View style={[styles.side, { top: safe.current.top + 4 }, rtl ? { left: 10 + insets.left, alignItems: 'flex-start' } : { right: 10 + insets.right, alignItems: 'flex-end' }]} pointerEvents="box-none">
          {inspectorOn ? (
            <Pressable
              onPress={() => setPanel('guide')}
              style={({ pressed }) => [styles.inspector, { flexDirection: dir.row, transform: [{ scale: pressed ? 0.96 : 1 + Math.sin(now / 240) * 0.03 }] }]}
              accessibilityRole="button"
              accessibilityLabel={t('hud.inspector')}
              testID="inspector-chip"
            >
              <Icon name="search" size={22} />
              <Text style={styles.inspectorText}>{t('hud.inspector')}</Text>
            </Pressable>
          ) : null}
          <FestivalCard fest={festView} deal={dealView} onBuy={() => ctrl.send({ type: 'buyDeal' })} />
        </View>
      ) : null}
      {panel === 'help' ? <HelpPanel tier={ctrl.state.tier} onClose={() => setPanel(null)} /> : null}
      {card ? (
        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 10 }, wide && styles.bottomWide, wide && (rtl ? { left: 10 } : { right: 10 })]}
          pointerEvents="box-none"
          onLayout={(e) => {
            safe.current.bottom = wide ? 0 : e.nativeEvent.layout.height;
          }}
        >
          <FlightCard v={card} onClose={() => setSelected(0)} onAction={(w) => act(card.id, w)} />
        </View>
      ) : null}
      {!card && !panel ? (
        <View
          style={[styles.bar, { paddingBottom: insets.bottom + (short ? 6 : 10) }, barRow && { flexDirection: dir.row, justifyContent: 'center', alignItems: 'flex-end' }]}
          pointerEvents="box-none"
          onLayout={(e) => {
            safe.current.bottom = e.nativeEvent.layout.height;
            barWrapY.current = e.nativeEvent.layout.y;
          }}
        >
          {offer ? (
            <Pressable
              onLayout={(e) => {
                const l = e.nativeEvent.layout;
                barPos.current.best = { x: l.x + l.width / 2, y: l.y + barWrapY.current };
              }}
              onPress={() => ctrl.send({ type: 'buyUpgrade', id: offer.id, count: 1 })}
              style={({ pressed }) => [styles.best, { flexDirection: dir.row }, barRow && styles.bestSide, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="button"
              accessibilityLabel={t('upgrades.bestNow')}
            >
              <Icon name="star" size={16} />
              <Text style={styles.bestText} numberOfLines={1}>
                {t('upgrades.bestNow')}: {t(`upg.${offer.id}` as TKey)}
              </Text>
              <View style={[styles.bestCost, { flexDirection: dir.row }]}>
                <Icon name="coin" size={14} />
                <Text style={styles.bestCostText}>{formatBig(offer.cost)}</Text>
              </View>
            </Pressable>
          ) : null}
          <BottomBar
            items={barItems}
            compact={short}
            maxWidth={barRow ? size.w - BEST_SIDE_W - 30 : undefined}
            onPress={(id) => setPanel(id)}
            onItemLayout={(id, x, y) => {
              barPos.current[id] = { x: x + barOrigin.current.x, y: y + barOrigin.current.y };
            }}
            onLayout={(x, y) => {
              barOrigin.current = { x, y: y + barWrapY.current };
            }}
          />
        </View>
      ) : null}
      {panel === 'airlines' ? <AirlinesPanel state={ctrl.state} rev={rev} send={(c) => ctrl.send(c)} onClose={() => setPanel(null)} initialTab={debug.tab} /> : null}
      {panel === 'board' ? (
        <FlightBoard
          state={ctrl.state}
          rev={rev}
          initialTab={debug.tab}
          onClose={() => setPanel(null)}
          onPick={(id) => {
            const f = ctrl.state.flights.find((x) => x.id === id);
            if (!f) return;
            setSelected(id);
            cam.target = { x: isoX(f.x, f.y), y: isoY(f.x, f.y, f.z) };
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'events' ? (
        <IncidentsPanel
          state={ctrl.state}
          rev={rev}
          send={(c) => ctrl.send(c)}
          onClose={() => setPanel(null)}
          onShow={(id) => {
            const f = ctrl.state.flights.find((x) => x.id === id);
            if (!f) return;
            setSelected(id);
            cam.target = { x: isoX(f.x, f.y), y: isoY(f.x, f.y, f.z) };
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'rating' || panel === 'reviews' || panel === 'guide' ? (
        <RatingPanel
          state={ctrl.state}
          rev={rev}
          send={(c) => ctrl.send(c)}
          initialTab={panel === 'reviews' ? 1 : panel === 'guide' ? 2 : 0}
          onClose={() => setPanel(null)}
          onShow={(id) => {
            const q = ctrl.state.people.find((x) => x.id === id);
            if (!q) return;
            cam.target = { x: isoX(q.x, q.y), y: isoY(q.x, q.y) };
            cam.zoom = Math.max(cam.zoom, 1.6);
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'daily' ? <DailyPanel state={ctrl.state} rev={rev} send={(c) => ctrl.send(c)} onClose={() => setPanel(null)} last={lastSpin} /> : null}
      {panel === 'career' || panel === 'achievements' ? <CareerPanel state={ctrl.state} rev={rev} send={(c) => ctrl.send(c)} initialTab={panel === 'achievements' ? 1 : 0} onClose={() => setPanel(null)} /> : null}
      {panel === 'supplies' ? <SupplyPanel state={ctrl.state} rev={rev} send={(c) => ctrl.send(c)} onClose={() => setPanel(null)} /> : null}
      {panel === 'airport' ? <TierPanel state={ctrl.state} rev={rev} onBuild={() => ctrl.send({ type: 'upgradeTier' })} onClose={() => setPanel(null)} /> : null}
      {buildMode ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <View style={[styles.buildBar, { flexDirection: dir.row }]}>
            <Icon name="build" size={22} />
            <Text style={styles.buildText} numberOfLines={2}>
              {decorItems(ctrl.state).length ? t('build.hint') : t('build.none')}
            </Text>
            <Pressable onPress={() => setPanel(null)} style={styles.buildDone} accessibilityRole="button" accessibilityLabel={t('build.done')}>
              <Text style={styles.buildDoneText}>{t('build.done')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {panel === 'upgrades' ? (
        <UpgradesPanel
          state={ctrl.state}
          rev={rev}
          initialCat={upgCat}
          onBuy={(id, count) => ctrl.send({ type: 'buyUpgrade', id, count })}
          onClose={() => {
            setPanel(null);
            setUpgCat('all');
          }}
        />
      ) : null}
      {welcome ? <WelcomeBack r={welcome} onClose={() => setWelcome(null)} /> : null}
      {guideNews && !welcome ? (
        <GuideCeremony
          news={guideNews}
          onClose={() => setGuideNews(null)}
          onSee={() => {
            setGuideNews(null);
            setPanel('guide');
          }}
        />
      ) : null}
      {rebuilding ? (
        <View style={styles.rebuild} pointerEvents="none">
          <Text style={styles.rebuildText}>{t('app.loading')}</Text>
        </View>
      ) : null}
      {hand && !welcome && !settings ? (
        <View style={[styles.hand, { left: hand.x - 110, top: hand.y + 14 + Math.sin(now / 160) * 6 }]} pointerEvents="none">
          <Icon name="hand" size={42} />
          <View style={styles.handBubble}>
            <Text style={styles.handText}>{t(hand.text)}</Text>
          </View>
        </View>
      ) : null}
      {tutorial > 0 && !welcome ? (
        <Pressable onPress={() => setTutorial(0)} style={[styles.skip, { top: safe.current.top + 6 }]} accessibilityRole="button" accessibilityLabel={t('tut.skip')}>
          <Text style={styles.skipText}>{t('tut.skip')}</Text>
        </Pressable>
      ) : null}
      {panel === 'staff' && staffView ? (
        <StaffPanel view={staffView} send={(c) => ctrl.send(c)} onClose={() => setPanel(null)} />
      ) : null}
      {settings ? (
        <SettingsPanel
          onClose={() => setSettings(false)}
          onGallery={() => {
            setSettings(false);
            onGallery();
          }}
        />
      ) : null}
    </View>
  );
}

/** Airline/aircraft liveries the tier needs in the atlas. */
/** Test switch: every stand, vehicle and the lounge of the tier built, its airlines signed and happy. */
function fullAirport(s: GameState): void {
  const L = layoutOf(s.tier);
  for (const st of L.stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
  if (s.tier >= 4) s.upg.lounge = 1;
  // air traffic control about as far as a player would have it by now
  s.upg.tower = Math.max(s.upg.tower ?? 0, s.tier - 1);
  s.upg.radar = Math.max(s.upg.radar ?? 0, Math.min(3, s.tier - 1));
  s.upg.ils = Math.max(s.upg.ils ?? 0, Math.min(3, s.tier - 2));
  // tanks and shelves sized for the tier, full
  for (const id of ['fuelFarm', 'partsStore']) {
    const def = upgradeDef(id);
    if (def) s.upg[id] = Math.max(s.upg[id] ?? 0, levelCap(def, s.tier));
  }
  s.upg.truck2 = Math.max(s.upg.truck2 ?? 0, Math.min(5, s.tier));
  s.upg.cart2 = Math.max(s.upg.cart2 ?? 0, Math.min(5, s.tier));
  s.upgRev++;
  applyStructural(s);
  for (const k of STORE_KINDS) if (storeActive(s, k)) s.stores[k].stock = capacity(s, k);
  s.stats.served = Math.max(s.stats.served, 400);
  // (from the mega hub on, the airlines that came with it first, so the screenshots show them)
  const order = AIRLINES.map((_, i) => i);
  if (s.tier >= 7) order.sort((a, b) => Number(AIRLINES[b].unlockTier >= 7) - Number(AIRLINES[a].unlockTier >= 7));
  order.forEach((i) => {
    if (s.contracts.length >= contractSlots(s)) return;
    if (airlineBlocker(s, i) || s.contracts.some((c) => c.al === i)) return;
    s.rep[i] = 90;
    const o = makeOffer(s, i);
    o.perDay = Math.min(o.perDay, 4);
    s.offers.push(o);
    signOffer(s, o.id);
  });
}

/** Sprites drawn again at a higher resolution per frame when zoomed in close, and how many pixels of them are kept. */
const VEC_PER_FRAME = 5;
const VEC_PIXELS = 12_000_000;
/** Messages: at most this many at once; good news at most one every NEWS_GAP ms; the same one not again within SAME_GAP ms. */
const MAX_TOASTS = 2;
/** A new goal's card stays open this long, then folds to its title (a tap opens it again). */
const GOAL_OPEN_MS = 8000;
const NEWS_GAP = 6000;
const SAME_GAP = 12000;
/** Pixels of the sharp ground layer kept for a close zoom. */
const CRISP_PIXELS = 14_000_000;

/** The toast icon for each kind of incident. */
const INCIDENT_ICON: Partial<Record<IncidentKind, Toast['icon']>> = {
  vip: 'star',
  airshow: 'plane',
  storm: 'cloud',
  medical: 'medic',
  celebrity: 'camera',
  historic: 'ticket',
  bag: 'bag',
  drone: 'drone',
  breach: 'shield',
};

/** Today on the player's device (an epoch day), or the given day of a holiday for screenshots. */
/** Where an upgrade shows on the map (its decoration, the tower, the radar), for the pop when it is bought. */
function upgradeSpot(s: GameState, id: string, tower: [number, number] | null): readonly [number, number] | null {
  if (id === 'kiosk' || id === 'billboard') return decorPos(s, id);
  if (id === 'benches') return decorPos(s, 'bench1');
  if (id === 'tower') return tower;
  if (id === 'radar') return layoutOf(s.tier).radar ?? null;
  return null;
}

function todayFor(hol: string | null, day: number): number {
  const d = new Date();
  const today = epochDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const h = HOLIDAYS.find((x) => x.id === hol);
  return h ? nextHoliday(h.id, today - 20) + day - 1 : today;
}

export function tierCombos(tier: number): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  AIRLINES.forEach((al, i) => {
    if (al.unlockTier > tier) return;
    for (const id of al.fleet) {
      const k = AIRCRAFT.findIndex((a) => a.id === id);
      if (k >= 0 && AIRCRAFT[k].unlockTier <= tier) out.push([i, k]);
    }
  });
  // the special visitors (a celebrity's jet, the historic plane) from the small airfield on
  if (tier >= 2) {
    const al = (id: string) => AIRLINES.findIndex((a) => a.id === id);
    const add = (a: number, k: number) => {
      if (a >= 0 && k >= 0 && (AIRCRAFT[k].unlockTier <= tier || k === aircraftIndex(VISITORS.historicPlane)) && !out.some(([x, y]) => x === a && y === k)) out.push([a, k]);
    };
    for (const id of VISITORS.celebPlanes) add(al(VISITORS.celebAirline), aircraftIndex(id));
    add(al(VISITORS.historicAirline), aircraftIndex(VISITORS.historicPlane));
  }
  return out;
}

/** Width of the best-value tip when it sits beside the bar (landscape). */
const BEST_SIDE_W = 270;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#86c06a' },
  rebuild: { position: 'absolute', alignSelf: 'center', top: '45%', backgroundColor: C.glassStrong, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, ...SHADOW_SM },
  rebuildText: { color: C.text, fontWeight: '800', fontSize: 15 },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10 },
  bottomWide: { left: undefined, right: undefined, width: 380, paddingHorizontal: 0 },
  fps: { position: 'absolute', left: 8, bottom: -26 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  best: { alignItems: 'center', gap: 6, backgroundColor: C.glassStrong, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 360, borderWidth: 1, borderColor: '#fde68a', ...SHADOW_SM },
  bestText: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  bestSide: { maxWidth: BEST_SIDE_W, marginBottom: 12 },
  bestCost: { alignItems: 'center', gap: 3, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  bestCostText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buildBar: { alignItems: 'center', gap: 10, backgroundColor: C.glassStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 440, ...SHADOW_SM },
  buildText: { color: C.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  buildDone: { backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  buildDoneText: { color: '#fff', fontWeight: '800' },
  hand: { position: 'absolute', alignItems: 'center', width: 220 },
  goal: { position: 'absolute' },
  side: { position: 'absolute', gap: 6 },
  inspector: { alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: '#6366f1', ...SHADOW_SM },
  inspectorText: { color: C.text, fontWeight: '800', fontSize: 13 },
  handBubble: { marginTop: 2, backgroundColor: C.text, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  handText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  skip: { position: 'absolute', right: 12, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
