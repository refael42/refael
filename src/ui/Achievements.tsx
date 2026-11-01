import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { ACHIEVEMENT, ACHIEVEMENTS } from '../data/achievements';
import { useT } from '../i18n';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { achievementsReady, medals } from '../sim/achievements';
import { formatNumber } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { GameIcon, IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// Achievements (owner: idea 11): a trophy button in the events row (a badge for medals waiting)
// and a page of sixteen achievements, each with its bronze, silver and gold medal, how far the
// next one is, and the medal's gems to take.

const MEDAL = ['#C77B3A', '#A9B4C2', '#E5A800'] as const;

const readChip = (s: GameState) => ({ ready: achievementsReady(s), gold: ACHIEVEMENTS.filter((a) => medals(s, a.id) >= 3).length });

export function AchievementsChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  if (!d) return null;
  return <SideButton label="achievements" icon={hudIcon('hudTrophy', Math.round(SIDE.icon * PixelRatio.get()))} caption={t('ach.button')} ready={d.ready > 0} badge={d.ready > 0 ? d.ready : undefined} onPress={onPress} style={style} />;
}

export const achievementsWaiting = (s: GameState): number => achievementsReady(s);

const readPanel = (s: GameState) => ACHIEVEMENTS.map((a) => `${s.achievements.value[a.id] ?? 0}:${medals(s, a.id)}:${s.achievements.taken[a.id] ?? 0}`).join('|');

export function AchievementsPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPanel, 2);
  if (d === null) return null;
  const rows = d.split('|').map((r) => r.split(':').map(Number) as [number, number, number]);
  const total = rows.reduce((n, r) => n + r[1], 0);
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <GameIcon name="hudTrophy" size={36} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('ach.title')}</Text>
          <Text style={styles.sub}>{t('ach.medals').replace('{n}', String(total)).replace('{m}', String(ACHIEVEMENTS.length * 3))}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.rows}>
        {ACHIEVEMENTS.map((a, i) => {
          const [value, got, taken] = rows[i]!;
          const goal = a.goals[Math.min(2, got)]!;
          const shown = (n: number) => formatNumber(a.power ? 10 ** n : n);
          const prev = got === 0 ? 0 : a.goals[got - 1]!;
          const share = got >= 3 ? 1 : Math.max(0, Math.min(1, (value - prev) / Math.max(1, goal - prev)));
          return (
            <View key={a.id} style={[styles.row, got >= 3 && styles.rowGold]}>
              <View style={styles.medals}>
                {MEDAL.map((col, k) => (
                  <View key={k} style={[styles.medal, { backgroundColor: k < got ? col : '#3A2A44', borderColor: k < got ? '#FFF4E3' : '#5A4A62' }]} />
                ))}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{t(`ach.name.${a.id}`)}</Text>
                <Text style={styles.desc}>{t(`ach.desc.${a.id}`).replace('{n}', shown(goal))}</Text>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: MEDAL[Math.min(2, got)] }]} />
                </View>
                <Text style={styles.count}>{got >= 3 ? t('ach.done') : `${shown(Math.min(value, goal))} / ${shown(goal)}`}</Text>
              </View>
              {taken < got && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`claim-${a.id}`}
                  onPress={() => {
                    tapFeedback();
                    onCommand({ type: 'achievement', id: a.id });
                  }}
                  style={styles.take}
                >
                  <IconText icon="hudGem" size={14} textStyle={styles.takeText}>{`+${ACHIEVEMENT.gems[taken]}`}</IconText>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 560, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: '#E5A800', overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#8A6A1A' },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#FFF4E3', fontSize: 13, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  rows: { padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  rowGold: { borderWidth: 1.5, borderColor: '#E5A800' },
  medals: { flexDirection: 'row', gap: 3 },
  medal: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  rowText: { flex: 1, gap: 2 },
  name: { color: '#FFF4E3', fontSize: 14, fontWeight: '900' },
  desc: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#24142A', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  count: { color: '#9A86A8', fontSize: 10.5, fontWeight: '800' },
  take: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  takeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
