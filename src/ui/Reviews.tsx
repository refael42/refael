import { useEffect, useMemo, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { tapFeedback } from '../audio/sound';
import { dishDef } from '../data/dishes';
import { NAMES } from '../data/names';
import { useT } from '../i18n';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import { unclaimedBonus } from '../sim/game/reviews';
import type { Command, GameState, Review } from '../sim/game/types';
import { useSettings } from '../store/settings';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The reviews page (owner: "customer feedback off the screen, on a page of its own where you
// claim the money and read what they wrote; good and bad, by the service"). A chip under the
// rating shows how many bonuses wait; the page lists every review, newest first.

const coinUri = (px: number) => hudIcon('hudCoin', Math.round(px * PixelRatio.get()));

/** What the chip shows (plain values: the poll re-renders only when one changes). */
const readChip = (s: GameState) => {
  let waiting = 0;
  let stars = 0;
  for (const r of s.reviews) {
    if (!r.claimed) waiting++;
    stars += r.stars;
  }
  return { count: s.reviews.length, waiting, avg: s.reviews.length ? stars / s.reviews.length : 0, coins: formatBig(unclaimedBonus(s)) };
};

/** The page's signature: the list is rebuilt only when a review comes or is taken. */
const readPage = (s: GameState) => ({ ...readChip(s), last: s.reviewSeq });

function Stars({ n, size }: { n: number; size: number }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }}>
      <Text style={styles.on}>{'★'.repeat(n)}</Text>
      <Text style={styles.off}>{'★'.repeat(5 - n)}</Text>
    </Text>
  );
}

