import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { buildableTiles, tableAnchors, nextTableSpot } from '../sim/game/build';
import { joinCandidate, joinedFits, tableIsFree } from '../sim/game/create';
import { kitchenPieces, kitchenTargets, pieceAt, type KitchenPiece } from '../sim/game/kitchenLayout';
import { fullSeats } from '../data/tables';
import { styleIndex, type TableStyle } from '../data/tables';
import type { OfflineEarnings } from '../sim/offline';
import type { GameState, PlacedDecor } from '../sim/game/types';
import { PropKind } from '../sim/types';
import { bootGame } from '../store/boot';
import { markReady, useLaunch } from '../store/launch';
import { useSettings } from '../store/settings';
import { trace } from '../trace';
import { JuicyButton } from './JuicyButton';
import { Notices } from './Notices';
import { PerfOverlay } from './PerfOverlay';
import { StaffPanel, type StaffView } from './StaffPanel';
import { canLearn } from '../sim/game/talents';
import { GameIcon } from './GameIcon';
import { publishPurchases } from '../iap/livePurchases';
import { usePurchases } from '../iap/usePurchases';
import { PrivacyPanel } from './Privacy';
import { GearButton, SettingsPanel } from './SettingsPanel';
import { DAY_PILL_WIDTH, Hud } from './Hud';
import { BUILD_ITEMS, BuildPanel } from './BuildPanel';
import { textShadow, theme } from './theme';
import { ConstructionNote, TierBanner } from './TierBanner';
import { HowToPlay } from './HowToPlay';
import { ReviewsPanel } from './Reviews';
import { GuidePanel } from './Guide';
import { ChefBadge, ChefPanel, LevelUpCard } from './ChefLevel';
import { GuideEdition, InspectorCard, RumorHint } from './GuideCards';
import { RushButton } from './RushButton';
import { ClosedSign, SIGN_WIDTH } from './ClosedSign';
import { KitchenHint } from './KitchenHint';
import { EventsMenu } from './EventsMenu';
import { LevelBanner, QuestButton, QuestPanel } from './Quests';
import { GemPill, Shop } from './Shop';
import { FestivalPanel, useFestivalClock } from './Festival';
import { OffersPanel, readOfferPopup, useOffersClock } from './Offers';
import { useReminders } from '../notify/useReminders';
import { HUD } from '../render/draw/hud';
import { Tutorial } from './Tutorial';
import { Welcome } from './Welcome';
import { canBuyNow, UpgradePanel } from './UpgradePanel';
import { WelcomeBack } from './WelcomeBack';
import { NewsCard } from './News';
import { StatsPanel } from './Stats';
import { liveGame } from './liveGame';
import { NEWS } from '../data/news';
import { WorksTray } from './WorksTray';
import { EventToast } from './EventToast';
import { DailyButton, DailyPanel, dailyReady } from './Daily';
import { WheelButton, WheelPanel } from './Wheel';
import { BranchConfirm, readBranch } from './Branch';
import { cityOf } from '../data/franchise';
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
const TABLE_PICK_HEIGHT = 16;

/** What build mode is doing (see where it is used). `busy`: a table with guests was tapped. */
interface BuildState {
  item: string | null;
  tile: Point | null;
  moving?: Point;
  table?: number;
  style?: TableStyle;
  busy?: boolean;
  /** A kitchen piece picked to trade places with the next one tapped (owner M30). */
  kitchen?: KitchenPiece;
}

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

