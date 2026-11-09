import { StyleSheet, Text, View } from 'react-native';

import { tierDef } from '../../data/tiers';
import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

/** The five taps of a turnaround, in order, with the bubble each shows over the plane. */
const CYCLE: { icon: IconName; key: TKey }[] = [
  { icon: 'actLand', key: 'help.c.land' },
  { icon: 'actBags', key: 'help.c.bags' },
  { icon: 'actFuel', key: 'help.c.fuel' },
  { icon: 'actBoard', key: 'help.c.board' },
  { icon: 'actTakeoff', key: 'help.c.takeoff' },
];

/** Topics, each opening at an airport tier (shown with its name when it is still ahead). */
const TOPICS: { icon: IconName; key: string; tier: number }[] = [
  { icon: 'coin', key: 'money', tier: 1 },
  { icon: 'team', key: 'staff', tier: 1 },
  { icon: 'wrench', key: 'upgrades', tier: 1 },
  { icon: 'tail', key: 'airlines', tier: 1 },
  { icon: 'plane', key: 'grow', tier: 1 },
  { icon: 'build', key: 'build', tier: 1 },
  { icon: 'wind', key: 'weather', tier: 2 },
  { icon: 'fuel', key: 'supplies', tier: 2 },
  { icon: 'actRepair', key: 'maintenance', tier: 3 },
  { icon: 'bell', key: 'events', tier: 2 },
  { icon: 'party', key: 'holidays', tier: 1 },
  { icon: 'plane', key: 'terminals', tier: 2 },
  { icon: 'guide', key: 'guide', tier: 1 },
  { icon: 'shield', key: 'security', tier: 2 },
  { icon: 'tail', key: 'hub', tier: 6 },
  { icon: 'star', key: 'skyport', tier: 8 },
];

export function HelpPanel({ tier, onClose }: { tier: number; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <Sheet title={t('help.title')} subtitle={t('help.sub')} onClose={onClose}>
      <View style={styles.card} testID="help-cycle">
        <Text style={[styles.cardTitle, ta]}>{t('help.cycleTitle')}</Text>
        <View style={[styles.cycle, { flexDirection: dir.row }]}>
          {CYCLE.map((c, i) => (
            <View key={c.key} style={[styles.step, { flexDirection: dir.row }]}>
              <View style={styles.stepIn}>
                <Icon name={c.icon} size={36} />
                <Text style={styles.stepText} numberOfLines={2}>
                  {t(c.key)}
                </Text>
              </View>
              {i < CYCLE.length - 1 ? <Text style={styles.arrow}>{dir.rtl ? '‹' : '›'}</Text> : null}
            </View>
          ))}
        </View>
        <Text style={[styles.body, ta]}>{t('help.cycleBody')}</Text>
      </View>
      {TOPICS.map((tp) => {
        const later = tp.tier > tier;
        return (
          <View key={tp.key} style={[styles.card, later && styles.later]}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <Icon name={tp.icon} size={26} />
              <Text style={[styles.cardTitle, ta, { flex: 1 }]}>{t(`help.${tp.key}.title` as TKey)}</Text>
              {later ? <Text style={styles.tag}>{t('help.opensAt', { tier: t(`tier.${tierDef(tp.tier).key}` as TKey) })}</Text> : null}
            </View>
            <Text style={[styles.body, ta]}>{t(`help.${tp.key}.body` as TKey)}</Text>
          </View>
        );
      })}
      <View style={styles.card}>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <Icon name="hand" size={26} />
          <Text style={[styles.cardTitle, ta, { flex: 1 }]}>{t('help.controls.title')}</Text>
        </View>
        <Text style={[styles.body, ta]}>{t('help.controls.body')}</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, gap: 8, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  later: { opacity: 0.75 },
  row: { alignItems: 'center', gap: 10 },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 16 },
  body: { color: C.textDim, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  tag: { color: C.primary, fontSize: 11, fontWeight: '800', backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  cycle: { justifyContent: 'space-between', alignItems: 'flex-start' },
  step: { alignItems: 'center', flex: 1 },
  stepIn: { alignItems: 'center', flex: 1, gap: 2 },
  stepText: { color: C.text, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  arrow: { color: C.textDim, fontSize: 22, fontWeight: '900', marginTop: 4 },
});
