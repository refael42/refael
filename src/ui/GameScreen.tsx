import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAND_MAP } from '../data/maps';
import { LINEUP } from '../data/scenes';
import { UPGRADES } from '../data/upgrades';
import { isRTL, useT } from '../i18n';
import type { BackgroundDef } from '../render/art/background';
import type { Camera } from '../render/draw/fx';
import { isoX, isoY } from '../render/iso';
import { SceneCanvas } from '../render/SceneCanvas';
import { useGame, useLineup, usePoll, type GameBoot } from '../render/useSimulation';
import { toSave } from '../sim/big';
import { canBuy } from '../sim/economy/upgrades';
import type { OfflineEarnings } from '../sim/offline';
import type { GameState } from '../sim/game/types';
import type { PropKind } from '../sim/types';
import { bootGame } from '../store/boot';
import { useSettings } from '../store/settings';
import { trace } from '../trace';
import { JuicyButton } from './JuicyButton';
import { Notices } from './Notices';
import { PerfOverlay } from './PerfOverlay';
import { StaffPanel, type StaffView } from './StaffPanel';
import { GearButton, SettingsPanel } from './SettingsPanel';
import { theme } from './theme';
import { UpgradePanel } from './UpgradePanel';
import { WelcomeBack } from './WelcomeBack';

const GAME_BG: BackgroundDef = { width: STAND_MAP.width, height: STAND_MAP.height, areas: STAND_MAP.areas, building: STAND_MAP.building, wallHeight: STAND_MAP.wallHeight, backdrop: STAND_MAP.backdrop };
const CAST_BG: BackgroundDef = { width: LINEUP.width, height: LINEUP.height, areas: LINEUP.areas };
const GAME_FOCUS = { x: 8.6, y: 6.4, zoom: 1 };
const CAST_FOCUS = { x: 7.6, y: 4.9, zoom: 1.7 };
const GAME_SEED = 20251005;

/** Name tags under the cast and props, so the owner can review each piece. */
function Labels({ camera }: { camera: Camera }) {
  const t = useT();
  const items = [
    ...LINEUP.cast.filter((m) => m.label).map((m) => ({ label: m.label!, x: m.x, y: m.y })),
    ...LINEUP.props.filter((p) => p.label).map((p) => ({ label: p.label!, x: p.x, y: p.y })),
  ];
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.tag, { left: camera.x + isoX(item.x, item.y) * camera.zoom - 50, top: camera.y + isoY(item.x, item.y) * camera.zoom + 10 }]}
        >
          <Text style={styles.tagText}>{t(item.label)}</Text>
        </View>
      ))}
    </View>
  );
}

