import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PAX_TYPES } from '../../data/paxTypes';
import { REVIEWS } from '../../data/reviews';
import { FIRST_NAMES } from '../../data/staff';
import { useDir, useLang, useT, type TKey } from '../../i18n';
import { Big, formatBig, formatDuration, RATING_PARTS, ratingParts, reviewAverage, weakestPart, type Command, type GameState } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { GuideTab, PAX_COLOR } from './GuideTab';
import { Sheet } from './Sheet';

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((k) => (
        <View key={k} style={{ opacity: n >= k - 0.25 ? 1 : 0.22 }}>
          <Icon name="star" size={size} />
        </View>
      ))}
    </View>
  );
}

/** The rating and what it is made of, the passengers' reviews (with a bonus for good ones) and the Aviation Guide. */
export function RatingPanel({ state, onClose, send, initialTab = 0, onShow }: { state: GameState; rev: number; onClose: () => void; send: (c: Command) => void; initialTab?: number; onShow?: (personId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const [tab, setTab] = useState(initialTab);
  const parts = ratingParts(state);
  const weak = weakestPart(parts);
  const avg = reviewAverage(state);
  const bonus = Math.floor(state.reviewBonus);
  return (
    <Sheet title={t('rating.title')} subtitle={t('rating.sub', { n: state.rating.toFixed(1) })} onClose={onClose}>
      <View style={[styles.tabs, { flexDirection: dir.row }]}>
        {[t('rating.tab.rating'), t('rating.tab.reviews', { n: state.reviews.length }), t('rating.tab.guide')].map((label, i) => (
          <Pressable key={i} onPress={() => setTab(i)} style={[styles.tab, tab === i && styles.tabOn]} accessibilityRole="tab" testID={`rating-tab-${i}`}>
            <Text style={[styles.tabText, tab === i && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 0 ? (
        <>
          <View style={[styles.stars, { flexDirection: dir.row }]} testID="rating-stars">
            <Stars n={state.rating} size={30} />
          </View>
          {RATING_PARTS.map((k) => {
            const v = parts[k];
            const color = v >= 0.8 ? C.green : v >= 0.5 ? '#f59e0b' : C.red;
            return (
              <View key={k} style={styles.part} testID={`rating-${k}`}>
                <View style={[styles.row, { flexDirection: dir.row }]}>
                  <Text style={[styles.label, ta, { flex: 1 }]}>{t(`rating.${k}` as TKey)}</Text>
                  <Text style={[styles.pct, { color }]}>{Math.round(v * 100)}%</Text>
                </View>
                <View style={[styles.bar, { flexDirection: dir.row }]}>
                  <View style={[styles.fill, { width: `${Math.round(v * 100)}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}
          <View style={styles.tip}>
            <Text style={[styles.tipText, ta]}>{weak ? t(`rating.tip.${weak}` as TKey) : t('rating.tip.none')}</Text>
          </View>
        </>
      ) : tab === 2 ? (
        <GuideTab state={state} send={send} onShow={onShow} />
      ) : (
        <>
          <View style={[styles.summary, { flexDirection: dir.row }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.avg, ta]}>{state.reviews.length ? avg.toFixed(1) : '–'}</Text>
              <Stars n={avg} size={16} />
            </View>
            <Pressable
              disabled={bonus <= 0}
              onPress={() => send({ type: 'claimReviews' })}
              style={({ pressed }) => [styles.claim, bonus <= 0 && styles.claimOff, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              testID="reviews-claim"
            >
              <Icon name="coin" size={18} />
              <Text style={styles.claimText}>{bonus > 0 ? t('reviews.claim', { n: formatBig(Big.fromNumber(bonus)) }) : t('reviews.noBonus')}</Text>
            </Pressable>
          </View>
          {state.reviews.length === 0 ? <Text style={[styles.empty, ta]}>{t('reviews.empty')}</Text> : null}
          {state.reviews.map((r) => {
            const line = REVIEWS[r.line];
            const who = FIRST_NAMES[r.name] ?? FIRST_NAMES[0];
            return (
              <View key={r.id} style={styles.review} testID="review">
                <View style={[styles.row, { flexDirection: dir.row }]}>
                  <View style={[styles.avatar, { backgroundColor: PAX_COLOR[PAX_TYPES[r.pax]?.id] ?? '#94a3b8' }]}>
                    <Text style={styles.avatarText}>{(lang === 'he' ? who.he : who.en).slice(0, 1)}</Text>
                  </View>
                  <Text style={[styles.name, ta, { flex: 1 }]} numberOfLines={1}>
                    {lang === 'he' ? who.he : who.en} · {r.flight}
                  </Text>
                  <Stars n={r.stars} />
                </View>
                <Text style={[styles.text, ta]}>{lang === 'he' ? line.he : line.en}</Text>
                <Text style={[styles.ago, ta]}>{t('reviews.ago', { t: formatDuration(Math.max(0, state.time - r.at)) })}</Text>
              </View>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.06)', alignItems: 'center' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: C.text },
  tabTextOn: { color: '#ffffff' },
  stars: { justifyContent: 'center', marginBottom: 14 },
  part: { marginBottom: 12 },
  row: { alignItems: 'center', marginBottom: 6, gap: 8 },
  label: { fontSize: 15, fontWeight: '700', color: C.text },
  pct: { fontSize: 15, fontWeight: '800', marginHorizontal: 6 },
  bar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  tip: { marginTop: 6, padding: 12, borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.08)' },
  tipText: { fontSize: 14, color: C.text, lineHeight: 20 },
  summary: { alignItems: 'center', gap: 10, marginBottom: 12 },
  avg: { fontSize: 28, fontWeight: '800', color: C.text },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: C.green },
  claimOff: { backgroundColor: 'rgba(15,23,42,0.12)' },
  claimText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  empty: { fontSize: 14, color: C.textDim, marginVertical: 8 },
  review: { padding: 12, borderRadius: 16, backgroundColor: 'rgba(15,23,42,0.04)', marginBottom: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  name: { fontSize: 13, fontWeight: '700', color: C.textDim },
  text: { fontSize: 15, color: C.text, lineHeight: 21 },
  ago: { fontSize: 12, color: C.textDim, marginTop: 4 },
});
