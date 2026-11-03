import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AIRLINES } from '../../data/airlines';
import { STORES, URGENT_PRICE, type StoreKind } from '../../data/supplies';
import { useDir, useT, type TKey } from '../../i18n';
import { Big, formatBig, formatDuration, type Command, type GameState } from '../../sim';
import { CHECKS, hangarBays } from '../../sim/game/maintenance';
import { capacity, incoming, storeActive, storeIndex, unitPrice } from '../../sim/game/supplies';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

const fmt = (n: number) => formatBig(Big.fromNumber(Math.round(n)));

function Gauge({ value }: { value: number }) {
  const dir = useDir();
  const v = Math.max(0, Math.min(1, value));
  const color = v < 0.2 ? C.red : v < 0.45 ? C.amber : C.green;
  return (
    <View style={[styles.track, { flexDirection: dir.row }]}>
      <View style={[styles.fill, { width: `${Math.round(v * 100)}%`, backgroundColor: color }]} />
      {/* the reorder mark */}
      <View style={[styles.mark, dir.rtl ? { right: '45%' } : { left: '45%' }]} />
    </View>
  );
}

function StoreCard({ state, kind, send }: { state: GameState; kind: StoreKind; send: (c: Command) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const def = STORES[kind];
  const k = storeIndex(kind);
  const name = t(`sup.${kind}` as TKey);
  if (!storeActive(state, kind)) {
    return (
      <View style={styles.card}>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <Icon name={kind === 'fuel' ? 'fuel' : 'wrench'} size={24} />
          <Text style={[styles.cardTitle, ta]}>{name}</Text>
        </View>
        <Text style={[styles.note, ta]}>{t(kind === 'fuel' ? 'sup.fuelLocked' : 'sup.partsLocked')}</Text>
      </View>
    );
  }
  const st = state.stores[kind];
  const cap = capacity(state, kind);
  const unit = t(kind === 'fuel' ? 'sup.liters' : 'sup.pieces');
  const perMin = st.use * 60;
  const left = st.use > 1e-6 ? st.stock / st.use : Infinity;
  const ds = state.deliveries.filter((d) => d.store === k && d.state !== 'leaving');
  const want = Math.max(0, cap - st.stock - incoming(state, kind));
  const urgentCost = want * unitPrice(state, kind, st.supplier, true);
  const canUrgent = want >= (kind === 'fuel' ? Math.max(500, cap * 0.1) : 1);
  return (
    <View style={styles.card} testID={`store-${kind}`}>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Icon name={kind === 'fuel' ? 'fuel' : 'wrench'} size={24} />
        <Text style={[styles.cardTitle, ta, { flex: 1 }]}>{name}</Text>
        <Text style={[styles.big, st.out && { color: C.red }]}>
          {fmt(st.stock)} / {fmt(cap)} {unit}
        </Text>
      </View>
      <Gauge value={st.stock / Math.max(1, cap)} />
      <Text style={[styles.note, ta]}>
        {perMin > 0.01 ? t('sup.use', { n: fmt(perMin), unit }) : t('sup.idle')}
        {Number.isFinite(left) && perMin > 0.01 ? ` · ${t('sup.left', { t: formatDuration(left) })}` : ''}
      </Text>
      {/* deliveries on the way */}
      {ds.length === 0 ? (
        <Text style={[styles.note, ta]}>{t('sup.noOrder')}</Text>
      ) : (
        ds.map((d) => (
          <View key={d.id} style={[styles.row, { flexDirection: dir.row }]}>
            <View style={[styles.dot, { backgroundColor: d.urgent ? C.red : C.primary }]} />
            <Text style={[styles.line, ta, { flex: 1 }]}>
              {d.state === 'ordered'
                ? t(kind === 'fuel' ? 'sup.tankerEta' : 'sup.vanEta', { n: fmt(d.amount), t: formatDuration(Math.max(0, d.eta - state.time)) })
                : d.state === 'driving'
                  ? t('sup.onRoad', { n: fmt(d.amount) })
                  : t('sup.unloading', { p: Math.round(d.done * 100) })}
            </Text>
          </View>
        ))
      )}
      {/* supplier choice */}
      <Text style={[styles.label, ta]}>{t('sup.supplier')}</Text>
      <View style={[styles.suppliers, { flexDirection: dir.row }]}>
        {def.suppliers.map((sup, i) => {
          const on = st.supplier === i;
          const price = unitPrice(state, kind, i) * (kind === 'fuel' ? 1000 : 1);
          return (
            <Pressable
              key={sup.id}
              onPress={() => send({ type: 'setSupplier', store: k, supplier: i })}
              style={({ pressed }) => [styles.sup, on && styles.supOn, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(`sup.s.${sup.id}` as TKey)}
              testID={`sup-${kind}-${sup.id}`}
            >
              <Text style={[styles.supName, on && { color: C.primary }]} numberOfLines={1}>
                {sup.green ? '🌱 ' : ''}
                {t(`sup.s.${sup.id}` as TKey)}
              </Text>
              <View style={[styles.row, { flexDirection: dir.row, gap: 4 }]}>
                <Icon name="coin" size={13} />
                <Text style={styles.supLine}>{t(kind === 'fuel' ? 'sup.per1000' : 'sup.perPart', { n: fmt(price) })}</Text>
              </View>
              <View style={[styles.row, { flexDirection: dir.row, gap: 4 }]}>
                <Icon name="clock" size={13} />
                <Text style={styles.supLine}>{clockLike(sup.lead)}</Text>
              </View>
              <Text style={[styles.supTag, { color: sup.lateChance > 0.2 ? C.red : sup.green ? C.green : C.textDim }]} numberOfLines={1}>
                {t(sup.lateChance > 0.2 ? 'sup.oftenLate' : sup.green ? 'sup.greenTag' : 'sup.reliable')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        disabled={!canUrgent}
        onPress={() => send({ type: 'urgentOrder', store: k })}
        style={({ pressed }) => [styles.btn, { flexDirection: dir.row }, !canUrgent && styles.btnOff, pressed && { transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button"
        accessibilityLabel={t('sup.urgent')}
        testID={`urgent-${kind}`}
      >
        <Icon name="hourglass" size={20} />
        <Text style={[styles.btnText, !canUrgent && { color: C.textDim }]} numberOfLines={1}>
          {canUrgent ? t('sup.urgentCost', { n: fmt(urgentCost), x: URGENT_PRICE }) : t('sup.full')}
        </Text>
      </Pressable>
      <Text style={[styles.hint, ta]}>{t(kind === 'fuel' ? 'sup.growFuel' : 'sup.growParts')}</Text>
    </View>
  );
}

/** "2:20" for a lead time in seconds. */
function clockLike(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function HangarCard({ state }: { state: GameState }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const bays = hangarBays(state).length;
  const vans = state.vehicles.filter((v) => v.kind === 'mech');
  const busy = vans.filter((v) => v.state !== 'idle').length;
  const mechanics = state.staff.filter((m) => m.role === 4).length;
  const inWork = state.flights.filter((f) => f.check > 0 || f.aog === 1);
  return (
    <View style={styles.card} testID="hangar-card">
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Icon name="build" size={24} />
        <Text style={[styles.cardTitle, ta, { flex: 1 }]}>{t('sup.hangar')}</Text>
        <Text style={styles.big}>{t('sup.bays', { n: bays })}</Text>
      </View>
      {state.tier < 3 ? (
        <Text style={[styles.note, ta]}>{t('sup.hangarLocked')}</Text>
      ) : (
        <>
          <Text style={[styles.note, ta]}>{bays === 0 ? t('sup.buildHangar') : t('sup.checksDone', { n: state.stats.checks })}</Text>
          <Text style={[styles.note, ta]}>{t('sup.vans', { busy, n: vans.length, m: mechanics })}</Text>
          {inWork.map((f) => (
            <View key={f.id} style={[styles.row, { flexDirection: dir.row }]}>
              <View style={[styles.dot, { backgroundColor: f.check ? C.primary : C.red }]} />
              <Text style={[styles.line, ta, { flex: 1 }]} numberOfLines={1}>
                {`${AIRLINES[f.airline]?.code ?? ''}${f.num} · `}
                {f.check ? t(f.check === 2 ? 'sup.checkB' : 'sup.checkA') : t('sup.fault')}
                {f.dockedAt > 0 ? ` · ${f.partWait ? t('sup.waitPart') : `${Math.round(f.repWork * 100)}%`}` : ` · ${t('sup.inbound')}`}
              </Text>
            </View>
          ))}
          <Text style={[styles.hint, ta]}>{t('sup.checkInfo', { a: CHECKS[1].fee, b: CHECKS[2].fee })}</Text>
        </>
      )}
    </View>
  );
}

export function SupplyPanel({ state, send, onClose }: { state: GameState; rev: number; send: (c: Command) => void; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet title={t('sup.title')} subtitle={t('sup.sub')} onClose={onClose}>
      <StoreCard state={state} kind="fuel" send={send} />
      <StoreCard state={state} kind="parts" send={send} />
      <HangarCard state={state} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 9, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  row: { alignItems: 'center', gap: 8 },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 17 },
  big: { color: C.text, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] },
  note: { color: C.textDim, fontSize: 13, fontWeight: '600' },
  line: { color: C.text, fontSize: 13, fontWeight: '700' },
  hint: { color: C.textDim, fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
  label: { color: C.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  track: { height: 12, borderRadius: 6, backgroundColor: C.track, overflow: 'hidden', position: 'relative' },
  fill: { height: 12, borderRadius: 6 },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(15,23,42,0.35)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  suppliers: { gap: 8 },
  sup: { flex: 1, borderRadius: 14, borderWidth: 2, borderColor: C.track, padding: 8, gap: 3, backgroundColor: '#f8fafc' },
  supOn: { borderColor: C.primary, backgroundColor: '#eef2ff' },
  supName: { color: C.text, fontWeight: '800', fontSize: 13 },
  supLine: { color: C.text, fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] },
  supTag: { fontWeight: '700', fontSize: 11 },
  btn: { backgroundColor: C.primary, borderRadius: 14, height: 44, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  btnOff: { backgroundColor: C.track },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
