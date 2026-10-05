import { useEffect, useState, type ReactNode } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ECONOMY } from '../data/economy';
import { DAY } from '../data/staff';
import { isRTL, useT } from '../i18n';
import { HUD, type HudLayout } from '../render/draw/hud';
import type { HudFeed } from '../render/SceneCanvas';
import { hudIcon } from '../render/icons';
import type { HudIcon } from '../render/art/hudArt';
import { usePoll } from '../render/useSimulation';
import { formatBig, formatNumber } from '../sim/format';
import type { GameState } from '../sim/game/types';
import { useSettings } from '../store/settings';
import { textShadow } from './theme';

// The top bar: coins, the day and the rating. Plain React Native on top of the canvas, so the
// numbers use the phone's real bold font and the icons are crisp at any screen density. Its
// positions come from HUD/hudAnchors, the same numbers the canvas aims flying coins at.

type GameRef = { current: GameState | null };

/** Dawn to dusk; the moon from here on (matches the night tint). */
const NIGHT_FROM = 0.7;
const COIN_HZ = 15;
/** Share of the gap to the real amount the counter closes per tick: it rolls up, never jumps. */
const ROLL = 0.35;

const iconUri = (name: HudIcon, px: number) => hudIcon(name, Math.round(px * PixelRatio.get()));

/** A quick squash-and-spring each time `count` goes up (a coin or a star just landed). */
function useBounce(feed: SharedValue<HudFeed>, count: 'coinLands' | 'starLands') {
  const scale = useSharedValue(1);
  useAnimatedReaction(
    () => feed.value[count],
    (now, before) => {
      if (before !== null && now > before) scale.value = withSequence(withTiming(1.25, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 320 }));
    },
  );
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** A dark glass pill with a gold rim and a soft shine across its top half. */
function Pill({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, style]}>
      <View style={styles.shine} />
      {children}
    </View>
  );
}

/** Coins, counting up as the flying coins land (never more than the player really has). */
function CoinPill({ gameRef, feed, layout }: { gameRef: GameRef; feed: SharedValue<HudFeed>; layout: HudLayout }) {
  const [text, setText] = useState('0');
  useEffect(() => {
    let shown = -1;
    let last = '';
    const tick = () => {
      const g = gameRef.current;
      if (!g) return;
      const coins = g.coins.toNumber();
      let next: string;
      if (!Number.isFinite(coins)) next = formatBig(g.coins);
      else {
        // Money already counted by the sim but still flying across the screen shows up on landing.
        const target = Math.max(0, coins - feed.value.pending);
        shown = shown < 0 || target < shown ? target : shown + (target - shown) * ROLL;
        if (target - shown < 0.5) shown = target;
        next = formatNumber(shown);
      }
      if (next !== last) setText((last = next));
    };
    tick();
    const timer = setInterval(tick, 1000 / COIN_HZ);
    return () => clearInterval(timer);
  }, [gameRef, feed]);
  const bounce = useBounce(feed, 'coinLands');
  return (
    <View style={[styles.slot, { left: layout.left + HUD.iconOut, top: layout.top }]}>
      <Pill style={styles.coinPill}>
        <Text style={styles.coins} numberOfLines={1}>
          {text}
        </Text>
      </Pill>
      <Animated.Image source={{ uri: iconUri('hudCoin', HUD.icon) }} style={[styles.icon, bounce]} />
    </View>
  );
}

const readDay = (s: GameState) => ({ day: s.day, phase: s.dayTime / DAY.seconds });

/** Top middle: sun or moon, "Day N", and a strip that fills as the day goes by. */
function DayPill({ gameRef, layout }: { gameRef: GameRef; layout: HudLayout }) {
  const t = useT();
  const rtl = isRTL(useSettings((s) => s.lang));
  const day = usePoll(gameRef, readDay, 2);
  if (!day) return null;
  const night = day.phase >= NIGHT_FROM;
  return (
    <View style={[styles.slot, styles.daySlot, { top: layout.top, left: (layout.left + layout.right) / 2 - DAY_W / 2 }]}>
      <Pill style={styles.dayPill}>
        {/* Label and number as separate Texts: one mixed string scrambles in Hebrew. */}
        <View style={[styles.dayRow, { direction: rtl ? 'rtl' : 'ltr' }]}>
          <Image source={{ uri: iconUri(night ? 'hudMoon' : 'hudSun', 28) }} style={styles.dayIcon} />
          <Text style={styles.dayLabel}>{t('ui.day')}</Text>
          <Text style={styles.dayNumber}>{day.day}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, night && styles.trackNight, { width: `${Math.min(100, day.phase * 100)}%` }]} />
        </View>
      </Pill>
    </View>
  );
}

const readRating = (s: GameState) => s.rating;
const readBuzz = (s: GameState) => s.time < s.buzzUntil;

