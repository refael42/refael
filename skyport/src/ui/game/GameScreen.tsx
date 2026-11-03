/** The airfield: canvas + camera + taps + HUD + flight card + toasts. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIRLINES } from '../../data/airlines';
import { useDir, useLang, useT, type TKey } from '../../i18n';
import { makeCamera, updateCamera, useCameraResponder, viewToWorld, type DragHandler } from '../../render/camera';
import { screenToWorld } from '../../render/iso';
import { tierDef } from '../../data/tiers';
import { useSettings as useSettingsStore } from '../../settings/store';
import { TierPanel } from './TierPanel';
import { bubbleAnchor, constructionSite, decorItems, drawGame, type Indicator } from '../../render/drawGame';
import { Effects } from '../../render/effects';
import { isoX, isoY, Z_PX } from '../../render/iso';
import { makeRenderRes, SnapWriter, type RenderRes } from '../../render/scene';
import { SceneCanvas } from '../../render/SceneCanvas';
import type { SpriteSet } from '../../render/sprites';
import { recordFrame, useFrameLoop } from '../../render/useFrameLoop';
import { buildWorld } from '../../render/world';
import { useSettings } from '../../settings/store';
import { AIRCRAFT, planeArt } from '../../data/aircraft';
import { RARITIES, STAFF_ROLES } from '../../data/staff';
import {
  applyOffline,
  applyStructural,
  counterCount,
  laneCount,
  switchTier,
  bestOffer,
  checkTier,
  decorPos,
  decorSpotOk,
  botAirlines,
  botBuys,
  canExpand,
  repOf,
  botCommands,
  botHires,
  clockText,
  formatBig,
  gameClock,
  layoutOf,
  MAX_PER_ROLE,
  REJECT,
  staffCount,
  wagesPerDay,
  WANT,
  type GameEvent,
  type GameState,
  type OfflineResult,
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
import { AirlinesPanel } from './AirlinesPanel';
import { FlightBoard } from './FlightBoard';
import { Hud, type HudData } from './Hud';
import { personName, StaffPanel, type StaffView } from './StaffPanel';
import { SettingsPanel } from './SettingsPanel';
import { TOAST_MS, Toasts, type Toast } from './Toasts';

const debug = readDebugParams();

function hudOf(c: GameController): HudData {
  const s = c.state;
  const clock = gameClock(s.time);
  return { money: formatBig(s.money), diamonds: String(s.diamonds), rating: Math.round(s.rating * 10) / 10, day: clock.day, time: clockText(s.time) };
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

export function GameScreen({ sprites, boot, onGallery }: { sprites: SpriteSet; boot: Boot; onGallery: () => void }) {
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
    return c;
  }, []);
  const [tier, setTier] = useState(ctrl.state.tier);
  const L = layoutOf(tier);
  const [standsBuilt, setStandsBuilt] = useState(ctrl.state.standsBuilt);
  const [stations, setStations] = useState(() => counterCount(ctrl.state) * 10 + laneCount(ctrl.state));
  const world = useMemo(() => buildWorld(L, sprites, tier, standsBuilt, Math.floor(stations / 10), stations % 10), [L, sprites, tier, standsBuilt, stations]);
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
  const [staffView, setStaffView] = useState<StaffView | null>(null);
  const [rev, setRev] = useState(0);
  const [upgCat, setUpgCat] = useState<'all' | 'terminal'>('all');
  const buildMode = panel === 'build';
  const dragRef = useRef<{ id: string; x: number; y: number; ok: boolean } | null>(null);
  const tutorial = useSettingsStore((x) => x.tutorial);
  const setTutorial = useSettingsStore((x) => x.setTutorial);
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;
  const [hand, setHand] = useState<{ x: number; y: number; text: TKey } | null>(null);
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
  const safe = useRef({ top: 90, bottom: 0 });
  const lastToastKey = useRef<Record<string, number>>({});

  useEffect(() => {
    res.value = makeRenderRes(sprites.atlas.image, sprites.atlas.rects, debug.noBg ? null : world.picture, debug.noBg ? [] : world.tiles);
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
    }
  }, [size, cam]);

  const toast = useCallback((icon: Toast['icon'], text: string, tone: Toast['tone'] = 'info', key?: string) => {
    const tnow = performance.now();
    if (key) {
      const last = lastToastKey.current[key] ?? -1e9;
      if (tnow - last < 2500) return;
      lastToastKey.current[key] = tnow;
    }
    setToasts((old) => [...old.filter((x) => tnow - x.at < TOAST_MS), { id: toastId.current++, icon, text, at: tnow, tone }].slice(-3));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (boot.futureSave) toast('warn', t('toast.saveFuture'), 'warn');
      else if (!boot.state) toast('land', t('toast.welcome'), 'good');
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
            if (e.kind === 'fuelQueued') toast('fuel', t('toast.truckBusy'), 'info', 'truck');
            if (e.kind === 'bagsQueued') toast('bag', t('toast.bagsBusy'), 'info', 'cart');
            break;
          }
          case 'boardingStart':
            if (tutorialRef.current === 3) setTutorial(4);
            break;
          case 'takeoffCleared':
            if (tutorialRef.current === 4) setTutorial(5);
            break;
          case 'upgraded':
            if (tutorialRef.current === 6) setTutorial(7);
            break;
          case 'landingRequest':
            toast('land', t('toast.landingRequest', { code: codeOf(e.a) }), 'info', 'land');
            break;
          case 'takeoffRequest':
            toast('takeoff', t('toast.takeoffRequest', { code: codeOf(e.a) }), 'info', 'takeoff');
            break;
          case 'diverted':
            toast('warn', t('toast.diverted', { code: codeOf(e.c) }), 'warn');
            break;
          case 'cmdRejected':
            if (e.a === REJECT.noStand) toast('warn', t('toast.noStand'), 'warn', 'noStand');
            else if (e.a === REJECT.notReady) toast('hourglass', t('toast.notReady'), 'info', 'notReady');
            else if (e.a === REJECT.noMoney) toast('coin', t('toast.noMoney'), 'warn', 'money');
            else if (e.a === REJECT.limit) toast('team', t('toast.limit'), 'info', 'limit');
            else if (e.a === REJECT.badSpot) toast('warn', t('toast.badSpot'), 'warn', 'spot');
            else if (e.a === REJECT.needs) toast('warn', t('toast.needs'), 'warn', 'needs');
            break;
          case 'hired': {
            const m = s.staff.find((x) => x.id === e.b);
            const role = STAFF_ROLES[e.a];
            if (m && role) toast('team', t('toast.hired', { name: personName(m, lang), role: t(`role.${role.id}` as TKey) }), 'good');
            break;
          }
          case 'wagesPaid':
            toast('coin', t('toast.wages', { amount: formatBig(e.a) }), 'info');
            break;
          case 'applicantArrived': {
            const R = RARITIES[e.b];
            if (R && e.b >= 1) toast('team', t('toast.applicant', { rarity: t(`rarity.${R.id}` as TKey), role: t(`role.${STAFF_ROLES[e.a]?.id ?? 'atc'}` as TKey) }), 'good');
            break;
          }
          case 'negotiated':
            toast('team', e.a === 1 ? t('toast.negotiateOk') : t('toast.negotiateNo'), e.a === 1 ? 'good' : 'warn');
            break;
          case 'levelUp': {
            const m = s.staff.find((x) => x.id === e.c);
            if (m) toast('star', t('toast.levelUp', { name: personName(m, lang), n: e.a }), 'good');
            break;
          }
          case 'raiseRequest': {
            const m = s.staff.find((x) => x.id === e.c);
            if (m) toast('coin', t('toast.raise', { name: personName(m, lang) }), 'info');
            break;
          }
          case 'quit':
          case 'fired': {
            const name = lastNames.current.get(e.c);
            if (name) toast('warn', t(e.kind === 'quit' ? 'toast.quit' : 'toast.fired', { name }), 'warn');
            break;
          }
          case 'trialEnded':
            toast('clock', t('toast.trialEnded'), 'info');
            break;
          case 'checkedIn':
            fx.bag();
            break;
          case 'sale':
            fx.sale(isoX(e.x, e.y), isoY(e.x, e.y) - 14, e.a, e.b);
            break;
          case 'lostBag':
            toast('bag', t('toast.lostBag'), 'warn', 'lostBag');
            break;
          case 'offerArrived':
            toast('tail', t('toast.offer', { name: AIRLINES[e.a]?.name ?? '' }), 'good');
            break;
          case 'contractSigned':
            toast('handshake', t('toast.signed', { name: AIRLINES[e.a]?.name ?? '' }), 'good');
            break;
          case 'offerResult': {
            const name = AIRLINES[e.a]?.name ?? '';
            if (e.b === 1) toast('tail', t('toast.offerDiscount', { name }), 'info');
            else toast('tail', e.c === 1 ? t('toast.offerMore', { name }) : t('toast.offerNo', { name }), e.c === 1 ? 'good' : 'warn');
            break;
          }
          case 'airlineWarning': {
            const name = AIRLINES[e.a]?.name ?? '';
            toast('warn', e.b === 1 ? t('toast.airlineCut', { name, n: e.c }) : t('toast.airlineWarning', { name }), 'warn');
            break;
          }
          case 'airlineHappy':
            toast('tail', t('toast.airlineHappy', { name: AIRLINES[e.a]?.name ?? '' }), 'good');
            break;
          case 'airlineLeft':
            toast('warn', t('toast.airlineLeft', { name: AIRLINES[e.a]?.name ?? '' }), 'warn');
            break;
          case 'contractExpanded':
            toast('up', t('toast.expanded', { name: AIRLINES[e.a]?.name ?? '', n: e.b }), 'good');
            break;
          case 'contractEnded': {
            const name = AIRLINES[e.a]?.name ?? '';
            if (e.c === 2) toast('tail', t('toast.contractEnded', { name }), 'info');
            else if (e.b > 0) toast('coin', t('toast.seasonBonus', { name, amount: formatBig(e.b) }), 'good');
            else toast('tail', t('toast.seasonEnd', { name }), 'info');
            break;
          }
          case 'oops':
            toast('bag', t('toast.oops'), 'warn', 'oops');
            break;
          case 'tierBuildStart':
            toast('build', t('toast.tierBuild', { tier: t(`tier.${tierDef(e.a).key}` as TKey) }), 'good');
            break;
          case 'tierUp': {
            toast('star', t('toast.tierUp', { tier: t(`tier.${tierDef(e.a).key}` as TKey) }), 'good');
            const NL = layoutOf(e.a);
            for (const st of NL.stands) fx.sparkle(isoX(st.pos[0], st.pos[1]), isoY(st.pos[0], st.pos[1]) - 20);
            fx.sparkle(isoX(NL.hut[0] + 1, NL.hut[1] + 0.7), isoY(NL.hut[0] + 1, NL.hut[1] + 0.7) - 40);
            break;
          }
          case 'milestone':
            toast('star', t('toast.milestone'), 'good');
            break;
          case 'buildStart':
            toast('wrench', t('toast.buildStart'), 'info');
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
      setHud((old) => (old.money === h.money && old.diamonds === h.diamonds && old.rating === h.rating && old.day === h.day && old.time === h.time ? old : h));
      const sel = selectedRef.current;
      const f = sel ? ctrl.state.flights.find((x) => x.id === sel) : undefined;
      const v = f ? viewOf(f, repOf(ctrl.state, f.airline)) : null;
      if (sel && !f) setSelected(0);
      setCard((old) => (sameView(old, v) ? old : v));
      setNow(performance.now());
      const st = ctrl.state;
      setStandsBuilt((old) => (old === st.standsBuilt ? old : st.standsBuilt));
      setTier((old) => (old === st.tier ? old : st.tier));
      const sig = counterCount(st) * 10 + laneCount(st);
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
      setSelected(ctrl.state.flights[0].id);
    }
    cam.viewW = size.w;
    cam.viewH = size.h;
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
    snap.value = writer.finish();
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
    };
    return () => {
      delete w.__skyport;
    };
  }, [cam, ctrl]);
  const wide = size.w > size.h * 1.25;
  const canHire =
    !!staffView &&
    (staffView.staff.some((m) => m.raise > 0 || m.trialUntil === 1 || m.points > 0) ||
      staffView.applicants.some((a) => staffView.money >= a.cost && staffCount(ctrl.state, a.role) < MAX_PER_ROLE && staffCount(ctrl.state, a.role) === 0));
  const offer = rev >= 0 ? bestOffer(ctrl.state, true) : null;
  const tierOk = rev >= 0 && checkTier(ctrl.state).ok;
  const airlineNews = rev >= 0 && (ctrl.state.offers.length > 0 || ctrl.state.contracts.some((c) => c.warned || canExpand(ctrl.state, c)));
  const barItems: BarItem[] = [
    { id: 'upgrades', icon: 'wrench', label: 'bar.upgrades', badge: !!offer },
    { id: 'staff', icon: 'team', label: 'bar.staff', badge: canHire },
    { id: 'airlines', icon: 'tail', label: 'bar.airlines', badge: airlineNews },
    { id: 'board', icon: 'board', label: 'bar.board' },
    { id: 'airport', icon: 'plane', label: 'bar.airport', badge: tierOk },
    { id: 'build', icon: 'build', label: 'bar.build' },
  ];

  /** Where the pointing hand goes for the current tutorial step (polled). */
  function updateTutorial() {
    const step = tutorialRef.current;
    if (step <= 0) return setHand(null);
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
      <View style={styles.fill} onLayout={onLayout} {...responder.panHandlers}>
        {size.w > 0 ? <SceneCanvas snap={snap} res={res} width={size.w} height={size.h} /> : null}
      </View>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          onLayout={(e) => {
            safe.current.top = insets.top + 6 + e.nativeEvent.layout.height;
          }}
        >
          <Hud data={hud} onSettings={() => setSettings(true)} onCoinPos={onCoinPos} bump={bump} />
        </View>
        <View style={{ height: 8 }} />
        <Toasts items={toasts.filter((x) => now - x.at < TOAST_MS)} now={now} />
        {showFps ? (
          <View style={styles.fps} pointerEvents="none">
            <FpsMeter />
          </View>
        ) : null}
      </View>
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
          style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}
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
              style={({ pressed }) => [styles.best, { flexDirection: dir.row }, pressed && { transform: [{ scale: 0.97 }] }]}
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
export function tierCombos(tier: number): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  AIRLINES.forEach((al, i) => {
    if (al.unlockTier > tier) return;
    for (const id of al.fleet) {
      const k = AIRCRAFT.findIndex((a) => a.id === id);
      if (k >= 0 && AIRCRAFT[k].unlockTier <= tier && AIRCRAFT[k].stand === 'small') out.push([i, k]);
    }
  });
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#86c06a' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10 },
  bottomWide: { left: undefined, right: undefined, width: 380, paddingHorizontal: 0 },
  fps: { position: 'absolute', left: 8, bottom: -26 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  best: { alignItems: 'center', gap: 6, backgroundColor: C.glassStrong, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 360, borderWidth: 1, borderColor: '#fde68a', ...SHADOW_SM },
  bestText: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  bestCost: { alignItems: 'center', gap: 3, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  bestCostText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buildBar: { alignItems: 'center', gap: 10, backgroundColor: C.glassStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 440, ...SHADOW_SM },
  buildText: { color: C.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  buildDone: { backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  buildDoneText: { color: '#fff', fontWeight: '800' },
  hand: { position: 'absolute', alignItems: 'center', width: 220 },
  handBubble: { marginTop: 2, backgroundColor: C.text, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  handText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  skip: { position: 'absolute', right: 12, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
