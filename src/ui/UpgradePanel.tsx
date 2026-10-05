import { useEffect, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import { mapForTier, type MapDef } from '../data/maps';
import { ROLES } from '../data/staff';
import { CATEGORIES, COUNT_STATS, UPGRADES, type Category, type UpgradeDef } from '../data/upgrades';
import { isRTL, useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { upgradeIcon } from '../render/upgradeIcons';
import type { Big } from '../sim/big';
import { canBuy, costOf, isMaxed, isUnlocked, itemValue, levelOf, nextMilestone, prevMilestone, tierOf, type Levels } from '../sim/economy/upgrades';
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

function Row({ def, wallet, onBuy }: { def: UpgradeDef; wallet: Wallet; onBuy: (id: string) => void }) {
  const t = useT();
  const rtl = isRTL(useSettings((s) => s.lang));
  const level = levelOf(wallet.levels, def.id);
  const unlocked = isUnlocked(def, wallet.levels);
  const maxed = isMaxed(def, level, wallet.map);
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
export function UpgradePanel({ wallet, station, onBuy, onShowAll, onClose }: Props) {
  const t = useT();
  const [category, setCategory] = useState<Category>('menu');
  const slide = useSharedValue(1);
  useEffect(() => {
    slide.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [slide]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value * 420 }] }));
  const items = station === null ? UPGRADES.filter((u) => u.category === category) : UPGRADES.filter((u) => u.anchor === station);
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsInner}>
          {CATEGORIES.map((c) => {
            const count = UPGRADES.filter((u) => u.category === c && canBuy(u, wallet.levels, wallet.coins, wallet.map)).length;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.tab, c === category && styles.tabOn]}>
                <Text style={[styles.tabText, c === category && styles.tabTextOn]}>{t(`cat.${c}`)}</Text>
                {count > 0 && <View style={styles.dot} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {items.map((def) => (
          <Row key={def.id} def={def} wallet={wallet} onBuy={onBuy} />
        ))}
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
