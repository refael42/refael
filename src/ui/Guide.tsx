import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GUIDE, verdictOf } from '../data/guide';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { scoreOf, scoreParts } from '../sim/game/guide';
import type { GameState } from '../sim/game/types';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The restaurant guide on screen (owner M29: "Michelin logic"): a chip under the stars with the
// guide's mark, a page that explains how inspectors judge and how the kitchen stands, and a card
// when a new edition comes out.

/** The guide's mark: red rosettes for stars, the plate for "recommended". */
export const rosettes = (stars: number, plate: boolean): string => (stars > 0 ? '✿'.repeat(stars) : plate ? '🍽' : '—');

const readChip = (s: GameState) => ({
  stars: s.guide.stars,
  plate: s.guide.plate,
  // Days until the next edition.
  days: GUIDE.everyDays - (s.day % GUIDE.everyDays),
});

export function GuideChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  if (!d) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="guide" onPress={onPress} hitSlop={6} style={[styles.chip, d.stars > 0 && styles.chipStarred, style]}>
      <Text style={styles.chipIcon}>📕</Text>
      <View style={styles.chipBody}>
        <Text numberOfLines={1} style={styles.chipTitle}>{t('guide.name')}</Text>
        <Text numberOfLines={1} style={[styles.chipMark, d.stars > 0 && styles.chipMarkStar]}>{d.stars > 0 || d.plate ? rosettes(d.stars, d.plate) : t('guide.chipNone')}</Text>
      </View>
    </Pressable>
  );
}

const PARTS = ['chef', 'mastery', 'equipment', 'ingredients', 'temperature', 'consistency'] as const;
const PART_ICON: Record<(typeof PARTS)[number], string> = { chef: '👨‍🍳', mastery: '📜', equipment: '🔥', ingredients: '🥬', temperature: '♨️', consistency: '🎯' };

const readPage = (s: GameState) => {
  const parts = scoreParts(s, null, s.time + GUIDE.hotSeconds);
  return {
    stars: s.guide.stars,
    plate: s.guide.plate,
    edition: s.guide.edition,
    days: GUIDE.everyDays - (s.day % GUIDE.everyDays),
    visits: s.guide.visits.map((v) => `${v.day}:${verdictOf(v.score)}`).join('|'),
    last: s.guide.last ? `${s.guide.last.stars}|${s.guide.last.change}|${s.guide.last.visits}|${s.guide.last.plate ? 1 : 0}` : '',
    now: scoreOf(s, null, s.time + GUIDE.hotSeconds),
    ...Object.fromEntries(PARTS.map((k) => [k, Math.round(parts[k] * 100)])),
  } as Record<string, string | number | boolean>;
};

export function GuidePanel({ gameRef, onClose }: { gameRef: { current: GameState | null }; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPage, 1);
  if (!d) return null;
  const stars = d.stars as number;
  const visits = (d.visits as string) ? (d.visits as string).split('|').map((v) => v.split(':') as [string, string]) : [];
  const need = stars < 3 ? GUIDE.starScore[stars]! : null;
  const last = (d.last as string) ? (d.last as string).split('|').map(Number) : null;
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`📕 ${t('guide.name')}`}</Text>
        <View style={styles.grow} />
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
        <View style={styles.markRow}>
          <Text style={[styles.mark, stars > 0 && styles.markStar]}>{rosettes(stars, d.plate as boolean)}</Text>
          <View style={styles.grow}>
            <Text style={styles.markText}>{t(stars > 0 ? `guide.stars${stars}` : d.plate ? 'guide.plate' : 'guide.none')}</Text>
            <Text style={styles.small}>{t('guide.next').replace('{n}', String(d.days))}</Text>
          </View>
        </View>
        {last && (
          <Text style={styles.small}>{`${t('guide.lastEdition')} ${t(last[1]! > 0 ? 'guide.won' : last[1]! < 0 ? 'guide.lost' : 'guide.kept')} (${last[2]} ${t('guide.visits')})`}</Text>
        )}
        <Text style={styles.section}>{t('guide.thisEdition')}</Text>
        {visits.length === 0 ? (
          <Text style={styles.small}>{t('guide.noVisits')}</Text>
        ) : (
          visits.map(([day, verdict], i) => (
            <View key={i} style={styles.visit}>
              <Text style={styles.visitDay}>{`🕵️ ${t('guide.day')} ${day}`}</Text>
              <Text style={styles.visitText}>{t(verdict)}</Text>
            </View>
          ))
        )}
        <Text style={styles.section}>{t('guide.judged')}</Text>
        {PARTS.map((k) => (
          <View key={k} style={styles.part}>
            <Text style={styles.partIcon}>{PART_ICON[k]}</Text>
            <View style={styles.grow}>
              <Text style={styles.partName}>{t(`guide.part.${k}`)}</Text>
              <View style={styles.barBack}>
                <View style={[styles.barFill, { width: `${d[k] as number}%` }, (d[k] as number) >= 80 ? styles.barGood : (d[k] as number) >= 55 ? styles.barMid : styles.barLow]} />
              </View>
            </View>
            <Text style={styles.partTip}>{t(`guide.tip.${k}`)}</Text>
          </View>
        ))}
        <Text style={styles.small}>{need !== null ? t('guide.now').replace('{now}', String(d.now)).replace('{need}', String(need)) : t('guide.top')}</Text>
        <Text style={styles.section}>{t('guide.howTitle')}</Text>
        <Text style={styles.how}>{t('guide.how')}</Text>
      </ScrollView>
    </Overlay>
  );
}

