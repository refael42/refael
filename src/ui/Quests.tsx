import { useEffect } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import type { QuestGoal } from '../data/quests';
import { useT } from '../i18n';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { formatBig, formatNumber } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { progressOf, questLevel } from '../sim/quests';
import { useSettings } from '../store/settings';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';
import { buzz } from '../audio/sound';

// Quests (owner request): the restaurant's level and its list of goals. A goal that is done
// waits to be claimed; claiming the last one levels the restaurant up.

type GameRef = { current: GameState | null };

interface GoalView {
  goal: QuestGoal;
  have: number;
  need: number;
  claimed: boolean;
}

const readQuests = (s: GameState) => {
  const def = questLevel(s.quests.level);
  const goals: GoalView[] = def.goals.map((goal, i) => ({ goal, ...progressOf(goal, s), claimed: s.quests.claimed.includes(i) }));
  return { level: s.quests.level, reward: def.reward, goals };
};

/** How many goals are done and waiting to be claimed. */
const readReady = (s: GameState) => {
  const q = readQuests(s);
  return { level: q.level, ready: q.goals.filter((g) => !g.claimed && g.have >= g.need).length };
};

/** A goal as separate words (numbers apart from Hebrew text, so bidi keeps the order). */
function GoalText({ goal }: { goal: QuestGoal }) {
  const t = useT();
  const n = (v: number) => formatNumber(v);
  const parts: { text: string; strong?: boolean }[] = (() => {
    switch (goal.kind) {
      case 'upgrade':
        return [{ text: t('quest.upgrade') }, { text: t(`up.${goal.item}`), strong: true }, { text: t('quest.toLevel') }, { text: n(goal.level), strong: true }];
      case 'serve':
        return [{ text: t('quest.serve') }, { text: n(goal.count), strong: true }, { text: t('quest.customers') }];
      case 'earn':
        return [{ text: t('quest.earn') }, { text: n(goal.amount), strong: true }, { text: t('quest.coins') }];
      case 'hire':
        return [{ text: t('quest.hire') }, { text: t(`role.${goal.role}`), strong: true }];
      case 'team':
        return [{ text: t('quest.team') }, { text: n(goal.count), strong: true }, { text: t('quest.people') }];
      case 'rating':
        return [{ text: t('quest.rating') }, { text: goal.stars.toFixed(1), strong: true }, { text: '★' }];
      case 'tables':
        return [{ text: t('quest.tables') }, { text: n(goal.count), strong: true }, { text: t('quest.tablesWord') }];
      case 'reviews':
        return [{ text: t('quest.reviews') }, { text: n(goal.count), strong: true }, { text: t('quest.fiveStar') }];
      case 'decor':
        return [{ text: t('quest.decor') }, { text: n(goal.count), strong: true }, { text: t('quest.decorWord') }];
      case 'rush':
        return [{ text: t('quest.rush') }, { text: n(goal.count), strong: true }, { text: t('quest.times') }];
      case 'combo':
        return [{ text: t('quest.combo') }, { text: `x${goal.count}`, strong: true }];
      case 'building':
        return [{ text: t('quest.open') }, { text: t(`tier.${TIERS[goal.tier]?.id ?? 'bistro'}`), strong: true }];
    }
  })();
  return (
    <View style={styles.goalText}>
      {parts.map((p, i) => (
        <Text key={i} style={p.strong ? styles.strong : styles.word}>
          {p.text}
        </Text>
      ))}
    </View>
  );
}

/** Progress numbers: the rating with its decimal, everything else whole and short. */
const amount = (goal: QuestGoal, v: number) => (goal.kind === 'rating' ? (Math.floor(v * 10) / 10).toFixed(1) : formatNumber(v));

const coinUri = () => hudIcon('hudCoin', Math.round(18 * PixelRatio.get()));

