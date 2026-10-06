import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TIERS } from '../data/buildings';
import { DECOR } from '../data/decor';
import { mapForTier, STAND_MAP, type Point } from '../data/maps';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { LINEUP } from '../data/scenes';
import { RANK, UPGRADES } from '../data/upgrades';
import { isRTL, useT } from '../i18n';
import { mapBackground, type BackgroundDef } from '../render/art/background';
import type { Camera } from '../render/draw/fx';
import { floorAt, isoX, isoY } from '../render/iso';
import type { BuildOverlay } from '../render/draw/drawScene';
import { SceneCanvas, type HudFeed } from '../render/SceneCanvas';
import { useGame, useLineup, usePoll, type GameBoot } from '../render/useSimulation';
import { TEST_MONEY } from '../data/economy';
import { big, toSave } from '../sim/big';
import { levelOf, restaurantLevel, upgradeDef } from '../sim/economy/upgrades';
import { crewCount } from '../sim/economy/works';
import { buildableTiles } from '../sim/game/build';
import type { OfflineEarnings } from '../sim/offline';
import type { GameState, PlacedDecor } from '../sim/game/types';
import type { PropKind } from '../sim/types';
import { bootGame } from '../store/boot';
import { markReady } from '../store/launch';
import { useSettings } from '../store/settings';
import { trace } from '../trace';
import { JuicyButton } from './JuicyButton';
import { Notices } from './Notices';
import { PerfOverlay } from './PerfOverlay';
import { StaffPanel, type StaffView } from './StaffPanel';
import { GearButton, SettingsPanel } from './SettingsPanel';
import { Hud } from './Hud';
import { BUILD_ITEMS, BuildPanel } from './BuildPanel';
import { theme } from './theme';
import { ConstructionNote, TierBanner } from './TierBanner';
import { HowToPlay } from './HowToPlay';
import { ReviewToast } from './ReviewToast';
import { RushButton } from './RushButton';
import { LevelBanner, QuestButton, QuestPanel } from './Quests';
import { GemPill, Shop } from './Shop';
import { HUD } from '../render/draw/hud';
import { Tutorial } from './Tutorial';
import { Welcome } from './Welcome';
import { canBuyNow, UpgradePanel } from './UpgradePanel';
import { WelcomeBack } from './WelcomeBack';
import { WorksTray } from './WorksTray';
import { useGameSounds } from '../audio/useGameSounds';
import { buzz } from '../audio/sound';

const CAST_BG: BackgroundDef = { width: LINEUP.width, height: LINEUP.height, areas: LINEUP.areas };
const CAST_FOCUS = { x: 7.6, y: 4.9, zoom: 1.7 };
const GAME_SEED = 20251005;
/** Build mode: a tap this close (tiles) to a free tile picks it. */
const SNAP_TILES = 1.3;
/** Build mode: a placed piece is picked within this many px (at zoom 1) of its middle, this high up. */
const PICK_PX = 34;
const PICK_HEIGHT = 30;

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