/** A new edition is out: the stars won (or lost), big, for a few seconds. */
export function GuideEdition({ stars, change, plate, onClose }: { stars: number; change: number; plate: boolean; onClose: () => void }) {
  const t = useT();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSequence(withTiming(0, { duration: 1 }), withSpring(1, { damping: 9, stiffness: 140 }));
    const id = setTimeout(onClose, 6500);
    return () => clearTimeout(id);
  }, [pop, onClose]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.4), transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  const [spin] = useState(() => Math.random());
  const title = change > 0 ? (stars === 1 ? 'guide.firstStar' : 'guide.moreStars') : change < 0 ? 'guide.lostStar' : plate && stars === 0 ? 'guide.plateIn' : 'guide.keptTitle';
  return (
    <Pressable style={styles.editionWrap} onPress={onClose}>
      <Animated.View style={[styles.edition, change < 0 && styles.editionSad, style]}>
        <Text style={styles.editionKicker}>{`📕 ${t('guide.newEdition')}`}</Text>
        <Text style={[styles.editionMark, { transform: [{ rotate: `${(spin - 0.5) * 6}deg` }] }]}>{rosettes(stars, plate)}</Text>
        <Text style={styles.editionTitle}>{t(title)}</Text>
        <Text style={styles.small}>{t(stars > 0 ? `guide.stars${stars}` : plate ? 'guide.plate' : 'guide.none')}</Text>
      </Animated.View>
    </Pressable>
  );
}

const RED = '#C8102E';

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 6, paddingEnd: 8, height: 40, borderRadius: 14, backgroundColor: 'rgba(42,21,48,0.93)', borderWidth: 2, borderColor: '#8A6A9A', boxShadow: '0px 2px 0px rgba(18,8,24,0.85)' },
  chipStarred: { borderColor: '#FF6A7A', backgroundColor: 'rgba(90,10,26,0.95)' },
  chipIcon: { fontSize: 20 },
  chipBody: { width: 86, gap: 1 },
  chipTitle: { color: '#FFE9A8', fontSize: 11.5, fontWeight: '900' },
  chipMark: { color: '#C9B3D6', fontSize: 11, fontWeight: '900' },
  chipMarkStar: { color: '#FF8A98', fontSize: 14 },
  card: { width: 620, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  grow: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { gap: 8, paddingBottom: 4 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: panel.row, borderRadius: 14, padding: 10 },
  mark: { color: '#C9B3D6', fontSize: 30, fontWeight: '900', minWidth: 60, textAlign: 'center' },
  markStar: { color: RED, ...textShadow('#FFE9A8', 0, 0) },
  markText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  small: { color: '#C9B3D6', fontSize: 12.5, fontWeight: '700' },
  section: { color: '#FFE9A8', fontSize: 14, fontWeight: '900', marginTop: 4 },
  visit: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  visitDay: { color: '#FFE9A8', fontSize: 12.5, fontWeight: '900' },
  visitText: { flex: 1, color: '#F2E6F7', fontSize: 12.5, fontWeight: '700' },
  part: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  partIcon: { fontSize: 18 },
  partName: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  partTip: { width: 200, color: '#C9B3D6', fontSize: 11, fontWeight: '700' },
  barBack: { height: 6, borderRadius: 3, backgroundColor: '#1E0E24', marginTop: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barGood: { backgroundColor: '#3DDC6A' },
  barMid: { backgroundColor: '#F2C14E' },
  barLow: { backgroundColor: '#E5483B' },
  how: { color: '#E8D7F0', fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  editionWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,6,18,0.45)' },
  edition: { width: 340, maxWidth: '90%', alignItems: 'center', gap: 6, backgroundColor: '#FFF8EC', borderRadius: 22, borderWidth: 4, borderColor: RED, paddingVertical: 16, paddingHorizontal: 18, boxShadow: '0px 6px 0px #5A0A1A' },
  editionSad: { borderColor: '#7E8A98' },
  editionKicker: { color: RED, fontSize: 14, fontWeight: '900' },
  editionMark: { color: RED, fontSize: 46, fontWeight: '900' },
  editionTitle: { color: '#2A1530', fontSize: 20, fontWeight: '900', textAlign: 'center' },
});
