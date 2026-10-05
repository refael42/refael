import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { NAMES } from '../data/names';
import { useT } from '../i18n';
import { HUD, type HudLayout } from '../render/draw/hud';
import { hudIcon } from '../render/icons';
import { formatBig } from '../sim/format';
import type { GameState, Review } from '../sim/game/types';
import { useSettings } from '../store/settings';
import { gold, panel, textShadow } from './theme';

// A customer's review slides in under the rating for a few seconds: their stars, what they
// wrote, their name, and the bonus a good one brought.

const WIDTH = 252;
const SHOW_MS = 5200;
const POLL_MS = 300;

interface Props {
  gameRef: { current: GameState | null };
  layout: HudLayout;
  /** Pushed further down while the tutorial's message is up there. */
  lowered: boolean;
}

export function ReviewToast({ gameRef, layout, lowered }: Props) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [review, setReview] = useState<Review | null>(null);
  // Only reviews written from now on: none of the old ones pop up when the game opens.
  const seen = useRef<number | null>(null);
  const slide = useSharedValue(1);

  useEffect(() => {
    const timer = setInterval(() => {
      const newest = gameRef.current?.reviews.at(-1);
      if (seen.current === null) seen.current = newest?.id ?? 0;
      if (!newest || newest.id <= seen.current) return;
      seen.current = newest.id;
      setReview(newest);
      slide.value = withSequence(
        withTiming(1, { duration: 0 }),
        withSpring(0, { damping: 13, stiffness: 140 }),
        withDelay(SHOW_MS, withTiming(1, { duration: 260, easing: Easing.in(Easing.quad) })),
      );
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [gameRef, slide]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - slide.value, transform: [{ translateX: slide.value * (WIDTH + 30) }] }));

  if (!review) return null;
  const name = NAMES[review.name];
  const bonus = review.bonus.gt(0);
  return (
    <Animated.View
      style={[styles.card, review.stars >= 4 && styles.good, review.stars <= 2 && styles.bad, { left: layout.right - WIDTH, top: layout.top + HUD.height + (lowered ? 66 : 34) }, style]}
      pointerEvents="none"
    >
      <View style={styles.head}>
        <Text style={styles.stars}>
          <Text style={styles.on}>{'★'.repeat(review.stars)}</Text>
          <Text style={styles.off}>{'★'.repeat(5 - review.stars)}</Text>
        </Text>
        <Text style={styles.label}>{t('review.new')}</Text>
      </View>
      <Text style={styles.quote}>{`“${t(`review.${review.stars}.${review.line}`)}”`}</Text>
      <View style={styles.foot}>
        {name && <Text style={styles.name}>{`— ${name[lang]}`}</Text>}
        {bonus && (
          <View style={styles.bonus}>
            <Image source={{ uri: hudIcon('hudCoin', Math.round(16 * PixelRatio.get())) }} style={styles.coin} />
            <Text style={styles.bonusText}>{`+${formatBig(review.bonus)}`}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: WIDTH,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
    borderRadius: 16,
    backgroundColor: panel.bg,
    borderWidth: 2.5,
    borderColor: '#8A6A9A',
    boxShadow: '0px 4px 0px #120818',
  },
  good: { borderColor: gold },
  bad: { borderColor: '#E5483B' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { fontSize: 17, letterSpacing: 1 },
  on: { color: '#FFD23F' },
  off: { color: '#5A4E66' },
  label: { color: '#C9B3D6', fontSize: 11, fontWeight: '800' },
  quote: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', ...textShadow('#120818', 1, 0) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: '#E8D7F0', fontSize: 12, fontWeight: '700' },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(53,185,87,0.25)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  coin: { width: 16, height: 16 },
  bonusText: { color: '#9CF5A8', fontSize: 13, fontWeight: '900' },
});
