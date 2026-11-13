import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FACILITIES, FACILITY_MAX } from '../../data/land';
import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Big, formatBig, formatDuration, type Command, type GameState } from '../../sim';
import { canBuyPlot, clearSeconds, facilityCap, facilityCost, facilityRate, facilitySeconds, GARDEN_MOOD, plotCost, plotDef, rushCost } from '../../sim/game/land';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

const fmt = (n: number) => formatBig(Big.fromNumber(Math.floor(n)));

function Btn({ label, icon, sub, onPress, disabled, tone = 'primary', testID }: { label: string; icon?: IconName; sub?: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'gold' | 'green'; testID?: string }) {
  const dir = useDir();
  const bg = disabled ? C.track : tone === 'gold' ? '#f59e0b' : tone === 'green' ? C.green : C.primary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, flexDirection: dir.row }, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      <Text style={[styles.btnText, disabled && { color: C.textDim }]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? <Text style={[styles.btnSub, disabled && { color: C.textDim }]}>{sub}</Text> : null}
    </Pressable>
  );
}

/** One plot of the airport's land: buy and clear it, pick its facility, collect and upgrade (owner request: grow like Hay Day). */
export function LandPanel({ state, plot, send, onClose }: { state: GameState; rev: number; plot: number; send: (c: Command) => void; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const def = plotDef(state, plot);
  const p = state.land.plots[plot];
  if (!def) return null;
  const busy = Object.values(state.land.plots).some((q) => q.state === 1);
  const rush = (testID: string) =>
    p && p.left > 0 ? (
      <Btn label={t('land.rush')} icon="diamond" sub={`${rushCost(state, plot)}`} tone="gold" disabled={state.diamonds < rushCost(state, plot)} onPress={() => send({ type: 'rushPlot', plot })} testID={testID} />
    ) : null;
  const progress = (left: number, total: number, color: string) => (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round((1 - left / Math.max(0.001, total)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );

  // wild, or being cleared
  if (!p || p.state === 1) {
    const canBuy = canBuyPlot(state, plot);
    const cost = plotCost(state);
    return (
      <Sheet title={t('land.wild')} subtitle={t('land.wildDesc')} onClose={onClose}>
        <View style={styles.card} testID="land-wild">
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <Icon name="build" size={26} />
            <Text style={[styles.title, ta, { flex: 1 }]}>{p ? t('land.clearing', { t: formatDuration(p.left) }) : t('land.wild')}</Text>
          </View>
          <Text style={[styles.note, ta]}>{t('land.reward')}</Text>
          {p ? (
            <>
              {progress(p.left, p.total, C.green)}
              {rush('land-rush')}
            </>
          ) : (
            <>
              <Btn
                label={t('land.buy')}
                icon="coin"
                sub={`${fmt(cost)} · ${formatDuration(clearSeconds(state))}`}
                disabled={!canBuy || state.money.lt(Big.fromNumber(cost))}
                onPress={() => send({ type: 'buyPlot', plot })}
                testID="land-buy"
              />
              {!canBuy ? <Text style={[styles.warn, ta]}>{busy ? t('land.busy') : t('land.needNorth')}</Text> : null}
            </>
          )}
        </View>
      </Sheet>
    );
  }

  // the airport's, nothing built yet: pick a facility
  if (p.f < 0) {
    return (
      <Sheet title={t('land.owned')} subtitle={t('land.pick')} onClose={onClose}>
        {FACILITIES.map((f, i) => {
          const cost = facilityCost(state, i, 0);
          return (
            <View key={f.id} style={styles.card} testID={`fac-${f.id}`}>
              <View style={[styles.row, { flexDirection: dir.row }]}>
                <View style={styles.badge}>
                  <Icon name={f.icon as IconName} size={24} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.title, ta]}>{t(`fac.${f.id}` as TKey)}</Text>
                  <Text style={[styles.note, ta]}>{t(`facDesc.${f.id}` as TKey)}</Text>
                </View>
              </View>
              <Btn
                label={t('land.build')}
                icon="coin"
                sub={`${fmt(cost)} · ${formatDuration(facilitySeconds(0))}`}
                disabled={state.money.lt(Big.fromNumber(cost))}
                onPress={() => send({ type: 'buildFacility', plot, facility: i })}
                testID={`build-${f.id}`}
              />
            </View>
          );
        })}
      </Sheet>
    );
  }

  // a facility: what it makes, collect, upgrade
  const f = FACILITIES[p.f];
  const rate = facilityRate(state, p);
  const cap = facilityCap(state, p);
  const next = facilityCost(state, p.f, p.lv);
  return (
    <Sheet title={t(`fac.${f.id}` as TKey)} subtitle={t(`facDesc.${f.id}` as TKey)} onClose={onClose}>
      <View style={styles.card} testID="land-facility">
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={styles.badge}>
            <Icon name={f.icon as IconName} size={26} />
          </View>
          <Text style={[styles.title, ta, { flex: 1 }]}>{t('land.level', { n: p.lv, max: FACILITY_MAX })}</Text>
        </View>
        <View style={[styles.pips, { flexDirection: dir.row }]}>
          {Array.from({ length: FACILITY_MAX }, (_, i) => (
            <View key={i} style={[styles.pip, i < p.lv && styles.pipOn]} />
          ))}
        </View>
        {f.id === 'garden' ? (
          <Text style={[styles.line, ta]}>{t('land.mood', { n: Math.round(GARDEN_MOOD * p.lv * 1000) / 10 })}</Text>
        ) : (
          <Text style={[styles.line, ta]}>
            {t('land.rate', { n: fmt(rate * 60) })}
            {f.capMin <= 0 ? ` · ${t('land.auto')}` : ` · ${t('land.store', { n: fmt(p.store), max: fmt(cap) })}`}
          </Text>
        )}
        {f.id === 'school' ? <Text style={[styles.note, ta]}>{t('land.xp')}</Text> : null}
        {f.capMin > 0 && p.lv > 0 ? (
          <>
            {progress(cap - p.store, Math.max(1, cap), '#f59e0b')}
            <Btn label={t('land.collect', { n: fmt(p.store) })} icon="coin" tone="green" disabled={p.store < 1} onPress={() => send({ type: 'collectFacility', plot })} testID="land-collect" />
          </>
        ) : null}
      </View>
      <View style={styles.card}>
        {p.left > 0 ? (
          <>
            <Text style={[styles.title, ta]}>{t('land.building', { t: formatDuration(p.left) })}</Text>
            {progress(p.left, p.total, '#f59e0b')}
            {rush('land-rush')}
          </>
        ) : p.lv >= FACILITY_MAX ? (
          <Text style={[styles.title, ta]}>{t('land.max')}</Text>
        ) : (
          <Btn
            label={t('land.upgrade', { n: p.lv + 1 })}
            icon="up"
            sub={`${fmt(next)} · ${formatDuration(facilitySeconds(p.lv))}`}
            disabled={state.money.lt(Big.fromNumber(next))}
            onPress={() => send({ type: 'buildFacility', plot, facility: p.f })}
            testID="land-upgrade"
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 9, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  row: { alignItems: 'center', gap: 10 },
  badge: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#ecfccb', alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontWeight: '800', fontSize: 17 },
  line: { color: C.text, fontWeight: '700', fontSize: 14 },
  note: { color: C.textDim, fontSize: 13, fontWeight: '600' },
  warn: { color: C.red, fontSize: 13, fontWeight: '700' },
  track: { height: 10, borderRadius: 5, backgroundColor: C.track, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  pips: { gap: 5 },
  pip: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.track },
  pipOn: { backgroundColor: '#22c55e' },
  btn: { borderRadius: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSub: { color: '#fff', fontWeight: '700', fontSize: 13, opacity: 0.95 },
});