export function ReviewsChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  const pulse = useSharedValue(0);
  const ready = d !== null && d.waiting > 0 && d.coins !== '0';
  useEffect(() => {
    pulse.value = ready ? withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1) : 0;
  }, [pulse, ready]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.06 }] }));
  if (!d || d.count === 0) return null;
  return (
    <Animated.View style={[styles.chipWrap, style, pulseStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="reviews" onPress={onPress} hitSlop={6} style={[styles.chip, ready && styles.chipReady]}>
        <Text style={styles.chipIcon}>💬</Text>
        <View style={styles.chipBody}>
          <Text numberOfLines={1} style={styles.chipTitle}>{t('reviews.chip')}</Text>
          {ready ? (
            <View style={styles.chipCoins}>
              <Image source={{ uri: coinUri(13) }} style={styles.chipCoin} />
              <Text numberOfLines={1} style={styles.chipCoinText}>{`+${d.coins}`}</Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={styles.chipAvg}>{`★ ${d.avg.toFixed(1)}`}</Text>
          )}
        </View>
        {d.waiting > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{d.waiting}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

type Filter = 'all' | 'good' | 'bad';

export function ReviewsPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const d = usePoll(gameRef, readPage, 2);
  const [filter, setFilter] = useState<Filter>('all');
  // Rebuilt when a review comes in or a bonus is taken (the signature changes), not every poll.
  const rows = useMemo(() => [...(gameRef.current?.reviews ?? [])].reverse().map((r) => ({ ...r })), [gameRef, d?.last, d?.waiting]);
  if (!d) return null;
  const shown = rows.filter((r) => filter === 'all' || (filter === 'good' ? r.stars >= 4 : r.stars <= 2));
  const take = (id: number) => {
    tapFeedback();
    onCommand({ type: 'review', id });
  };
  const text = (r: Review) => t(`review.${r.kind}.${r.line}`).split('{dish}').join(t(dishDef(r.dish).nameKey));
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`💬 ${t('reviews.title')}`}</Text>
        <View style={styles.summary}>
          <Stars n={Math.round(d.avg)} size={16} />
          <Text style={styles.summaryText}>{`${t('reviews.avg')} ${d.avg.toFixed(1)} · ${t('reviews.count').replace('{n}', String(d.count))}`}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.bar}>
        {(['all', 'good', 'bad'] as const).map((f) => (
          <Pressable key={f} accessibilityRole="button" onPress={() => setFilter(f)} style={[styles.tab, filter === f && styles.tabOn]}>
            <Text style={[styles.tabText, filter === f && styles.tabTextOn]}>{t(f === 'all' ? 'reviews.all' : f === 'good' ? 'reviews.goodTab' : 'reviews.badTab')}</Text>
          </Pressable>
        ))}
        <View style={styles.grow} />
        {d.waiting > 0 && d.coins !== '0' && (
          <Pressable accessibilityRole="button" onPress={() => take(-1)} style={styles.takeAll}>
            <Text style={styles.takeText}>{t('reviews.takeAll')}</Text>
            <Image source={{ uri: coinUri(16) }} style={styles.coin} />
            <Text style={styles.takeText}>{`+${d.coins}`}</Text>
          </Pressable>
        )}
      </View>
      {shown.length === 0 ? (
        <Text style={styles.empty}>{t('reviews.empty')}</Text>
      ) : (
        <ScrollView style={scrollFill} contentContainerStyle={styles.list}>
          {shown.map((r) => {
            const name = NAMES[r.name];
            const hasBonus = r.bonus.gt(0);
            return (
              <View key={r.id} style={[styles.row, r.stars >= 4 && styles.rowGood, r.stars <= 2 && styles.rowBad]}>
                <View style={styles.rowMain}>
                  <View style={styles.rowHead}>
                    <Stars n={r.stars} size={15} />
                    <Text style={styles.meta}>{`${name ? name[lang] : ''} · ${t('reviews.day').replace('{n}', String(r.day))}`}</Text>
                  </View>
                  <Text style={styles.quote}>{`“${text(r)}”`}</Text>
                </View>
                {hasBonus &&
                  (r.claimed ? (
                    <Text style={styles.taken}>{`✓ ${t('reviews.taken')}`}</Text>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => take(r.id)} style={styles.take}>
                      <Image source={{ uri: coinUri(15) }} style={styles.coin} />
                      <Text style={styles.takeText}>{`+${formatBig(r.bonus)}`}</Text>
                    </Pressable>
                  ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  on: { color: '#FFD23F' },
  off: { color: '#5A4E66' },
  chipWrap: { position: 'absolute' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 6, paddingEnd: 8, height: 40, borderRadius: 14, backgroundColor: 'rgba(42,21,48,0.93)', borderWidth: 2, borderColor: '#8A6A9A', boxShadow: '0px 2px 0px rgba(18,8,24,0.85)' },
  chipReady: { borderColor: '#7EE08F', backgroundColor: 'rgba(22,70,36,0.95)' },
  chipIcon: { fontSize: 20 },
  chipBody: { width: 86, gap: 1 },
  chipTitle: { color: '#FFE9A8', fontSize: 11.5, fontWeight: '900' },
  chipAvg: { color: '#FFD23F', fontSize: 11, fontWeight: '900' },
  chipCoins: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipCoin: { width: 13, height: 13 },
  chipCoinText: { color: '#9CF5A8', fontSize: 11, fontWeight: '900' },
  badge: { position: 'absolute', top: -7, end: -7, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#E5483B', borderWidth: 2, borderColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  card: { width: 600, maxWidth: '94%', maxHeight: '92%', backgroundColor: panel.bg, borderRadius: 22, borderWidth: 3, borderColor: gold, padding: 12, gap: 8, boxShadow: '0px 6px 0px #120818' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: '#FFE9A8', fontSize: 22, fontWeight: '900', ...textShadow('#120818', 1, 0) },
  summary: { flexGrow: 1, gap: 1 },
  summaryText: { color: '#C9B3D6', fontSize: 12, fontWeight: '700' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A1D40', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tab: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: '#3A1D40', justifyContent: 'center' },
  tabOn: { backgroundColor: gold },
  tabText: { color: '#E8D7F0', fontSize: 13, fontWeight: '800' },
  tabTextOn: { color: '#2A1530' },
  grow: { flexGrow: 1 },
  takeAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 14, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', boxShadow: '0px 3px 0px #17602A' },
  list: { gap: 6, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 14, backgroundColor: 'rgba(58,29,64,0.85)', borderWidth: 2, borderColor: '#5A4E66' },
  rowGood: { borderColor: '#B8892A' },
  rowBad: { borderColor: '#A8322A', backgroundColor: 'rgba(70,22,30,0.85)' },
  rowMain: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700' },
  quote: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  take: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 12, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8' },
  takeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  taken: { color: '#9CF5A8', fontSize: 12, fontWeight: '800' },
  coin: { width: 16, height: 16 },
  empty: { color: '#C9B3D6', fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 24 },
});
