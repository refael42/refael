import { useEffect } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import { DECOR, placeRow } from '../data/decor';
import type { Point } from '../data/maps';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { upgradeIcon } from '../render/upgradeIcons';
import { capOf, costOf, isUnlocked, levelOf, upgradeDef } from '../sim/economy/upgrades';
import { formatBig } from '../sim/format';
import { gold, panel } from './theme';
import { canBuyNow, type Wallet } from './UpgradePanel';

/** What build mode offers: a table on the next dashed spot, then the decor pieces. */
export const BUILD_ITEMS: readonly string[] = ['tables', ...DECOR.map((d) => placeRow(d.id))];

const ICON_PX = 34;
const icon = (id: string) => spriteIcon(upgradeIcon(id, 0), Math.round(ICON_PX * PixelRatio.get()));

/** How much better one more of it makes things, e.g. "+4%". */
function effectText(id: string): string {
  const e = upgradeDef(id).effect;
  return e.stat === 'tables' ? '+1' : `+${+(e.per * 100).toFixed(1)}%`;
}

interface Props {
  wallet: Wallet;
  item: string | null;
  tile: Point | null;
  /** Free tiles right now (0 = nowhere left to put decor). */
  freeTiles: number;
  onItem: (item: string) => void;
  onPlace: () => void;
  onDone: () => void;
}

/** Build mode's bottom bar: pick a piece, tap a green tile, place it. */
export function BuildPanel({ wallet, item, tile, freeTiles, onItem, onPlace, onDone }: Props) {
  const t = useT();
  const rise = useSharedValue(1);
  useEffect(() => {
    rise.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [rise]);
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value * 160 }] }));
  const chosen = item ? upgradeDef(item) : null;
  const isDecor = chosen?.build === true;
  const affordable = chosen ? canBuyNow(chosen, wallet) : false;
  const hint = !chosen ? t('ui.buildPick') : !isDecor ? t('ui.tableSpot') : freeTiles === 0 ? t('ui.noTile') : tile ? null : t('ui.buildTap');
  return (
    <Animated.View style={[styles.wrap, riseStyle]} pointerEvents="box-none">
      <View style={styles.bar}>
        {hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : (
          <Text style={styles.hint}>{t(`up.${item}`)}</Text>
        )}
        {chosen && (isDecor ? tile !== null : true) && (
          <Pressable onPress={onPlace} disabled={!affordable} style={[styles.place, !affordable && styles.placeOff]}>
            <View style={styles.coin} />
            <Text style={styles.placeText}>{formatBig(costOf(chosen, levelOf(wallet.levels, chosen.id)))}</Text>
            <Text style={styles.placeText}>{t('ui.place')}</Text>
          </Pressable>
        )}
        <Pressable onPress={onDone} style={styles.done}>
          <Text style={styles.doneText}>{t('ui.done')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {BUILD_ITEMS.map((id) => {
          const def = upgradeDef(id);
          const level = levelOf(wallet.levels, id);
          const cap = capOf(def, wallet.map, wallet.levels) ?? Infinity;
          const unlocked = isUnlocked(def, wallet.levels);
          const full = level >= cap;
          const need = def.requires?.item === 'building' ? TIERS[def.requires.level] : undefined;
          return (
            <Pressable key={id} onPress={() => onItem(id)} disabled={!unlocked || full} style={[styles.card, id === item && styles.cardOn, (!unlocked || full) && styles.cardOff]}>
              <Image source={{ uri: icon(id) }} style={styles.icon} />
              <Text style={styles.name} numberOfLines={1}>
                {t(`up.${id}`)}
              </Text>
              {!unlocked && need ? (
                <View style={styles.row}>
                  <Text style={styles.small}>{t('ui.needsTier')}</Text>
                  <Text style={styles.small}>{t(`tier.${need.id}`)}</Text>
                </View>
              ) : (
                <View style={styles.row}>
                  <Text style={styles.effect}>{effectText(id)}</Text>
                  <Text style={styles.small}>{t(`stat.${def.effect.stat}`)}</Text>
                </View>
              )}
              <View style={styles.row}>
                <Text style={[styles.cost, !canBuyNow(def, wallet) && styles.costOff]}>{full ? t('ui.max') : formatBig(costOf(def, level))}</Text>
                {cap !== Infinity && <Text style={styles.small}>{`${level}/${cap}`}</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Clear of the settings gear in the bottom corner.
  wrap: { position: 'absolute', start: 72, end: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' },
  hint: {
    color: '#FFF4E3',
    fontWeight: '900',
    fontSize: 14,
    backgroundColor: panel.bg,
    borderColor: gold,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#35B957', borderColor: '#B9F5A8', borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, height: 40 },
  placeOff: { backgroundColor: '#4A3A52', borderColor: '#6A5A72' },
  placeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFC21A', borderWidth: 1.5, borderColor: '#9A6A00' },
  done: { backgroundColor: '#E9A23B', borderColor: '#FFE08A', borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  doneText: { color: '#2A1530', fontWeight: '900', fontSize: 14 },
  cards: { gap: 8, paddingHorizontal: 4 },
  card: { width: 118, backgroundColor: panel.bg, borderColor: '#5A3A6A', borderWidth: 2, borderRadius: 14, padding: 8, gap: 2, alignItems: 'center' },
  cardOn: { borderColor: gold, backgroundColor: panel.row },
  cardOff: { opacity: 0.5 },
  icon: { width: ICON_PX, height: ICON_PX },
  name: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  effect: { color: '#7EE08F', fontWeight: '900', fontSize: 11 },
  small: { color: '#C9B3D6', fontWeight: '700', fontSize: 11 },
  cost: { color: '#FFE9A8', fontWeight: '900', fontSize: 12 },
  costOff: { color: '#9A8AA2' },
});