/** `star`: talent points the team can use now (owner M46): a star on the other corner. */
function CornerButton({ label, count, onPress, color, ref, star = false }: { label: string; count: number; onPress: () => void; color: 'green' | 'purple' | 'orange'; ref?: Ref<View>; star?: boolean }) {
  return (
    <View ref={ref}>
      <JuicyButton label={label} onPress={onPress} labelStyle={styles.cornerLabel} style={[styles.cornerButton, color === 'purple' && styles.staffButton, color === 'orange' && styles.buildButton]} />
      <View pointerEvents="none" style={styles.cornerShine} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      {star && (
        <View style={styles.starBadge}>
          <GameIcon name="iconTalent" size={18} />
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
    talent: canLearn(s),
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
  branch: readBranch(s),
  tableRoom: nextTableSpot(s) !== null,
});
const readCity = (s: GameState) => s.city;

/** The live restaurant: scene, upgrade and staff panels, decisions, welcome-back screen. */
function GameRunner({ boot }: { boot: GameBoot }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showPerf, stress, loaded, profile, tutorial, setProfile, setTutorial, moneyTaps, busTaps } = useSettings();
  const [welcome, setWelcome] = useState<OfflineEarnings | null>(boot.offline);
  // The welcome-back card waits for the opening animation to be gone: it used to pop and count
  // underneath it while the art was still being made, and reached the player in jerks.
  const splashGone = useLaunch((s) => s.done);
  // First run: welcome, names and how to play come before anything happens.
  const onboarding = !loaded || profile === null;
  // What's new since the last update: once, for players who already know the game (a new
  // player learns it all from the tutorial instead).
  const seenNews = useSettings((s) => s.seenNews);
  const setSeenNews = useSettings((s) => s.setSeenNews);
  useEffect(() => {
    if (loaded && (profile === null || tutorial < TUTORIAL_STEPS.length) && seenNews < NEWS.version) setSeenNews(NEWS.version);
  }, [loaded, profile, tutorial, seenNews, setSeenNews]);
  const newsDue = loaded && profile !== null && tutorial >= TUTORIAL_STEPS.length && seenNews < NEWS.version;
  // Frozen during the first-run screens, and until the welcome-back money is collected so
  // nothing earned can slip away.
  const paused = useRef(true);
  paused.current = onboarding || welcome !== null;
  const { snapshot, stats, tap, command, gameRef } = useGame(STAND_MAP, GAME_SEED, stress, boot, paused);
  useGameSounds(gameRef, paused);
  // Store purchases live as long as the game (one owed from last time is paid out at start).
  const purchases = usePurchases(gameRef, paused);
  // The settings panel (outside this game) offers "Restore purchases" through these.
  useEffect(() => publishPurchases(purchases), [purchases]);
  useEffect(() => () => publishPurchases(null), []);
  // Screens opened from the settings (the stats) read the running restaurant from here.
  liveGame.ref = gameRef;
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
  // Testing: "call the tourist bus" in the settings.
  const busSeen = useRef(busTaps);
  useEffect(() => {
    if (busTaps === busSeen.current) return;
    busSeen.current = busTaps;
    command({ type: 'testBus' });
  }, [busTaps, command]);
  // The tutorial's glove needs the camera and where the corner buttons are.
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const onCamera = useCallback((cam: Camera) => {
    camera.current = cam;
  }, []);
  liveGame.camera = camera;
  const upgradesButton = useRef<View>(null);
  const staffButton = useRef<View>(null);
  const tutorialButtons = useMemo(() => ({ upgrades: upgradesButton, staff: staffButton }), []);
  const panelOpen = useRef(false);
  panelOpen.current = panel !== null || staff !== null;

  // Build mode: what is picked, which tile, and the free tiles shown on the floor.
  // `moving`: a placed piece picked up to go on another tile; `table`: a table picked up (by its
  // index) to go somewhere else; `style`: the table design picked (a new table or the one moving).
  const [build, setBuild] = useState<BuildState | null>(null);
  // Coins change all the time: the full wallet is read often only while a panel shows it.
  const wallet = usePoll(gameRef, readWallet, panel || build ? 6 : 0.1);
  const buildRef = useRef(build);
  buildRef.current = build;
  const overlay = useSharedValue<BuildOverlay | null>(null);
  const freeTiles = useRef<Point[]>([]);
  liveGame.freeTiles = freeTiles;
  const [freeCount, setFreeCount] = useState(0);
  useEffect(() => {
    if (!build) {
      overlay.value = null;
      return;
    }
    const decor = DECOR.find((d) => build.item === `place_${d.id}`);
    // A table being placed or moved: the spots where that design fits.
    const tables = build.style !== undefined && (build.item === 'tables' || build.table !== undefined);
    // Free tiles only change when something is built: they are worked out again only then
    // (on a big map that takes a moment, felt as a hitch if done every second).
    let seen = '';
    const refresh = () => {
      const game = gameRef.current;
      const layout = game ? game.tables.map((t) => `${t.x},${t.y},${t.style}`).join(';') : '';
      // The kitchen's pieces too: a piece picked shows where it can go, and that changes as they move.
      const kitchenLayout = game && build.kitchen ? kitchenPieces(game).map((k) => `${k.at.x},${k.at.y}`).join(';') : '';
      const now = game ? `${game.map.tier}:${game.placed.length}:${layout}:${game.works.length}:${game.placed.map((p) => p.x * 100 + p.y).join(',')}:${kitchenLayout}` : '';
      if (now !== seen || !game) {
        seen = now;
        freeTiles.current = !game ? [] : build.kitchen ? kitchenTargets(game, build.kitchen) : tables ? tableAnchors(game, build.style!, build.table ?? -1) : buildableTiles(game);
      }
      setFreeCount(freeTiles.current.length);
      const moved = build.table !== undefined ? game?.tables[build.table] : undefined;
      const picked = build.kitchen && game ? pieceAt(game, build.kitchen) : null;
      overlay.value = {
        tiles: decor || build.moving || tables || build.kitchen ? freeTiles.current.flatMap((p) => [p.x, p.y]) : [],
        pick: decor && build.tile ? [build.tile.x, build.tile.y, decor.kind] : tables && build.tile ? [build.tile.x, build.tile.y, PropKind.Table, styleIndex(build.style!)] : [],
        from: build.moving ? [build.moving.x, build.moving.y] : moved ? [moved.x, moved.y] : picked ? [picked.x, picked.y] : [],
      };
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [build, gameRef, overlay]);
  // A picked table: is there another to join onto its back (owner M30), or is it a joined one to split?
  const picked = build?.table !== undefined ? gameRef.current?.tables[build.table] : undefined;
  const join = useMemo(() => {
    const game = gameRef.current;
    if (!game || build?.table === undefined) return null;
    const other = joinCandidate(game, build.table);
    const style = other >= 0 ? joinedFits(game, build.table, other) : null;
    return style ? { other, seats: fullSeats(style) } : null;
  }, [build, gameRef]);
  const splittable = picked !== undefined && picked.parts.length > 1;
  const placeBuild = () => {
    const b = buildRef.current;
    if (!b?.item) return;
    if (b.table !== undefined && b.tile && b.style) command({ type: 'moveTable', table: b.table, to: b.tile, style: b.style });
    else if (b.item === 'tables') command({ type: 'buy', item: 'tables', ...(b.tile && b.style ? { at: b.tile, style: b.style } : {}) });
    else command({ type: 'buy', item: b.item, ...(b.tile ? { at: b.tile } : {}) });
    setBuild(b.table !== undefined ? { item: null, tile: null } : { item: b.item, tile: null, style: b.style });
  };

  // The building: its background, where the camera looks (the building site while the
  // scaffolding is up), and a celebration when the bigger place opens.
  const tier = usePoll(gameRef, readTier, 4) ?? (boot.save ? levelOf(boot.save.levels, 'building') : 0);
  const building = usePoll(gameRef, readConstruction, 4) ?? -1;
  const city = usePoll(gameRef, readCity, 2) ?? boot.save?.city ?? 0;
  const background = useMemo(() => mapBackground(mapForTier(tier), city), [tier, city]);
  // A new branch opened: its own banner (the city and the trophies).
  const [branchBanner, setBranchBanner] = useState<number | null>(null);
  const [branchAsk, setBranchAsk] = useState(false);
  const shownCity = useRef(city);
  useEffect(() => {
    if (city > shownCity.current) setBranchBanner(city);
    shownCity.current = city;
  }, [city]);
  const endBranchBanner = useCallback(() => setBranchBanner(null), []);
  const focus = useMemo(() => {
    if (building < 0) return mapForTier(tier).focus;
    const from = mapForTier(tier).building.x1;
    return { x: (from + mapForTier(building).building.x1) / 2, y: mapForTier(building).focus.y, zoom: 0.9 };
  }, [tier, building]);
  const [quests, setQuests] = useState(false);
  const [shop, setShop] = useState(false);
  const [daily, setDaily] = useState(false);
  const [wheel, setWheel] = useState(false);
  const [reviews, setReviews] = useState(false);
  const [guide, setGuide] = useState(false);
  // A new edition of the guide: its card, once, when it is news (inspectors came, or the stars
  // changed) and nothing else is on screen; it waits for a free moment instead of covering a page.
  // Editions out before this screen started (a reload) are not shown again.
  const edition = usePoll(gameRef, readEdition, 2);
  const [seenEdition, setSeenEdition] = useState<number | null>(null);
  useEffect(() => {
    if (edition && seenEdition === null) setSeenEdition(edition.edition);
  }, [edition, seenEdition]);
  const editionNews = edition && seenEdition !== null && edition.edition > seenEdition && (edition.visits > 0 || edition.change !== 0) ? edition : null;
  const [festival, setFestival] = useState(false);
  useFestivalClock(command, true);
  // The paid offers (owner M34): the clock goes to the sim; the big card opens by itself once a
  // hero turn, when nothing else is on screen.
  const [offers, setOffers] = useState(false);
  useOffersClock(command, true);
  // Phone reminders while the game is closed (owner M35), once the first screens are done.
  useReminders(gameRef, !onboarding && !welcome && tutorial >= TUTORIAL_STEPS.length);
  const offerPopup = usePoll(gameRef, readOfferPopup, 0.5);
  const [chefPage, setChefPage] = useState(false);
  const othersOpen = !!(panel || staff || build || quests || shop || daily || wheel || festival || reviews || guide || offers || chefPage || onboarding || welcome || newsDue);
  const editionCard = editionNews && !othersOpen ? editionNews : null;
  // A new chef level: its card when nothing else is on screen (after the guide's edition).
  const chefPending = usePoll(gameRef, readChefPending, 2);
  const levelCard = !othersOpen && !editionCard && tutorial >= TUTORIAL_STEPS.length && chefPending ? chefPending : null;
  const closeEdition = useCallback(() => setSeenEdition((e) => Math.max(e ?? 0, editionNews?.edition ?? 0)), [editionNews?.edition]);
  const anythingOpen = othersOpen || !!editionCard;
  useEffect(() => {
    if (offerPopup === null || anythingOpen || onboarding || welcome || newsDue || tutorial < TUTORIAL_STEPS.length) return;
    command({ type: 'offerShown', turn: offerPopup });
    setOffers(true);
  }, [offerPopup, anythingOpen, onboarding, welcome, newsDue, tutorial, command]);
  // Today's gift opens by itself once, when the first screens are done (not during the tutorial).
  const dailyShown = useRef(false);
  useEffect(() => {
    if (dailyShown.current || onboarding || welcome || newsDue || tutorial < TUTORIAL_STEPS.length) return;
    // A moment after the restaurant is up (the game is made in an effect of its own).
    const timer = setTimeout(() => {
      const game = gameRef.current;
      if (!game || dailyShown.current) return;
      dailyShown.current = true;
      if (dailyReady(game)) setDaily(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [onboarding, welcome, newsDue, tutorial, gameRef]);
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
      // A padlock on land for later opens the building upgrades, like the "for sale" sign.
      if (station === PropKind.LockSign) station = PropKind.SaleSign;
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
        // The kitchen (owner M30, M47): any piece picked, then another tapped: they trade places;
        // or a green tile tapped: it goes there.
        if (game && !b.item && !b.moving && b.table === undefined) {
          let kitchen: KitchenPiece | null = null;
          let close = PICK_PX * cam.zoom;
          const consider = (piece: KitchenPiece, at: Point) => {
            const dist = Math.hypot(cam.x + isoX(at.x, at.y) * cam.zoom - x, cam.y + isoY(at.x, at.y, PICK_HEIGHT) * cam.zoom - y);
            if (dist < close) {
              close = dist;
              kitchen = piece;
            }
          };
          for (const k of kitchenPieces(game)) consider(k.piece, k.at);
          const same = (a: KitchenPiece, c: KitchenPiece) => a.kind === c.kind && (a.kind === 'station' ? a.index === (c as typeof a).index : a.id === (c as { id: number }).id);
          // A green tile right under the finger beats a piece a little way off: that is a spot being picked.
          const onTile = tile !== null && best < 0.7;
          if (b.kitchen && tile && (!kitchen || onTile)) {
            command({ type: 'moveKitchen', piece: b.kitchen, to: tile });
            setBuild({ item: null, tile: null });
            return;
          }
          if (kitchen) {
            if (b.kitchen && same(b.kitchen, kitchen)) setBuild({ item: null, tile: null });
            else if (b.kitchen) {
              command({ type: 'swapKitchen', a: b.kitchen, b: kitchen });
              setBuild({ item: null, tile: null });
            } else setBuild({ item: null, tile: null, kitchen });
            return;
          }
        }
        // A piece is picked by what you see: its body stands up from its tile (a table's top is lower).
        let piece: PlacedDecor | undefined;
        let table = -1;
        let near = PICK_PX * cam.zoom;
        for (const d of game?.placed ?? []) {
          const dist = Math.hypot(cam.x + isoX(d.x, d.y) * cam.zoom - x, cam.y + isoY(d.x, d.y, PICK_HEIGHT) * cam.zoom - y);
          if (dist < near) {
            near = dist;
            piece = d;
          }
        }
        // Tables too (not while a green tile is right under the finger: that is a spot being picked).
        if (!tile || b.style === undefined) {
          for (const t of game?.tables ?? []) {
            const dist = Math.hypot(cam.x + isoX(t.x, t.y) * cam.zoom - x, cam.y + isoY(t.x, t.y, TABLE_PICK_HEIGHT) * cam.zoom - y);
            if (dist < near) {
              near = dist;
              table = t.index;
              piece = undefined;
            }
          }
        }
        if (table >= 0 && game) {
          const t = game.tables[table]!;
          // Guests at it: it stays until they leave (the bar says so).
          setBuild(tableIsFree(t) ? { item: null, tile: null, table, style: t.style } : { item: null, tile: null, busy: true });
        } else if (b.moving) {
          if (piece && !tile) setBuild({ item: null, tile: null, moving: { x: piece.x, y: piece.y } });
          else if (tile) {
            command({ type: 'move', from: b.moving, to: tile });
            setBuild({ item: null, tile: null });
          }
        } else if (b.table !== undefined) {
          // A table picked up goes straight to the green tile tapped.
          if (tile && b.style) {
            command({ type: 'moveTable', table: b.table, to: tile, style: b.style });
            setBuild({ item: null, tile: null });
          }
        } else if (piece) setBuild({ item: null, tile: null, moving: { x: piece.x, y: piece.y } });
        else if (tile && b.item && (b.item !== 'tables' || b.style)) setBuild({ item: b.item, tile, style: b.style });
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
      {!onboarding && <EventToast gameRef={gameRef} style={{ top: hud.top + HUD.height + 8 }} />}
      {!onboarding && (
        // One events button under the rating (owner M40: a less crowded screen); its list drops down.
        <EventsMenu
          gameRef={gameRef}
          full={tutorial >= TUTORIAL_STEPS.length}
          onOffers={() => setOffers(true)}
          onFestival={() => setFestival(true)}
          onShop={() => setShop(true)}
          onReviews={() => setReviews(true)}
          onGuide={() => setGuide(true)}
          style={{ right: Math.max(0, width - hud.right) - 6, top: hud.top + HUD.height + 8 }}
        />
      )}
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
      <Notices gameRef={gameRef} onCommand={command} />
      {!panel && !staff && !build && !onboarding && tutorial >= TUTORIAL_STEPS.length && (
        // Notes above the big buttons: the guide's rumor (an inspector in town), the kitchen falling behind.
        <View style={[styles.hints, { bottom: insets.bottom + 66, end: insets.right + 10 }]} pointerEvents="box-none">
          <RumorHint gameRef={gameRef} style={styles.hint} />
          <KitchenHint
            gameRef={gameRef}
            onAct={(advice) => (advice === 'hire' ? showStaff({ tab: 'applicants' }) : open(advice === 'stove' ? PropKind.StoveSlot : PropKind.Stove))}
            style={styles.hint}
          />
        </View>
      )}
      {!onboarding && <InspectorCard gameRef={gameRef} hidden={!!(panel || staff || build || shop || quests || guide || editionCard)} />}
      {!panel && !staff && !build && (
        <View style={[styles.corner, styles.cornerRow, { bottom: insets.bottom + 10, end: insets.right + 10 }]}>
          <CornerButton label={t('ui.build')} count={buildable} color="orange" onPress={() => setBuild({ item: null, tile: null })} />
          <CornerButton ref={staffButton} label={t('ui.staff')} count={corner?.waiting ?? 0} star={corner?.talent ?? false} color="purple" onPress={() => showStaff({ tab: (corner?.waiting ?? 0) > 0 ? 'applicants' : 'team' })} />
          <CornerButton ref={upgradesButton} label={t('ui.upgrades')} count={affordable} color="green" onPress={() => open(null)} />
        </View>
      )}
      {!panel && !staff && !build && !quests && !onboarding && tutorial >= TUTORIAL_STEPS.length && building < 0 && (
        <>
          <QuestButton gameRef={gameRef} onPress={() => setQuests(true)} style={{ bottom: insets.bottom + 8, start: insets.left + 68 }} />
          <RushButton gameRef={gameRef} onCommand={command} style={{ bottom: insets.bottom + 5, start: insets.left + 130 }} />
          <WheelButton gameRef={gameRef} onPress={() => setWheel(true)} style={{ bottom: insets.bottom + 8, start: insets.left + 196 }} />
          <DailyButton gameRef={gameRef} onPress={() => setDaily(true)} style={{ bottom: insets.bottom + 8, start: insets.left + 258 }} />
        </>
      )}
      {!onboarding && !build && tutorial >= TUTORIAL_STEPS.length && (
        // The chef's level (owner: "like Hay Day"): a star in the top bar, between the coins and the day.
        <ChefBadge gameRef={gameRef} onPress={() => setChefPage(true)} style={{ top: hud.top - 4, left: (hud.left + hud.right) / 2 - DAY_PILL_WIDTH / 2 - 62 }} />
      )}
      {!panel && !staff && !build && !quests && !onboarding && tutorial >= TUTORIAL_STEPS.length && building < 0 && (
        // The door sign hangs in the top bar, between the day and the rating (owner: "a more normal place").
        <ClosedSign gameRef={gameRef} onCommand={command} style={{ top: hud.top - 8, left: signLeft(hud) }} />
      )}
      {quests && <QuestPanel gameRef={gameRef} onCommand={command} onClose={() => setQuests(false)} />}
      {shop && (
        <Shop
          gameRef={gameRef}
          onCommand={command}
          onClose={() => setShop(false)}
          purchases={purchases}
          onOffers={() => {
            setShop(false);
            setOffers(true);
          }}
        />
      )}
      {daily && <DailyPanel gameRef={gameRef} onCommand={command} onClose={() => setDaily(false)} />}
      {wheel && <WheelPanel gameRef={gameRef} onCommand={command} onClose={() => setWheel(false)} />}
      {festival && <FestivalPanel gameRef={gameRef} onCommand={command} onClose={() => setFestival(false)} />}
      {offers && <OffersPanel gameRef={gameRef} onClose={() => setOffers(false)} purchases={purchases} />}
      {reviews && <ReviewsPanel gameRef={gameRef} onCommand={command} onClose={() => setReviews(false)} />}
      {guide && <GuidePanel gameRef={gameRef} onClose={() => setGuide(false)} />}
      {chefPage && <ChefPanel gameRef={gameRef} onClose={() => setChefPage(false)} />}
      {levelCard !== null && <LevelUpCard key={levelCard} level={levelCard} onClose={() => command({ type: 'chefSeen', level: levelCard })} />}
      {editionCard && <GuideEdition stars={editionCard.stars} change={editionCard.change} plate={editionCard.plate} gems={editionCard.gems} talent={editionCard.talent} onClose={closeEdition} />}
      {staff && <StaffPanel gameRef={gameRef} view={staff} onView={showStaff} onCommand={command} onClose={close} />}
      {panel && wallet && (
        <UpgradePanel
          wallet={wallet}
          station={panel.station}
          onBuy={(item, step) => command({ type: 'buy', item, step })}
          onFinish={(work) => command({ type: 'finish', work })}
          onBranch={() => {
            close();
            setBranchAsk(true);
          }}
          onShowAll={() => open(null)}
          onClose={close}
        />
      )}
      {build && wallet && (
        <BuildPanel
          kitchen={build.kitchen?.kind ?? null}
          onRestyle={() => {
            if (build.kitchen?.kind === 'prep') command({ type: 'restylePrep', id: build.kitchen.id });
          }}
          joinSeats={join ? join.seats : null}
          canSplit={splittable}
          onJoin={() => {
            if (build.table === undefined || !join) return;
            command({ type: 'joinTables', table: build.table, other: join.other });
            setBuild({ item: null, tile: null });
          }}
          onSplit={() => {
            if (build.table === undefined) return;
            command({ type: 'splitTable', table: build.table });
            setBuild({ item: null, tile: null });
          }}
          wallet={wallet}
          item={build.item}
          tile={build.tile}
          freeTiles={freeCount}
          moving={build.moving ?? (build.table !== undefined ? { x: 0, y: 0 } : null)}
          movingTable={build.table !== undefined}
          busy={build.busy === true}
          style={build.style ?? null}
          tier={tier}
          onStyle={(style) => setBuild({ ...build, style, tile: null })}
          onCancelMove={() => setBuild({ item: null, tile: null })}
          onItem={(item) => setBuild({ item, tile: null, ...(item === 'tables' ? { style: 'round' as const } : {}) })}
          onPlace={placeBuild}
          onDone={() => setBuild(null)}
        />
      )}
      {!onboarding && tutorial < TUTORIAL_STEPS.length && !welcome && building < 0 && (
        <Tutorial gameRef={gameRef} camera={camera} buttons={tutorialButtons} layout={hud} menuOpen={panel !== null || staff !== null || build !== null} />
      )}
      {building >= 0 && <ConstructionNote />}
      {branchAsk && <BranchConfirm gameRef={gameRef} onCommand={command} onClose={() => setBranchAsk(false)} />}
      {branchBanner !== null && <LevelBanner level={0} branch={{ city: t(`city.${cityOf(branchBanner).id}`), trophies: gameRef.current?.trophies ?? 0 }} onDone={endBranchBanner} />}
      {levelBanner !== null && branchBanner === null && <LevelBanner level={levelBanner} onDone={endLevelBanner} />}
      {rankBanner !== null && levelBanner === null && <LevelBanner level={rankBanner} rank={{ opens: rankBanner * RANK.levels }} onDone={endRankBanner} />}
      {banner !== null && <TierBanner tier={banner} restaurant={profile?.restaurant} onDone={endBanner} />}
      {newsDue && !welcome && <NewsCard onClose={() => setSeenNews(NEWS.version)} />}
      {welcome && !onboarding && splashGone && <WelcomeBack earnings={welcome} manager={profile?.manager} onCollect={collect} />}
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

/** The oldest chef level whose card was not seen yet (or null). */
const readChefPending = (s: GameState): number | null => s.chef.pending[0] ?? null;

/** The door sign's left edge: in the middle of the gap between the day pill and the rating pill. */
const signLeft = (hud: { left: number; right: number }): number => {
  const dayRight = (hud.left + hud.right) / 2 + DAY_PILL_WIDTH / 2;
  const ratingLeft = hud.right - HUD.ratingWidth - HUD.iconOut;
  return (dayRight + ratingLeft) / 2 - SIGN_WIDTH / 2;
};

/** The guide's latest edition (kept in the save, so its card neither expires nor comes back after a reload). */
const readEdition = (s: GameState) => {
  const l = s.guide.last;
  return { edition: s.guide.edition, stars: l?.stars ?? s.guide.stars, change: l?.change ?? 0, plate: l?.plate ?? s.guide.plate, visits: l?.visits ?? 0, gems: l?.gems ?? 0, talent: l?.talent ?? 0 };
};

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { lang, view, gameEpoch, profile, setProfile } = useSettings();
  const [settings, setSettings] = useState(false);
  const [extra, setExtra] = useState<'howto' | 'names' | 'stats' | 'privacy' | null>(null);
  const openExtra = (which: 'howto' | 'names' | 'stats' | 'privacy') => {
    setSettings(false);
    setExtra(which);
  };
  return (
    <View style={[styles.root, { direction: isRTL(lang) ? 'rtl' : 'ltr' }]}>
      {view === 'game' ? <GameView key={`game${gameEpoch}`} /> : <CastView key="cast" />}
      <View style={[styles.corner, { bottom: insets.bottom + 10, start: insets.left + 10 }]}>
        <GearButton onPress={() => setSettings(true)} />
      </View>
      {settings && <SettingsPanel onClose={() => setSettings(false)} onHowTo={() => openExtra('howto')} onNames={() => openExtra('names')} onStats={() => openExtra('stats')} onPrivacy={() => openExtra('privacy')} />}
      {extra === 'howto' && <HowToPlay onClose={() => setExtra(null)} />}
      {extra === 'stats' && <StatsPanel onClose={() => setExtra(null)} />}
      {extra === 'privacy' && <PrivacyPanel onClose={() => setExtra(null)} />}
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
  hints: { position: 'absolute', alignItems: 'flex-end', gap: 6 },
  hint: { position: 'relative' },
  // The three big buttons (owner M33: "so it does not look cheap"): deep colors, a thin light
  // rim, a soft shadow and a sheen instead of thick yellow borders.
  cornerButton: { minHeight: 48, minWidth: 92, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#23934A', borderColor: 'rgba(255,255,255,0.45)', borderWidth: 1.5, boxShadow: '0px 4px 12px rgba(8,2,12,0.5)' },
  staffButton: { backgroundColor: '#5E2A86' },
  buildButton: { backgroundColor: '#C8702A' },
  cornerLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', ...textShadow('rgba(0,0,0,0.35)', 1, 0) },
  cornerShine: { position: 'absolute', left: 6, right: 6, top: 3, height: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: '#E5483B',
    borderWidth: 1.5,
    borderColor: '#FFF4E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  starBadge: { position: 'absolute', top: -8, start: -8, width: 26, height: 26, borderRadius: 13, backgroundColor: '#5A1F5E', borderWidth: 1.5, borderColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center' },
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
