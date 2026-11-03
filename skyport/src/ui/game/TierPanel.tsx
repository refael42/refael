import { Pressable, StyleSheet, Text, View } from 'react-native';

import { nextTier, tierDef } from '../../data/tiers';
import { useDir, useT, type TKey } from '../../i18n';
import { checkTier, formatBig, formatDuration, type GameState } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

function Need({ ok, text }: { ok: boolean; text: string }) {
  const dir = useDir();
  return (
    <View style={[styles.need, { flexDirection: dir.row }]}>
      <View style={[styles.check, { backgroundColor: ok ? C.green : C.track }]}>{ok ? <Icon name="check" size={14} /> : null}</View>
      <Text style={[styles.needText, { textAlign: dir.textAlign }]}>{text}</Text>
    </View>
  );
}

export function TierPanel({ state, onBuild, onClose }: { state: GameState; rev: number; onBuild: () => void; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const cur = tierDef(state.tier);
  const next = nextTier(state.tier);
  const c = checkTier(state);
  const title = state.profile.airport || t('app.title');
  return (
    <Sheet title={title} subtitle={t('tierp.now', { tier: t(`tier.${cur.key}` as TKey) })} onClose={onClose}>
      <View style={styles.ladder}>
        {[cur, next].filter(Boolean).map((d, i) => (
          <View key={d!.id} style={[styles.step, { flexDirection: dir.row }, i === 0 ? styles.stepNow : null]}>
            <View style={[styles.badge, { backgroundColor: i === 0 ? C.primary : C.track }]}>
              <Text style={styles.badgeText}>{d!.id}</Text>
            </View>
            <Text style={[styles.stepText, ta]}>{t(`tier.${d!.key}` as TKey)}</Text>
          </View>
        ))}
      </View>
      {!next ? (
        <Text style={[styles.note, ta]}>{t('tierp.max')}</Text>
      ) : !c.available ? (
        <Text style={[styles.note, ta]}>
          {t('tierp.next', { tier: t(`tier.${next.key}` as TKey) })} · {t('tierp.soon')}
        </Text>
      ) : (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, ta]}>{t('tierp.next', { tier: t(`tier.${next.key}` as TKey) })}</Text>
          <Text style={[styles.note, ta]}>{t('tierp.unlocks', { pay: next.pay / cur.pay })}</Text>
          <Text style={[styles.note, ta]}>{t('tierp.contracts', { n: next.contracts })}</Text>
          {next.id >= 3 && next.id <= 5 ? <Text style={[styles.note, ta]}>{t(`tierp.feat${next.id}` as TKey)}</Text> : null}
          <Need ok={c.served} text={t('tierp.served', { a: state.stats.served, b: next.needs.served })} />
          <Need ok={c.rating} text={t('tierp.rating', { a: state.rating.toFixed(1), b: next.needs.rating.toFixed(1) })} />
          <Need ok={c.money} text={t('tierp.cost', { amount: formatBig(next.needs.cost) })} />
          {state.tierBuild ? (
            <Text style={[styles.building, ta]}>
              {state.tierSwitch ? t('tierp.switching') : t('tierp.building', { t: formatDuration(state.tierBuild.remaining) })}
            </Text>
          ) : (
            <Pressable
              disabled={!c.ok}
              onPress={onBuild}
              style={({ pressed }) => [styles.btn, { flexDirection: dir.row }, !c.ok && styles.btnOff, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
              accessibilityLabel={t('tierp.build')}
            >
              <Icon name="build" size={22} />
              <Text style={[styles.btnText, !c.ok && { color: C.textDim }]}>{t('tierp.build')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  ladder: { gap: 8 },
  step: { alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 16, padding: 10 },
  stepNow: { borderWidth: 2, borderColor: C.primary },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '900' },
  stepText: { color: C.text, fontWeight: '800', fontSize: 15, flex: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 10, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 17 },
  note: { color: C.textDim, fontSize: 13, fontWeight: '600' },
  need: { alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  needText: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  building: { color: C.primary, fontWeight: '800', fontSize: 14 },
  btn: { backgroundColor: C.primary, borderRadius: 16, height: 50, alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnOff: { backgroundColor: C.track },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
