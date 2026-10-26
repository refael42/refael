import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { INGREDIENTS, SUPPLIERS, SUPPLY } from '../data/supply';
import { useT } from '../i18n';
import { CRATES } from '../render/art/supplyArt';
import { spriteIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { anyMissing, capacityOf, lowStock, unitCost, urgentExtra } from '../sim/supply';
import { countdown } from './Festival';
import { IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// The storeroom and its suppliers (owner M51). A round button by the others at the bottom (a
// red "!" when something runs low); the page shows each ingredient's stock, picks its supplier,
// says when the van comes and what the account owes, and sends an urgent van.

const GREEN = '#3E9B4F';
const crateUri = (i: number, px: number) => spriteIcon(CRATES[i]!, Math.round(px * PixelRatio.get()));

const readButton = (s: GameState) => {
  const low = lowStock(s);
  return { low: low.length, out: s.supply.stock.some((v) => v < 1) };
};

/** At the bottom, by the wheel: the storeroom; a red "!" when something runs low. */
export function SupplyButton({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readButton, 1);
  if (!d) return null;
  return <SideButton label="storeroom" icon={crateUri(0, SIDE.icon)} caption={t('supply.button')} hurry={d.out} badge={d.low > 0 ? '!' : undefined} onPress={onPress} style={style} />;
}

const readSupply = (s: GameState) => {
  const sup = s.supply;
  const van = sup.van;
  return {
    cap: capacityOf(s),
    stock: sup.stock.join(','),
    suppliers: sup.suppliers.join(','),
    units: INGREDIENTS.map((_, i) => formatBig(unitCost(s, i))).join('|'),
    tier: s.mods.building,
    van: van ? (van.done ? 'off' : van.urgent ? 'urgent' : 'unloading') : 'none',
    next: van ? 0 : Math.max(0, Math.ceil(sup.nextVan - s.time)),
    owed: sup.owed.gt(0.5) ? formatBig(sup.owed) : '',
    lastBill: sup.lastBill.gt(0) ? formatBig(sup.lastBill) : '',
    urgent: !van && !s.construction && anyMissing(s) ? formatBig(urgentExtra(s)) : '',
  };
};

export function SupplyPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readSupply, 2);
  if (!d) return null;
  const stock = d.stock.split(',').map(Number);
  const suppliers = d.suppliers.split(',').map(Number);
  const units = d.units.split('|');
  const vanText =
    d.van === 'none' ? t('supply.next').replace('{t}', countdown(d.next, t)) : d.van === 'urgent' ? t('supply.urgentOnWay') : d.van === 'unloading' ? t('supply.unloading') : t('supply.leaving');
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: crateUri(0, 40) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('supply.title')}</Text>
          <IconText icon="iconTimer" size={14} textStyle={styles.sub}>{vanText}</IconText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.rows}>
        {INGREDIENTS.map((id, i) => {
          const have = stock[i] ?? 0;
          const share = Math.min(1, have / Math.max(1, d.cap));
          const low = have < Math.max(1, d.cap * SUPPLY.lowAt);
          return (
            <View key={id} style={[styles.row, have < 1 && styles.rowOut]}>
              <Image source={{ uri: crateUri(i, 44) }} style={styles.crate} />
              <View style={styles.stockCol}>
                <Text style={styles.name}>{t(`supply.ingr.${id}`)}</Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(share * 100)}%` }, low && styles.barLow]} />
                  <Text style={styles.barText}>{have < 1 ? t('supply.out') : `${have}/${d.cap}`}</Text>
                </View>
                <IconText icon="hudCoin" size={12} textStyle={styles.unit}>{`${t('supply.unit')} ${units[i]}`}</IconText>
              </View>
              <View style={styles.chips}>
                {SUPPLIERS.map((sup, k) => {
                  const locked = d.tier < sup.tier;
                  const on = suppliers[i] === k;
                  return (
                    <Pressable
                      key={sup.id}
                      accessibilityRole="button"
                      disabled={locked || on}
                      onPress={() => {
                        tapFeedback();
                        onCommand({ type: 'supplier', ingredient: i, supplier: k });
                      }}
                      style={[styles.chip, on && styles.chipOn, locked && styles.chipLocked]}
                    >
                      <Text style={[styles.chipName, on && styles.chipNameOn]}>{t(`supply.sup.${sup.id}`)}</Text>
                      <Text style={styles.chipDesc}>{locked ? t('supply.locked') : t(`supply.supDesc.${sup.id}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={styles.hint}>{t('supply.hint')}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.account}>
          {d.lastBill !== '' && <IconText icon="hudCoin" size={13} textStyle={styles.accountText}>{t('supply.lastBill').replace('{n}', d.lastBill)}</IconText>}
          {d.owed !== '' && <IconText icon="hudCoin" size={13} textStyle={[styles.accountText, styles.owed]}>{t('supply.owed').replace('{n}', d.owed)}</IconText>}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={d.urgent === ''}
          onPress={() => {
            tapFeedback();
            onCommand({ type: 'urgentOrder' });
          }}
          style={[styles.urgent, d.urgent === '' && styles.off]}
        >
          <Text style={styles.urgentText}>{t('supply.urgent')}</Text>
          {d.urgent !== '' && <IconText icon="hudCoin" size={12} textStyle={styles.urgentCost}>{`+${d.urgent}`}</IconText>}
        </Pressable>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 720, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: GREEN, overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: GREEN },
  headerIcon: { width: 44, height: 44 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#1E3A22', 2, 2) },
  sub: { color: '#F0FFE8', fontSize: 13, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(20,40,24,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  rows: { gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 14, padding: 8, borderWidth: 2, borderColor: 'transparent' },
  rowOut: { borderColor: '#E5483B' },
  crate: { width: 48, height: 48 },
  stockCol: { width: 170, gap: 3 },
  name: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bar: { height: 16, borderRadius: 8, backgroundColor: 'rgba(42,21,48,0.7)', overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#35B957' },
  barLow: { backgroundColor: '#E5483B' },
  barText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  unit: { color: '#E8C76A', fontSize: 11.5, fontWeight: '800' },
  chips: { flex: 1, flexDirection: 'row', gap: 5 },
  chip: { flex: 1, minHeight: 50, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 4, backgroundColor: '#3A2042', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: '#7EE08F', backgroundColor: '#24502F' },
  chipLocked: { opacity: 0.45 },
  chipName: { color: '#E9DDF0', fontSize: 12.5, fontWeight: '900', textAlign: 'center' },
  chipNameOn: { color: '#FFFFFF' },
  chipDesc: { color: '#C9B3D6', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  hint: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  account: { flex: 1, gap: 2 },
  accountText: { color: '#E9DDF0', fontSize: 12.5, fontWeight: '800' },
  owed: { color: '#FFB0A0' },
  urgent: { flexDirection: 'row', gap: 8, alignItems: 'center', height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: '#D8352B', borderWidth: 1.5, borderColor: '#FFB0A0' },
  urgentText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  urgentCost: { color: '#FFE9A8', fontSize: 12.5, fontWeight: '900' },
  off: { opacity: 0.45 },
});
