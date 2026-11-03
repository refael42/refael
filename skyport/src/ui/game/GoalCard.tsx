import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT, type TKey } from '../../i18n';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';

export interface GoalView {
  id: string;
  index: number;
  total: number;
  have: number;
  need: number;
  reward: string;
}

/**
 * The goal to work on now: what to do, how, how far along, the reward, and a
 * "show me" button that points the hand at the right button.
 */
export const GoalCard = memo(function GoalCard({
  goal,
  open,
  onToggle,
  onShow,
  onHelp,
}: {
  goal: GoalView;
  /** Full card, or a small chip that opens it. */
  open: boolean;
  onToggle: () => void;
  onShow: () => void;
  onHelp: () => void;
}) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const share = goal.need > 0 ? Math.min(1, goal.have / goal.need) : 0;
  if (!open) {
    return (
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.chip, { flexDirection: dir.row }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" testID="goal-chip">
        <View style={styles.badgeSm}>
          <Text style={styles.badgeTextSm}>{goal.index + 1}</Text>
        </View>
        <Text style={[styles.chipText, ta]} numberOfLines={1}>
          {t(`goal.${goal.id}` as TKey)}
        </Text>
        {goal.need > 1 ? (
          <Text style={styles.count}>
            {goal.have}/{goal.need}
          </Text>
        ) : null}
      </Pressable>
    );
  }
  return (
    <View style={styles.card} testID="goal-card">
      <Pressable onPress={onToggle} style={[styles.row, { flexDirection: dir.row }]} accessibilityRole="button" accessibilityLabel={t('goal.collapse')}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{goal.index + 1}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.label, ta]} numberOfLines={1}>
            {t('goal.label', { n: goal.index + 1, total: goal.total })}
          </Text>
          <Text style={[styles.title, ta]} numberOfLines={2}>
            {t(`goal.${goal.id}` as TKey)}
          </Text>
        </View>
        <Pressable onPress={onHelp} hitSlop={8} style={styles.help} accessibilityRole="button" accessibilityLabel={t('help.title')}>
          <Text style={styles.helpText}>?</Text>
        </Pressable>
      </Pressable>
      <Text style={[styles.how, ta]} numberOfLines={3}>
        {t(`goalHow.${goal.id}` as TKey)}
      </Text>
      {goal.need > 1 ? (
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }, dir.rtl && { alignSelf: 'flex-end' }]} />
          </View>
          <Text style={styles.count}>
            {goal.have}/{goal.need}
          </Text>
        </View>
      ) : null}
      <View style={[styles.row, { flexDirection: dir.row, justifyContent: 'space-between' }]}>
        <View style={[styles.reward, { flexDirection: dir.row }]}>
          <Icon name="coin" size={14} />
          <Text style={styles.rewardText}>+{goal.reward}</Text>
        </View>
        <Pressable onPress={onShow} style={({ pressed }) => [styles.show, { flexDirection: dir.row }, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" testID="goal-show">
          <Icon name="hand" size={16} />
          <Text style={styles.showText}>{t('goal.show')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: { maxWidth: 236, alignItems: 'center', gap: 6, backgroundColor: C.glass, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.glassEdge, ...SHADOW_SM },
  chipText: { color: C.text, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  badgeSm: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  badgeTextSm: { color: '#fff', fontWeight: '900', fontSize: 11 },
  card: { width: 236, backgroundColor: C.glass, borderRadius: 18, padding: 10, gap: 6, borderWidth: 1, borderColor: C.glassEdge, ...SHADOW_SM },
  row: { alignItems: 'center', gap: 8 },
  badge: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  label: { color: C.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  title: { color: C.text, fontSize: 14, fontWeight: '800', lineHeight: 17 },
  how: { color: C.textDim, fontSize: 12, fontWeight: '600', lineHeight: 15 },
  help: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' },
  helpText: { color: C.text, fontWeight: '900', fontSize: 14 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.green },
  count: { color: C.text, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reward: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(250,204,21,0.18)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rewardText: { color: C.text, fontWeight: '800', fontSize: 12 },
  show: { alignItems: 'center', gap: 4, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  showText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