function CornerButton({ label, count, onPress, color }: { label: string; count: number; onPress: () => void; color: 'green' | 'purple' }) {
  return (
    <View>
      <JuicyButton label={label} onPress={onPress} style={[styles.cornerButton, color === 'purple' && styles.staffButton]} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

/** What the corner buttons need, read twice a second. */
const readWallet = (s: GameState) => ({ coins: s.coins, levels: s.levels, waiting: s.applicants.filter((a) => a.state === 'waiting').length });

/** The live restaurant: scene, upgrade and staff panels, decisions, welcome-back screen. */
function GameRunner({ boot }: { boot: GameBoot }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showPerf, stress } = useSettings();
  // Frozen until the welcome-back money is collected, so nothing earned can slip away.
  const paused = useRef(boot.offline !== null);
  const [welcome, setWelcome] = useState<OfflineEarnings | null>(boot.offline);
  const { snapshot, stats, tap, command, gameRef } = useGame(STAND_MAP, GAME_SEED, stress, boot, paused);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const selected = useSharedValue(-1);
  const selectedId = useSharedValue(-1);
  const [panel, setPanel] = useState<{ station: PropKind | null } | null>(null);
  const [staff, setStaff] = useState<StaffView | null>(null);
  const wallet = usePoll(gameRef, readWallet, panel ? 6 : 2);
  const affordable = wallet ? UPGRADES.filter((u) => canBuy(u, wallet.levels, wallet.coins)).length : 0;
  const t = useT();
  // Everything handed to the canvas stays referentially stable: a new prop would rebuild its
  // touch handlers, and swapping them in the middle of a touch crashes on phones.
  const hud = useMemo(() => ({ left: insets.left + 12, top: insets.top + 10, right: width - insets.right - 12 }), [insets.left, insets.top, insets.right, width]);
  const panelOpen = useRef(false);
  panelOpen.current = panel !== null || staff !== null;

  const open = useCallback(
    (station: PropKind | null) => {
      selected.value = station ?? -1;
      selectedId.value = -1;
      setStaff(null);
      setPanel({ station });
    },
    [selected, selectedId],
  );
  const showStaff = useCallback(
    (view: StaffView) => {
      selected.value = -1;
      selectedId.value = 'person' in view ? view.person : -1;
      setPanel(null);
      setStaff(view);
    },
    [selected, selectedId],
  );
  const close = useCallback(() => {
    selected.value = -1;
    selectedId.value = -1;
    setPanel(null);
    setStaff(null);
  }, [selected, selectedId]);
  const onTap = useCallback(
    (x: number, y: number, cam: Camera) => {
      const hit = tap(x, y, cam);
      trace(`hit ${hit === null ? 'nothing' : typeof hit === 'string' ? hit : JSON.stringify(hit)}`);
      if (hit && hit !== 'action') {
        if ('station' in hit) open(hit.station);
        else showStaff({ person: hit.person });
      } else if (!hit && panelOpen.current) close();
    },
    [tap, open, showStaff, close],
  );
  const collect = (multiplier: number) => {
    if (welcome) command({ type: 'grant', coins: toSave(welcome.coins.mul(multiplier)) });
    paused.current = false;
    setWelcome(null);
  };

  return (
    <>
      <SceneCanvas snapshot={snapshot} background={GAME_BG} focus={GAME_FOCUS} hud={hud} uiFps={uiFps} buildMs={buildMs} onTap={onTap} selected={selected} selectedId={selectedId} />
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
      <Notices gameRef={gameRef} onCommand={command} />
      {!panel && !staff && (
        <View style={[styles.corner, styles.cornerRow, { bottom: insets.bottom + 10, end: insets.right + 10 }]}>
          <CornerButton label={t('ui.staff')} count={wallet?.waiting ?? 0} color="purple" onPress={() => showStaff({ tab: (wallet?.waiting ?? 0) > 0 ? 'applicants' : 'team' })} />
          <CornerButton label={t('ui.upgrades')} count={affordable} color="green" onPress={() => open(null)} />
        </View>
      )}
      {staff && <StaffPanel gameRef={gameRef} view={staff} onView={showStaff} onCommand={command} onClose={close} />}
      {panel && wallet && (
        <UpgradePanel
          wallet={wallet}
          station={panel.station}
          onBuy={(item) => command({ type: 'buy', item })}
          onShowAll={() => open(null)}
          onClose={close}
        />
      )}
      {welcome && <WelcomeBack earnings={welcome} onCollect={collect} />}
    </>
  );
}

/** Loads the save first (a fraction of a second), then starts the restaurant. */
function GameView() {
  const [boot, setBoot] = useState<GameBoot | null>(null);
  useEffect(() => {
    let alive = true;
    void bootGame(STAND_MAP).then((b) => {
      trace(`boot: ${b.save ? 'save loaded' : 'new game'}${b.offline ? ', welcome back' : ''}`);
      if (alive) setBoot(b);
    });
    return () => {
      alive = false;
    };
  }, []);
  return boot ? <GameRunner boot={boot} /> : null;
}

function CastView() {
  const { showPerf } = useSettings();
  const { snapshot, stats } = useLineup(LINEUP);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const [camera, setCamera] = useState<Camera | null>(null);
  return (
    <>
      <SceneCanvas snapshot={snapshot} background={CAST_BG} focus={CAST_FOCUS} uiFps={uiFps} buildMs={buildMs} onCamera={setCamera} />
      {camera && <Labels camera={camera} />}
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
    </>
  );
}

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { lang, view, gameEpoch } = useSettings();
  const [settings, setSettings] = useState(false);
  return (
    <View style={[styles.root, { direction: isRTL(lang) ? 'rtl' : 'ltr' }]}>
      {view === 'game' ? <GameView key={`game${gameEpoch}`} /> : <CastView key="cast" />}
      <View style={[styles.corner, { bottom: insets.bottom + 10, start: insets.left + 10 }]}>
        <GearButton onPress={() => setSettings(true)} />
      </View>
      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1022' },
  corner: { position: 'absolute' },
  cornerRow: { flexDirection: 'row', gap: 10 },
  cornerButton: { minHeight: 52, paddingHorizontal: 20, backgroundColor: '#35B957', borderColor: '#FFE08A', borderWidth: 2.5 },
  staffButton: { backgroundColor: '#6A2C8F', borderColor: '#E8C9FF' },
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 5,
    backgroundColor: '#E5483B',
    borderWidth: 2,
    borderColor: '#FFF4E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  passThrough: { pointerEvents: 'none' },
  tag: { position: 'absolute', width: 100, alignItems: 'center' },
  tagText: {
    backgroundColor: 'rgba(42,21,48,0.88)',
    color: theme.cream,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2B13C',
  },
});
