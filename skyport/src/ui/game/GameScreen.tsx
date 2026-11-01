/** The airfield: canvas + camera + taps + HUD + flight card + toasts. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIRLINES } from '../../data/airlines';
import { useDir, useLang, useT, type TKey } from '../../i18n';
import { makeCamera, updateCamera, useCameraResponder, viewToWorld } from '../../render/camera';
import { bubbleAnchor, drawGame, type Indicator } from '../../render/drawGame';
import { Effects } from '../../render/effects';
import { isoX, isoY, Z_PX } from '../../render/iso';
import { makeRenderRes, SnapWriter, type RenderRes } from '../../render/scene';
import { SceneCanvas } from '../../render/SceneCanvas';
import type { SpriteSet } from '../../render/sprites';
import { recordFrame, useFrameLoop } from '../../render/useFrameLoop';
import { buildWorld } from '../../render/world';
import { useSettings } from '../../settings/store';
import { AIRCRAFT, planeArt } from '../../data/aircraft';
import { STAFF_ROLES } from '../../data/staff';
import { botCommands, botHires, clockText, formatBig, gameClock, layoutOf, MAX_PER_ROLE, REJECT, staffCount, wagesPerDay, WANT, type GameEvent } from '../../sim';
import { FpsMeter } from '../FpsMeter';
import { GameController } from './controller';
import { readDebugParams } from './debugParams';
import { FlightCard } from './FlightCard';
import { flightCode, sameView, viewOf, WANT_ACTION, type FlightView } from './flightInfo';
import { BottomBar, type BarItem } from './BottomBar';
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

export function GameScreen({ sprites, onGallery }: { sprites: SpriteSet; onGallery: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const showFps = useSettings((s) => s.showFps);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const snap = useSharedValue<Float32Array>(new Float32Array(0));
  const res = useSharedValue<RenderRes | null>(null);
  const offset = useRef({ x: 0, y: 0 });

  const ctrl = useMemo(() => {
    const c = new GameController(debug.seed ?? 20261101);
    c.speed = debug.speed;
    if (debug.stands > 0) c.state.standsBuilt = Math.min(debug.stands, c.state.stands.length);
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
        if (debug.auto && i % 3 === 0) for (const cmd of [...botCommands(c.state, { reaction: 1 }), ...botHires(c.state)]) c.send(cmd);
        c.tick(1000 / 30);
      }
      c.takeEvents();
    }
    return c;
  }, []);
  const L = layoutOf(ctrl.state.tier);
  const [standsBuilt, setStandsBuilt] = useState(ctrl.state.standsBuilt);
  const world = useMemo(() => buildWorld(L, sprites, ctrl.state.tier, standsBuilt), [L, sprites, ctrl, standsBuilt]);
  const cam = useMemo(() => {
    const c = makeCamera(isoX(L.camera.center[0], L.camera.center[1]), isoY(L.camera.center[0], L.camera.center[1]), L.camera.zoom);
    c.minZoom = 0.32;
    c.maxZoom = 2.2;
    c.bounds = world.bounds;
    return c;
  }, [L, world]);
  const writer = useMemo(() => new SnapWriter(), []);
  const fx = useMemo(() => new Effects(), []);

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
  const lang = useLang();
  const [bump, setBump] = useState(0);
  const toastId = useRef(1);
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
    const id = setTimeout(() => toast('land', t('toast.welcome'), 'good'), 600);
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
            break;
          case 'fuelQueued':
            toast('fuel', t('toast.truckBusy'), 'info', 'truck');
            break;
          case 'bagsQueued':
            toast('bag', t('toast.bagsBusy'), 'info', 'cart');
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
    [ctrl, fx, t, toast, lang],
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
      const v = f ? viewOf(f) : null;
      if (sel && !f) setSelected(0);
      setCard((old) => (sameView(old, v) ? old : v));
      setNow(performance.now());
      const st = ctrl.state;
      setStandsBuilt((old) => (old === st.standsBuilt ? old : st.standsBuilt));
      const sv: StaffView = { money: st.money.toNumber(), staff: st.staff.slice(), applicants: st.applicants.slice(), wages: wagesPerDay(st) };
      setStaffView((old) =>
        old && old.money === sv.money && old.staff.length === sv.staff.length && old.applicants.map((a) => a.id).join() === sv.applicants.map((a) => a.id).join() ? old : sv,
      );
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
      { selected: selectedRef.current, alpha, time: performance.now() / 1000, safeTop: safe.current.top, safeBottom: safe.current.bottom },
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

  const responder = useCameraResponder(cam, onTap, offset);

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
      stats: () => ({ served: ctrl.state.stats.served, money: ctrl.state.money.toNumber(), time: ctrl.state.time }),
      selected: () => selectedRef.current,
    };
    return () => {
      delete w.__skyport;
    };
  }, [cam, ctrl]);
  const wide = size.w > size.h * 1.25;
  const canHire =
    !!staffView &&
    staffView.applicants.some((a) => staffView.money >= a.cost && staffCount(ctrl.state, a.role) < MAX_PER_ROLE && staffCount(ctrl.state, a.role) === 0);
  const barItems: BarItem[] = [{ id: 'staff', icon: 'team', label: 'bar.staff', badge: canHire }];
  const rtl = useDir().rtl;


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
          }}
        >
          <BottomBar items={barItems} onPress={(id) => setPanel(id)} />
        </View>
      ) : null}
      {panel === 'staff' && staffView ? (
        <StaffPanel view={staffView} onHire={(id) => ctrl.send({ type: 'hire', applicantId: id })} onClose={() => setPanel(null)} />
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
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10 },
});
