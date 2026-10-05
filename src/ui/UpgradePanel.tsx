import { useEffect, useMemo, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import { mapForTier, type MapDef } from '../data/maps';
import { ROLES } from '../data/staff';
import { CATEGORIES, COUNT_STATS, EXPAND, UPGRADES, type Category, type UpgradeDef } from '../data/upgrades';
import { isRTL, useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { upgradeIcon } from '../render/upgradeIcons';
import type { Big } from '../sim/big';
import { canBuy, costOf, isMaxed, isUnlocked, itemValue, levelOf, nextMilestone, prevMilestone, tierOf, type Levels } from '../sim/economy/upgrades';
import { bestValue } from '../sim/economy/value';
import { formatBig, formatNumber } from '../sim/format';
import type { PropKind } from '../sim/types';
import { useSettings } from '../store/settings';
import { gold, panel } from './theme';

export interface Wallet {
  coins: Big;
  levels: Levels;
  /** The current building: it caps how many tables and stoves fit. */
  map: MapDef;
}

interface Props {
  wallet: Wallet;
  /** A tapped station's upgrades, or null for the full catalog with category tabs. */
  station: PropKind | null;
  onBuy: (id: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}

const ICON_PX = 44;
const iconUri = (id: string, level: number) => spriteIcon(upgradeIcon(id, tierOf(level)), Math.round(ICON_PX * PixelRatio.get()));

/** "x1.48" for multipliers, "+3" for counts. */
function valueText(def: UpgradeDef, level: number): string {
  const v = itemValue(def, level);
  return COUNT_STATS.includes(def.effect.stat) ? `+${formatNumber(v)}` : `x${v < 100 ? v.toFixed(2) : formatNumber(v)}`;
}

/** The buy button pulses while affordable: the "one more upgrade" itch. */
function BuyButton({ cost, affordable, onPress }: { cost: Big; affordable: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (affordable) scale.value = withRepeat(withSequence(withTiming(1.06, { duration: 420 }), withTiming(1, { duration: 420 })), -1);
    else {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 120 });
    }
  }, [affordable, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !affordable }}
      disabled={!affordable}
      onPress={() => {
        scale.value = withSequence(withTiming(0.86, { duration: 60 }), withSpring(1, { damping: 7, stiffness: 380 }));
        onPress();
      }}
      hitSlop={6}
    >
      <Animated.View style={[styles.buy, !affordable && styles.buyOff, style]}>
        <View style={styles.coin} />
        <Text style={[styles.buyText, !affordable && styles.buyTextOff]}>{formatBig(cost)}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** What the next building brings: its name, more room, more people, higher prices. */
function NextBuilding({ level }: { level: number }) {
  const t = useT();
  const now = TIERS[level];
  const next = TIERS[level + 1];
  if (!now || !next) return null;
  const tables = mapForTier(level + 1).tables.length - mapForTier(level).tables.length;
  const staff = Object.keys(ROLES).reduce((sum, r) => sum + ((next.staff[r as keyof typeof ROLES] ?? 0) - (now.staff[r as keyof typeof ROLES] ?? 0)), 0);
  const perk = (value: string, label: string) => (
    <View style={styles.perk}>
      <Text style={styles.valueNext}>{value}</Text>
      <Text style={styles.stat}>{label}</Text>
    </View>
  );
  return (
    <>
      <View style={styles.line}>
        <Text style={styles.stat}>{t('ui.nextTier')}</Text>
        <Text style={styles.valueNext}>{t(`tier.${next.id}`)}</Text>
      </View>
      <View style={[styles.line, styles.perks]}>
        {perk(`+${tables}`, t('ui.perkTables'))}
        {staff > 0 && perk(`+${staff}`, t('ui.perkStaff'))}
        {perk(`x${+(next.arrivals / now.arrivals).toFixed(2)}`, t('stat.arrivals'))}
        {perk(`x${+(next.price / now.price).toFixed(2)}`, t('stat.price'))}
      </View>
    </>
  );
}

function Row({ def, wallet, onBuy, best }: { def: UpgradeDef; wallet: Wallet; onBuy: (id: string) => void; best: boolean }) {
  const t = useT();
  const rtl = isRTL(useSettings((s) => s.lang));
  const level = levelOf(wallet.levels, def.id);
  const unlocked = isUnlocked(def, wallet.levels);
  const maxed = isMaxed(def, wallet.levels, wallet.map);
  const next = nextMilestone(level);
  const prev = prevMilestone(level);
  const share = def.milestone ? Math.min(1, (level - prev) / Math.max(1, next - prev)) : 0;
  return (
    <View style={[styles.row, !unlocked && styles.rowLocked]}>
      <Image source={{ uri: iconUri(def.id, level) }} style={styles.icon} />
      <View style={styles.rowBody}>
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {t(`up.${def.id}`)}
          </Text>
          <Text style={styles.lvLabel}>{t('ui.lv')}</Text>
          <Text style={styles.lv}>{level}</Text>
          {best && (
            <View style={styles.bestTag}>
              <Text style={styles.bestText}>{`★ ${t('ui.bestValue')}`}</Text>
            </View>
          )}
        </View>
        {def.effect.stat === 'building' ? (
          <NextBuilding level={level} />
        ) : (
          <View style={styles.line}>
            <Text style={styles.stat}>{t(`stat.${def.effect.stat}`)}</Text>
            <Text style={styles.value}>{valueText(def, level)}</Text>
            {!maxed && <Text style={styles.arrow}>{rtl ? '‹' : '›'}</Text>}
            {!maxed && <Text style={styles.valueNext}>{valueText(def, level + 1)}</Text>}
          </View>
        )}
        {def.unlocksDish !== undefined && level === 0 && <Text style={styles.note}>{t('ui.unlocksDish')}</Text>}
        {def.milestone && (
          <View style={styles.line}>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${share * 100}%` }]} />
            </View>
            <Text style={styles.milestone}>{t('ui.lv')}</Text>
            <Text style={styles.milestone}>{next}</Text>
            <Text style={styles.milestone}>{`x${def.milestone.factor}`}</Text>
            <Text style={styles.milestone}>{t(`stat.${def.milestone.stat}`)}</Text>
            {def.expands && next === EXPAND.level && <Text style={styles.expands}>{t('ui.expands')}</Text>}
          </View>
        )}
      </View>
      {!unlocked && def.requires ? (
        <View style={styles.needs}>
          <Text style={styles.needsText}>{t('ui.needs')}</Text>
          <Text style={styles.needsText} numberOfLines={1}>
            {t(`up.${def.requires.item}`)}
          </Text>
          <Text style={styles.needsText}>{`${t('ui.lv')} ${def.requires.level}`}</Text>
        </View>
      ) : maxed ? (
        <Text style={styles.max}>{t('ui.max')}</Text>
      ) : (
        <BuyButton cost={costOf(def, level)} affordable={canBuy(def, wallet.levels, wallet.coins, wallet.map)} onPress={() => onBuy(def.id)} />
      )}
    </View>
  );
}

/** Side sheet with upgrade rows: a station's own upgrades, or the whole catalog by category. */
/** Always on the right, next to the Upgrades button (left would cover the settings gear). */
/** The catalog's tabs: "best value" across everything, then the categories. */
type Tab = Category | 'best';

export function UpgradePanel({ wallet, station, onBuy, onShowAll, onClose }: Props) {
  const t = useT();
  const rtl = isRTL(useSettings((s) => s.lang));
  const [category, setCategory] = useState<Tab>('best');
  const [query, setQuery] = useState('');
  const [buyableOnly, setBuyableOnly] = useState(false);
  const ranked = useMemo(() => bestValue(wallet.levels, wallet.map), [wallet.levels, wallet.map]);
  const affordable = (u: UpgradeDef) => canBuy(u, wallet.levels, wallet.coins, wallet.map);
  // The one to buy next: the best value you can pay for now.
  const bestId = ranked.find(affordable)?.id;
  const slide = useSharedValue(1);
  useEffect(() => {
    slide.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [slide]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value * 420 }] }));
  // Decor is placed in build mode, not bought from a list: those rows live in the build panel.
  const listed = UPGRADES.filter((u) => !u.build);
  const q = query.trim().toLowerCase();
  let items: readonly UpgradeDef[];
  if (station !== null) items = listed.filter((u) => u.anchor === station);
  else if (q) items = listed.filter((u) => t(`up.${u.id}`).toLowerCase().includes(q));
  else if (category === 'best') items = ranked;
  else items = listed.filter((u) => u.category === category);
  if (station === null && buyableOnly) items = items.filter(affordable);
  // One upgrade: its name. Several on one station (the pass holds the menu): their category.
  const title = station === null ? t('ui.upgrades') : items.length === 1 ? t(`up.${items[0]!.id}`) : t(`cat.${items[0]?.category ?? 'menu'}`);
  return (
    <Animated.View style={[styles.panel, slideStyle]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      {station === null && (
        <View style={styles.tools}>
          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('ui.search')}
              placeholderTextColor="#8A6A9A"
              style={[styles.search, { textAlign: rtl ? 'right' : 'left' }]}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="clear" onPress={() => setQuery('')} hitSlop={8} style={styles.clear}>
                <Text style={styles.clearText}>{'✕'}</Text>
              </Pressable>
            )}
          </View>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: buyableOnly }} onPress={() => setBuyableOnly(!buyableOnly)} style={[styles.chip, buyableOnly && styles.chipOn]}>
            <Text style={[styles.chipText, buyableOnly && styles.chipTextOn]}>{t('ui.canBuy')}</Text>
          </Pressable>
        </View>
      )}
      {station === null && !q && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsInner}>
          {(['best', ...CATEGORIES] as const).map((c) => {
            const count = c === 'best' ? (bestId ? 1 : 0) : listed.filter((u) => u.category === c && affordable(u)).length;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.tab, c === category && styles.tabOn]}>
                <Text style={[styles.tabText, c === category && styles.tabTextOn]}>{c === 'best' ? `★ ${t('ui.bestValue')}` : t(`cat.${c}`)}</Text>
                {count > 0 && <View style={styles.dot} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {items.map((def) => (
          <Row key={def.id} def={def} wallet={wallet} onBuy={onBuy} best={def.id === bestId} />
        ))}
        {items.length === 0 && <Text style={styles.empty}>{t('ui.noResults')}</Text>}
        {station !== null && (
          <Pressable onPress={onShowAll} style={styles.allButton}>
            <Text style={styles.allText}>{t('ui.all')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: 8,
    width: 372,
    maxWidth: '58%',
    backgroundColor: panel.bg,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: gold,
    boxShadow: '0px 6px 0px #120818',
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  title: { flex: 1, color: '#FFE9A8', fontSize: 19, fontWeight: '900' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 6 },
  searchBox: { flex: 1, justifyContent: 'center' },
  search: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#5A3A64',
    backgroundColor: '#1E0E24',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    // Room for the clear button on either side (it sits at the end, which flips in Hebrew).
    paddingHorizontal: 32,
  },
  clear: { position: 'absolute', end: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A2550' },
  clearText: { color: '#E8D7F0', fontSize: 11, fontWeight: '900' },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: '#5A3A64', backgroundColor: '#24122A', justifyContent: 'center' },
  chipOn: { backgroundColor: '#35B957', borderColor: '#B9F5A8' },
  chipText: { color: '#E8D7F0', fontWeight: '800', fontSize: 12 },
  chipTextOn: { color: '#FFFFFF' },
  bestTag: { marginStart: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: gold },
  bestText: { color: '#2A1530', fontSize: 10, fontWeight: '900' },
  empty: { color: '#C9B3D6', fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 20 },
  tabs: { flexGrow: 0 },
  tabsInner: { paddingHorizontal: 10, gap: 6, paddingBottom: 6 },
  tab: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: '#3A1D40', justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  tabOn: { backgroundColor: gold },
  tabText: { color: '#E8D7F0', fontWeight: '800', fontSize: 13 },
  tabTextOn: { color: '#2A1530' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC6A', marginStart: 6 },
  list: { flex: 1 },
  listInner: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: panel.row, borderRadius: 14, padding: 8, gap: 8 },
  rowLocked: { opacity: 0.6 },
  icon: { width: ICON_PX, height: ICON_PX },
  rowBody: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perks: { flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  name: { color: '#FFF4E3', fontWeight: '900', fontSize: 14, flexShrink: 1 },
  lvLabel: { color: '#C9B3D6', fontWeight: '800', fontSize: 12, marginStart: 4 },
  lv: { color: gold, fontWeight: '900', fontSize: 14 },
  stat: { color: '#C9B3D6', fontSize: 12, fontWeight: '700' },
  value: { color: '#FFF4E3', fontSize: 12, fontWeight: '900' },
  arrow: { color: '#7EE08F', fontSize: 14, fontWeight: '900' },
  valueNext: { color: '#7EE08F', fontSize: 12, fontWeight: '900' },
  note: { color: '#7EE08F', fontSize: 11, fontWeight: '800' },
  bar: { width: 54, height: 7, borderRadius: 4, backgroundColor: '#1C0E22', overflow: 'hidden' },
  barFill: { height: 7, backgroundColor: gold },
  milestone: { color: '#E8C76A', fontSize: 11, fontWeight: '800' },
  expands: { color: '#FFB347', fontSize: 11, fontWeight: '900' },
  buy: {
    minWidth: 84,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#35B957',
    borderWidth: 2,
    borderColor: '#B9F5A8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 5,
    boxShadow: '0px 3px 0px #17602A',
  },
  buyOff: { backgroundColor: '#5A4E66', borderColor: '#7A6E86', boxShadow: '0px 3px 0px #2A2232' },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFC21A', borderWidth: 1.5, borderColor: '#9A6A00' },
  buyText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  buyTextOff: { color: '#D8CFE0' },
  needs: { width: 84, alignItems: 'center' },
  needsText: { color: '#E8C76A', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  max: { width: 84, textAlign: 'center', color: gold, fontWeight: '900', fontSize: 15 },
  allButton: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 18, height: 40, borderRadius: 20, borderWidth: 2, borderColor: gold, justifyContent: 'center' },
  allText: { color: '#FFE9A8', fontWeight: '900', fontSize: 14 },
});