/** Top right: a big star, the rating, and how close it is to five stars. */
function RatingPill({ gameRef, feed, layout }: { gameRef: GameRef; feed: SharedValue<HudFeed>; layout: HudLayout }) {
  const t = useT();
  const rating = usePoll(gameRef, readRating, 2) ?? 0;
  // A five-star review has people talking: more customers for a while.
  const buzz = usePoll(gameRef, readBuzz, 2) ?? false;
  const bounce = useBounce(feed, 'starLands');
  return (
    <View style={[styles.slot, { left: layout.right - HUD.ratingWidth, top: layout.top }]}>
      <Pill style={styles.ratingPill}>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>{(Math.floor(rating * 10) / 10).toFixed(1)}</Text>
          <Text style={styles.outOf}>/5</Text>
        </View>
        <View style={[styles.track, styles.ratingTrack]}>
          <View style={[styles.trackFill, styles.trackGold, { width: `${Math.min(100, (rating / 5) * 100)}%` }]} />
        </View>
      </Pill>
      <Animated.Image source={{ uri: iconUri('hudStar', HUD.icon) }} style={[styles.icon, bounce]} />
      {buzz && (
        <View style={styles.buzz}>
          <Text style={styles.buzzText}>{`🔥 ${t('review.trending')}`}</Text>
        </View>
      )}
    </View>
  );
}

const readCombo = (s: GameState) => ({ combo: s.combo, left: ECONOMY.comboWindowSeconds - (s.time - s.lastPayTime) });

/** "x3 combo" under the coins while payments keep chaining; it pulses, then fades out. */
function ComboBadge({ gameRef, layout }: { gameRef: GameRef; layout: HudLayout }) {
  const t = useT();
  const combo = usePoll(gameRef, readCombo, 4);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 260 }), withTiming(1, { duration: 260 })), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (!combo || combo.combo < 2 || combo.left <= 0) return null;
  return (
    <Animated.View style={[styles.slot, styles.combo, pulseStyle, { left: layout.left + 6, top: layout.top + HUD.height + 8, opacity: Math.min(1, combo.left / 1.5) }]}>
      <Text style={styles.comboX}>{`x${combo.combo}`}</Text>
      <Text style={styles.comboWord}>{t('ui.combo')}</Text>
    </Animated.View>
  );
}

interface Props {
  gameRef: GameRef;
  feed: SharedValue<HudFeed>;
  layout: HudLayout;
}

/** Coins on the left and the rating on the right in both languages: coins fly to fixed spots. */
export function Hud({ gameRef, feed, layout }: Props) {
  return (
    <View style={styles.root} pointerEvents="none">
      <CoinPill gameRef={gameRef} feed={feed} layout={layout} />
      <DayPill gameRef={gameRef} layout={layout} />
      <RatingPill gameRef={gameRef} feed={feed} layout={layout} />
      <ComboBadge gameRef={gameRef} layout={layout} />
    </View>
  );
}

const DAY_W = 124;
const RIM = '#F2C14E';
/** Room on a pill's left end for the icon that sits on it. */
const UNDER_ICON = HUD.icon - HUD.iconOut + 2;

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, direction: 'ltr' },
  slot: { position: 'absolute' },
  pill: {
    height: HUD.height,
    borderRadius: HUD.height / 2,
    backgroundColor: 'rgba(40,16,50,0.93)',
    borderWidth: 2.5,
    borderColor: RIM,
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 3px 0px rgba(18,8,24,0.85)',
  },
  shine: { position: 'absolute', left: 8, right: 8, top: 3, height: HUD.height / 2 - 6, borderRadius: HUD.height / 4, backgroundColor: 'rgba(255,255,255,0.13)' },
  icon: { position: 'absolute', left: -HUD.iconOut, top: (HUD.height - HUD.icon) / 2, width: HUD.icon, height: HUD.icon },
  coinPill: { minWidth: 96, paddingStart: UNDER_ICON, paddingEnd: 16 },
  coins: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 0.3, ...textShadow('rgba(10,4,14,0.9)', 2, 0) },
  daySlot: { width: DAY_W },
  dayPill: { paddingHorizontal: 12, paddingBottom: 3 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dayIcon: { width: 28, height: 28 },
  dayLabel: { color: '#FFE9A8', fontSize: 13, fontWeight: '800', ...textShadow('rgba(10,4,14,0.9)', 1, 0) },
  dayNumber: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', ...textShadow('rgba(10,4,14,0.9)', 2, 0) },
  track: { position: 'absolute', left: 14, right: 14, bottom: 3, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2, backgroundColor: '#FFB547' },
  trackNight: { backgroundColor: '#A9A4FF' },
  trackGold: { backgroundColor: '#FFD23F' },
  ratingTrack: { left: UNDER_ICON - 2 },
  ratingPill: { width: HUD.ratingWidth, paddingStart: UNDER_ICON, paddingBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  rating: { color: '#FFE27A', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], ...textShadow('rgba(10,4,14,0.9)', 2, 0) },
  outOf: { color: '#C9B3D6', fontSize: 12, fontWeight: '800' },
  buzz: { position: 'absolute', top: HUD.height + 4, right: 0, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 11, backgroundColor: '#E5483B', borderWidth: 2, borderColor: '#FFE08A' },
  buzzText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  combo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#FF7A1A',
    borderWidth: 2,
    borderColor: '#FFE08A',
    boxShadow: '0px 2px 0px rgba(18,8,24,0.85)',
  },
  comboX: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', ...textShadow('rgba(90,30,0,0.9)', 2, 0) },
  comboWord: { color: '#FFF4E3', fontSize: 12, fontWeight: '900' },
});