function CornerButton({ label, count, onPress, color, ref }: { label: string; count: number; onPress: () => void; color: 'green' | 'purple' | 'orange'; ref?: Ref<View> }) {
  return (
    <View ref={ref}>
      <JuicyButton label={label} onPress={onPress} style={[styles.cornerButton, color === 'purple' && styles.staffButton, color === 'orange' && styles.buildButton]} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

/** The restaurant's quest stage and its level (a banner celebrates each new one). */
const readQuestLevel = (s: GameState) => s.quests.level;
const readRank = (s: GameState) => restaurantLevel(s.levels);

/** The building on screen, and the tier going up on the lot next door (-1 = none). */
const readTier = (s: GameState) => s.map.tier;
const readConstruction = (s: GameState) => s.construction?.tier ?? -1;

/** What the corner buttons show: counts only, so the screen re-renders when one changes. */
const readCorner = (s: GameState) => {
  const w = readWallet(s);
  return {
    affordable: UPGRADES.filter((u) => !u.build && canBuyNow(u, w)).length,
    buildable: BUILD_ITEMS.filter((id) => canBuyNow(upgradeDef(id), w)).length,
    waiting: w.waiting,
  };
};

/** What the upgrade and build panels need (read only while one is open). */
const readWallet = (s: GameState) => ({
  coins: s.coins,
  levels: s.levels,
  map: s.map,
  waiting: s.applicants.filter((a) => a.state === 'waiting').length,
  gems: s.gems,
  crews: { works: s.works.map((w) => ({ id: w.id, item: w.item, total: w.total, left: w.left })), crews: crewCount(s.perks) },
});

/** The live restaurant: scene, upgrade and staff panels, decisions, welcome-back screen. */
function GameRunner({ boot }: { boot: GameBoot }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showPerf, stress, loaded, profile, tutorial, setProfile, setTutorial, moneyTaps } = useSettings();
  const [welcome, setWelcome] = useState<OfflineEarnings | null>(boot.offline);
  // First run: welcome, names and how to play come before anything happens.
  const onboarding = !loaded || profile === null;
  // Frozen during the first-run screens, and until the welcome-back money is collected so
  // nothing earned can slip away.
  const paused = useRef(true);
  paused.current = onboarding || welcome !== null;
  const { snapshot, stats, tap, command, gameRef } = useGame(STAND_MAP, GAME_SEED, stress, boot, paused);
  useGameSounds(gameRef, paused);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const selected = useSharedValue<number[]>([]);
  const selectedId = useSharedValue(-1);
  const hudFeed = useSharedValue<HudFeed>({ pending: 0, coinLands: 0, starLands: 0 });
  const [panel, setPanel] = useState<{ station: PropKind | null } | null>(null);
  const [staff, setStaff] = useState<StaffView | null>(null);
  const corner = usePoll(gameRef, readCorner, 2);
  const affordable = corner?.affordable ?? 0;
  const buildable = corner?.buildable ?? 0;
  const bulk = useSettings((s) => s.bulk);
  const t = useT();
  // Everything handed to the canvas stays referentially stable: a new prop would rebuild its
  // touch handlers, and swapping them in the middle of a touch crashes on phones.
  const hud = useMemo(() => ({ left: insets.left + 12, top: insets.top + 10, right: width - insets.right - 12 }), [insets.left, insets.top, insets.right, width]);
  // Testing: each tap on "test money" in the settings rains coins (x1000, at least a million).
  const moneySeen = useRef(moneyTaps);
  useEffect(() => {
    const game = gameRef.current;
    if (moneyTaps === moneySeen.current || !game) return;
    moneySeen.current = moneyTaps;
    const gift = big(TEST_MONEY.min).max(game.coins.mul(TEST_MONEY.times));
    command({ type: 'grant', coins: toSave(gift) });
  }, [moneyTaps, gameRef, command]);
  // The tutorial's glove needs the camera and where the corner buttons are.
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const onCamera = useCallback((cam: Camera) => {
    camera.current = cam;
  }, []);
  const upgradesButton = useRef<View>(null);
  const staffButton = useRef<View>(null);
  const tutorialButtons = useMemo(() => ({ upgrades: upgradesButton, staff: staffButton }), []);
  const panelOpen = useRef(false);
  panelOpen.current = panel !== null || staff !== null;

  // Build mode: what is picked, which tile, and the free tiles shown on the floor.
  // `moving`: a placed piece picked up to go on another tile.
  const [build, setBuild] = useState<{ item: string | null; tile: Point | null; moving?: Point } | null>(null);
  // Coins change all the time: the full wallet is read often only while a panel shows it.
  const wallet = usePoll(gameRef, readWallet, panel || build ? 6 : 0.1);
  const buildRef = useRef(build);
  buildRef.current = build;
  const overlay = useSharedValue<BuildOverlay | null>(null);
  const freeTiles = useRef<Point[]>([]);
  const [freeCount, setFreeCount] = useState(0);
  useEffect(() => {
    if (!build) {
      overlay.value = null;
      return;
    }
    const decor = DECOR.find((d) => build.item === `place_${d.id}`);
    // Free tiles only change when something is built: they are worked out again only then
    // (on a big map that takes a moment, felt as a hitch if done every second).
    let seen = '';
    const refresh = () => {
      const game = gameRef.current;
      const now = game ? `${game.map.tier}:${game.placed.length}:${game.tables.length}:${game.works.length}:${game.placed.map((p) => p.x * 100 + p.y).join(',')}` : '';
      if (now !== seen || !game) {
        seen = now;
        freeTiles.current = game ? buildableTiles(game) : [];
      }
      setFreeCount(freeTiles.current.length);
      overlay.value = {
        tiles: decor || build.moving ? freeTiles.current.flatMap((p) => [p.x, p.y]) : [],
        pick: decor && build.tile ? [build.tile.x, build.tile.y, decor.kind] : [],
        from: build.moving ? [build.moving.x, build.moving.y] : [],
      };
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [build, gameRef, overlay]);
  const placeBuild = () => {
    const b = buildRef.current;
    if (!b?.item) return;
    command(b.item === 'tables' ? { type: 'buy', item: 'tables' } : { type: 'buy', item: b.item, ...(b.tile ? { at: b.tile } : {}) });
    setBuild({ item: b.item, tile: null });
  };

  // The building: its background, where the camera looks (the building site while the
  // scaffolding is up), and a celebration when the bigger place opens.
  const tier = usePoll(gameRef, readTier, 4) ?? (boot.save ? levelOf(boot.save.levels, 'building') : 0);
  const building = usePoll(gameRef, readConstruction, 4) ?? -1;
  const background = useMemo(() => mapBackground(mapForTier(tier)), [tier]);
  const focus = useMemo(() => {
    if (building < 0) return TIERS[tier]!.focus;
    const from = mapForTier(tier).building.x1;
    return { x: (from + mapForTier(building).building.x1) / 2, y: 7, zoom: 0.9 };
  }, [tier, building]);
  const [quests, setQuests] = useState(false);
  const [shop, setShop] = useState(false);
  const questLevel = usePoll(gameRef, readQuestLevel, 2);
  const [levelBanner, setLevelBanner] = useState<number | null>(null);
  const shownLevel = useRef<number | null>(null);
  useEffect(() => {
    if (questLevel === null) return;
    if (shownLevel.current !== null && questLevel > shownLevel.current) setLevelBanner(questLevel);
    shownLevel.current = questLevel;
  }, [questLevel]);
  const endLevelBanner = useCallback(() => setLevelBanner(null), []);
  const rank = usePoll(gameRef, readRank, 2);
  const [rankBanner, setRankBanner] = useState<number | null>(null);
  const shownRank = useRef<number | null>(null);
  useEffect(() => {
    if (rank === null) return;
    if (shownRank.current !== null && rank > shownRank.current) setRankBanner(rank);
    shownRank.current = rank;
  }, [rank]);
  const endRankBanner = useCallback(() => setRankBanner(null), []);
  const [banner, setBanner] = useState<number | null>(null);
  const shownTier = useRef(tier);
  useEffect(() => {
    if (tier > shownTier.current) setBanner(tier);
    shownTier.current = tier;
  }, [tier]);
  const endBanner = useCallback(() => setBanner(null), []);

  const open = useCallback(
    (station: PropKind | null, at?: { x: number; y: number }) => {
      // Only the piece that was tapped glows (opened from the button: none).
      selected.value = station !== null && at ? [station, at.x, at.y] : [];
      selectedId.value = -1;
      setStaff(null);
      setPanel({ station });
    },
    [selected, selectedId],
  );
  const showStaff = useCallback(
    (view: StaffView) => {
      selected.value = [];
      selectedId.value = 'person' in view ? view.person : -1;
      setPanel(null);
      setStaff(view);
    },
    [selected, selectedId],
  );
  const close = useCallback(() => {
    selected.value = [];
    selectedId.value = -1;
    setPanel(null);
    setStaff(null);
  }, [selected, selectedId]);
  // Building work starts: get the menus out of the way of the show.
  useEffect(() => {
    if (building >= 0) {
      close();
      setBuild(null);
    }
  }, [building, close]);
  const onTap = useCallback(
    (x: number, y: number, cam: Camera) => {
      camera.current = cam;
      const b = buildRef.current;
      if (b) {
        // In build mode a tap picks the free tile nearest the finger (a near miss still counts),
        // or picks up a piece that is already placed so it can go somewhere else.
        const p = floorAt(x, y, cam.x, cam.y, cam.zoom);
        let tile: Point | null = null;
        let best = SNAP_TILES;
        for (const f of freeTiles.current) {
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          if (d < best) {
            best = d;
            tile = f;
          }
        }
        const game = gameRef.current;
        // A piece is picked by what you see: its body stands up from its tile.
        let piece: PlacedDecor | undefined;
        let near = PICK_PX * cam.zoom;
        for (const d of game?.placed ?? []) {
          const dist = Math.hypot(cam.x + isoX(d.x, d.y) * cam.zoom - x, cam.y + isoY(d.x, d.y, PICK_HEIGHT) * cam.zoom - y);
          if (dist < near) {
            near = dist;
            piece = d;
          }
        }
        if (b.moving) {
          if (piece && !tile) setBuild({ item: null, tile: null, moving: { x: piece.x, y: piece.y } });
          else if (tile) {
            command({ type: 'move', from: b.moving, to: tile });
            setBuild({ item: null, tile: null });
          }
        } else if (piece) setBuild({ item: null, tile: null, moving: { x: piece.x, y: piece.y } });
        else if (tile && b.item && b.item !== 'tables') setBuild({ item: b.item, tile });
        return;
      }
      const hit = tap(x, y, cam);
      // Serving, seating, cleaning: a small tick in the hand.
      if (hit === 'action') buzz('tap');
      trace(`hit ${hit === null ? 'nothing' : typeof hit === 'string' ? hit : JSON.stringify(hit)}`);
      if (hit && hit !== 'action') {
        if ('station' in hit) open(hit.station, hit);
        else showStaff({ person: hit.person });
      } else if (!hit && panelOpen.current) close();
    },
    [tap, open, showStaff, close],
  );
  const collect = (multiplier: number) => {
    if (welcome) command({ type: 'grant', coins: toSave(welcome.coins.mul(multiplier)) });
    setWelcome(null);
  };

  return (
    <>
      <SceneCanvas snapshot={snapshot} background={background} focus={focus} hud={hud} uiFps={uiFps} buildMs={buildMs} onTap={onTap} selected={selected} selectedId={selectedId} build={overlay} hudFeed={hudFeed} onReady={markReady} onCamera={onCamera} />
      <Hud gameRef={gameRef} feed={hudFeed} layout={hud} />
      {!onboarding && <GemPill gameRef={gameRef} onPress={() => setShop(true)} style={{ left: hud.left + 6, top: hud.top + HUD.height + 8 }} />}
      {!onboarding && !build && <WorksTray gameRef={gameRef} onCommand={command} style={{ left: hud.left + 6, top: hud.top + HUD.height + 104 }} />}
      <ReviewToast gameRef={gameRef} layout={hud} lowered={!onboarding && tutorial < TUTORIAL_STEPS.length} />
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
      <Notices gameRef={gameRef} onCommand={command} />
      {!panel && !staff && !build && (
        <View style={[styles.corner, styles.cornerRow, { bottom: insets.bottom + 10, end: insets.right + 10 }]}>
          <CornerButton label={t('ui.build')} count={buildable} color="orange" onPress={() => setBuild({ item: null, tile: null })} />
          <CornerButton ref={staffButton} label={t('ui.staff')} count={corner?.waiting ?? 0} color="purple" onPress={() => showStaff({ tab: (corner?.waiting ?? 0) > 0 ? 'applicants' : 'team' })} />
          <CornerButton ref={upgradesButton} label={t('ui.upgrades')} count={affordable} color="green" onPress={() => open(null)} />
        </View>
      )}
      {!panel && !staff && !build && !quests && !onboarding && tutorial >= TUTORIAL_STEPS.length && building < 0 && (
        <>
          <QuestButton gameRef={gameRef} onPress={() => setQuests(true)} style={{ bottom: insets.bottom + 8, start: insets.left + 68 }} />
          <RushButton gameRef={gameRef} onCommand={command} style={{ bottom: insets.bottom + 5, start: insets.left + 130 }} />
        </>
      )}
      {quests && <QuestPanel gameRef={gameRef} onCommand={command} onClose={() => setQuests(false)} />}
      {shop && <Shop gameRef={gameRef} onCommand={command} onClose={() => setShop(false)} />}
      {staff && <StaffPanel gameRef={gameRef} view={staff} onView={showStaff} onCommand={command} onClose={close} />}
      {panel && wallet && (
        <UpgradePanel
          wallet={wallet}
          station={panel.station}
          onBuy={(item, step) => command({ type: 'buy', item, step })}
          onFinish={(work) => command({ type: 'finish', work })}
          onShowAll={() => open(null)}
          onClose={close}
        />
      )}
      {build && wallet && (
        <BuildPanel
          wallet={wallet}
          item={build.item}
          tile={build.tile}
          freeTiles={freeCount}
          moving={build.moving ?? null}
          onCancelMove={() => setBuild({ item: null, tile: null })}
          onItem={(item) => setBuild({ item, tile: null })}
          onPlace={placeBuild}
          onDone={() => setBuild(null)}
        />
      )}
      {!onboarding && tutorial < TUTORIAL_STEPS.length && !welcome && building < 0 && (
        <Tutorial gameRef={gameRef} camera={camera} buttons={tutorialButtons} layout={hud} menuOpen={panel !== null || staff !== null || build !== null} />
      )}
      {building >= 0 && <ConstructionNote />}
      {levelBanner !== null && <LevelBanner level={levelBanner} onDone={endLevelBanner} />}
      {rankBanner !== null && levelBanner === null && <LevelBanner level={rankBanner} rank={{ opens: rankBanner * RANK.levels }} onDone={endRankBanner} />}
      {banner !== null && <TierBanner tier={banner} restaurant={profile?.restaurant} onDone={endBanner} />}
      {welcome && !onboarding && <WelcomeBack earnings={welcome} manager={profile?.manager} onCollect={collect} />}
      {loaded && !profile && (
        <Welcome
          // A player who already has a restaurant only picks names: no lessons, no tutorial.
          pages={boot.save ? ['hello', 'names'] : ['hello', 'names', 'howto']}
          onDone={(p) => {
            setProfile(p);
            if (boot.save) setTutorial(TUTORIAL_STEPS.length);
          }}
        />
      )}
    </>
  );
}

/** Loads the save first (a fraction of a second), then starts the restaurant. */
function GameView() {
  const [boot, setBoot] = useState<GameBoot | null>(null);
  useEffect(() => {
    let alive = true;
    void bootGame().then((b) => {
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
      <SceneCanvas snapshot={snapshot} background={CAST_BG} focus={CAST_FOCUS} uiFps={uiFps} buildMs={buildMs} onCamera={setCamera} onReady={markReady} />
      {camera && <Labels camera={camera} />}
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
    </>
  );
}

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { lang, view, gameEpoch, profile, setProfile } = useSettings();
  const [settings, setSettings] = useState(false);
  const [extra, setExtra] = useState<'howto' | 'names' | null>(null);
  const openExtra = (which: 'howto' | 'names') => {
    setSettings(false);
    setExtra(which);
  };
  return (
    <View style={[styles.root, { direction: isRTL(lang) ? 'rtl' : 'ltr' }]}>
      {view === 'game' ? <GameView key={`game${gameEpoch}`} /> : <CastView key="cast" />}
      <View style={[styles.corner, { bottom: insets.bottom + 10, start: insets.left + 10 }]}>
        <GearButton onPress={() => setSettings(true)} />
      </View>
      {settings && <SettingsPanel onClose={() => setSettings(false)} onHowTo={() => openExtra('howto')} onNames={() => openExtra('names')} />}
      {extra === 'howto' && <HowToPlay onClose={() => setExtra(null)} />}
      {extra === 'names' && (
        <Welcome
          pages={['names']}
          initial={profile}
          onDone={(p) => {
            setProfile(p);
            setExtra(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1022' },
  corner: { position: 'absolute' },
  cornerRow: { flexDirection: 'row', gap: 10 },
  cornerButton: { minHeight: 52, paddingHorizontal: 20, backgroundColor: '#35B957', borderColor: '#FFE08A', borderWidth: 2.5 },
  staffButton: { backgroundColor: '#6A2C8F', borderColor: '#E8C9FF' },
  buildButton: { backgroundColor: '#D9822B', borderColor: '#FFE08A' },
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