/** The scroll button in the corner: the level, and a dot when a reward is waiting. */
export function QuestButton({ gameRef, onPress, style }: { gameRef: GameRef; onPress: () => void; style: object }) {
  const t = useT();
  const q = usePoll(gameRef, readReady, 2);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (q && q.ready > 0) pulse.value = withSequence(withTiming(1.15, { duration: 160 }), withSpring(1, { damping: 6 }));
  }, [q?.ready, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (!q) return null;
  return (
    <Animated.View style={[styles.buttonWrap, style, pulseStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="quests" onPress={onPress} hitSlop={6} style={styles.button}>
        <Text style={styles.scroll}>📜</Text>
        <Text style={styles.buttonLevel}>{`${t('quest.stage')} ${q.level}`}</Text>
      </Pressable>
      {q.ready > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{q.ready}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export function QuestPanel({ gameRef, onCommand, onClose }: { gameRef: GameRef; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const q = usePoll(gameRef, readQuests, 4);
  if (!q) return null;
  const done = q.goals.filter((g) => g.claimed).length;
  return (
    <Overlay onClose={onClose} card={styles.card} dim="rgba(14,6,18,0.55)">
        <View style={styles.header}>
          <Text style={styles.title}>{t('quest.title')}</Text>
          <Text style={styles.level}>{q.level}</Text>
          <View style={styles.grow} />
          <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
            <Text style={styles.closeText}>{'✕'}</Text>
          </Pressable>
        </View>
        <View style={styles.levelBar}>
          <View style={[styles.levelFill, { width: `${(done / q.goals.length) * 100}%` }]} />
        </View>
        <ScrollView style={scrollFill} contentContainerStyle={styles.list}>
          {q.goals.map((g, i) => {
            const ready = !g.claimed && g.have >= g.need;
            const share = Math.max(0, Math.min(1, g.have / g.need));
            return (
              <View key={i} style={[styles.row, ready && styles.rowReady, g.claimed && styles.rowDone]}>
                <View style={styles.rowBody}>
                  <GoalText goal={g.goal} />
                  <View style={styles.progressLine}>
                    <View style={styles.bar}>
                      <View style={[styles.barFill, ready || g.claimed ? styles.barDone : null, { width: `${share * 100}%` }]} />
                    </View>
                    <Text style={styles.count}>{`${amount(g.goal, Math.min(g.have, g.need))}/${amount(g.goal, g.need)}`}</Text>
                  </View>
                </View>
                {g.claimed ? (
                  <Text style={styles.doneText}>{`✓ ${t('quest.claimed')}`}</Text>
                ) : (
                  <Pressable accessibilityRole="button" disabled={!ready} onPress={() => {
                      buzz('light');
                      onCommand({ type: 'claim', quest: i });
                    }} style={[styles.claim, !ready && styles.claimOff]}>
                    <Image source={{ uri: coinUri() }} style={styles.coin} />
                    <Text style={styles.claimText}>{ready ? t('quest.claim') : formatBig(q.reward)}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Text style={styles.note}>{t('quest.levelBonus')}</Text>
        </ScrollView>
    </Overlay>
  );
}

/**
 * A card that pops and fades (confetti comes from the canvas): the next stage, or (`rank`) the
 * next restaurant level and how far the upgrades go now.
 */
export function LevelBanner({ level, onDone, rank }: { level: number; onDone: () => void; rank?: { opens: number } }) {
  const t = useT();
  const restaurant = useSettings((s) => s.profile?.restaurant);
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSequence(withSpring(1, { damping: 8, stiffness: 160 }), withDelay(1800, withTiming(0, { duration: 300 })));
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [pop, onDone]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <Animated.View style={[styles.banner, popStyle]}>
        <Text style={styles.bannerTop}>{t(rank ? 'ui.rankUp' : 'quest.levelUp')}</Text>
        {restaurant && <Text style={styles.bannerName}>{restaurant}</Text>}
        <View style={styles.bannerLine}>
          <Text style={styles.bannerSmall}>{t(rank ? 'ui.rankNow' : 'quest.title')}</Text>
          <Text style={styles.bannerBig}>{level}</Text>
        </View>
        {rank && (
          <View style={styles.bannerLine}>
            <Text style={styles.bannerSmall}>{t('ui.rankUpOpens')}</Text>
            <Text style={styles.bannerSmall}>{rank.opens}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { position: 'absolute' },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3A1D40',
    borderWidth: 2.5,
    borderColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 0px #120818',
  },
  scroll: { fontSize: 20, marginTop: 2 },
  buttonLevel: { color: '#FFE9A8', fontSize: 9, fontWeight: '900', marginTop: -2 },
  badge: {
    position: 'absolute',
    top: -5,
    end: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: '#35B957',
    borderWidth: 2,
    borderColor: '#FFF4E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  card: {
    width: 440,
    maxWidth: '92%',
    maxHeight: '92%',
    backgroundColor: panel.bg,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: gold,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    boxShadow: '0px 6px 0px #120818',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#FFE9A8', fontSize: 19, fontWeight: '900' },
  level: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', ...textShadow('#120818', 2, 0) },
  grow: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  levelBar: { height: 8, borderRadius: 4, backgroundColor: '#1C0E22', overflow: 'hidden', marginVertical: 8 },
  levelFill: { height: 8, backgroundColor: gold },
  list: { gap: 8, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 14, padding: 10, borderWidth: 2, borderColor: 'transparent' },
  rowReady: { borderColor: '#7EE08F' },
  rowDone: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 5 },
  goalText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4 },
  word: { color: '#F3E6FA', fontSize: 14, fontWeight: '700' },
  strong: { color: '#FFE27A', fontSize: 14, fontWeight: '900' },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1C0E22', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#C9B3D6' },
  barDone: { backgroundColor: '#5CD66E' },
  count: { color: '#C9B3D6', fontSize: 11, fontWeight: '800', minWidth: 54, textAlign: 'right' },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8' },
  claimOff: { backgroundColor: '#4A3A52', borderColor: '#6A5A72' },
  claimText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  coin: { width: 18, height: 18 },
  doneText: { color: '#7EE08F', fontWeight: '900', fontSize: 13 },
  note: { color: '#C9B3D6', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  bannerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  banner: {
    backgroundColor: panel.bg,
    borderColor: gold,
    borderWidth: 3,
    borderRadius: 22,
    paddingHorizontal: 34,
    paddingVertical: 12,
    alignItems: 'center',
    boxShadow: '0px 6px 0px #120818',
  },
  bannerTop: { color: '#7EE08F', fontSize: 20, fontWeight: '900' },
  bannerName: { color: gold, fontSize: 14, fontWeight: '900' },
  bannerLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bannerSmall: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  bannerBig: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', ...textShadow('#120818', 3, 0) },
});
