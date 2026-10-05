import { useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SHOP, type ShopItem } from '../data/shop';
import { useT } from '../i18n';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import type { Command, GameState } from '../sim/game/types';
import { canShop } from '../sim/shop';
import { gold, panel, textShadow } from './theme';

// The item shop (owner request: pay-to-win): gem packs (a demo, nothing is charged), income
// boosts and time warps, star workers, and permanent perks, all bought with gems.

type Tab = 'gems' | 'boosts' | 'staff' | 'forever';
const TABS: readonly Tab[] = ['gems', 'boosts', 'staff', 'forever'];
const TAB_OF: Record<ShopItem['kind'], Tab> = { gems: 'gems', boost: 'boosts', warp: 'boosts', star: 'staff', perk: 'forever', crew: 'forever' };
const TAB_ICON: Record<Tab, string> = { gems: '💎', boosts: '⚡', staff: '⭐', forever: '👑' };
const ICON: Record<string, string> = {
  gems80: '💎',
  gems500: '💰',
  gems1200: '🧰',
  gems3000: '🏦',
  boost2: '⚡',
  boost5: '🚀',
  warp1: '⏩',
  warp4: '⏭️',
  goldenMenu: '📜',
  vipSign: '🌟',
  turboKitchen: '🔥',
  charmSchool: '💐',
  crew3: '👷',
  crew4: '🏗️',
};

const gemUri = (px: number) => hudIcon('hudGem', Math.round(px * PixelRatio.get()));

/** What the cards need, read a few times a second. */
const readShop = (s: GameState) => ({
  gems: s.gems,
  can: Object.fromEntries(SHOP.map((i) => [i.id, canShop(s, i)])) as Record<string, boolean>,
  owned: { ...s.perks },
});

function Title({ item }: { item: ShopItem }) {
  const t = useT();
  if (item.kind === 'star') {
    return (
      <View style={styles.line}>
        <Text style={styles.name}>{t('shop.star')}</Text>
        <Text style={styles.name}>{t(`role.${item.role}`)}</Text>
      </View>
    );
  }
  return <Text style={styles.name}>{t(`shop.${item.id}`)}</Text>;
}

/** What it does, numbers kept apart from the words. */
function Description({ item }: { item: ShopItem }) {
  const t = useT();
  switch (item.kind) {
    case 'gems':
      return (
        <View style={styles.line}>
          <Image source={{ uri: gemUri(16) }} style={styles.gemSmall} />
          <Text style={styles.big}>{item.gems}</Text>
        </View>
      );
    case 'boost':
      return (
        <View style={styles.line}>
          <Text style={styles.strong}>{`x${item.mult}`}</Text>
          <Text style={styles.desc}>{t('shop.incomeFor')}</Text>
          <Text style={styles.strong}>{item.minutes}</Text>
          <Text style={styles.desc}>{t('shop.minutes')}</Text>
        </View>
      );
    case 'warp':
      return (
        <View style={styles.line}>
          <Text style={styles.desc}>{t('shop.warpGet')}</Text>
          <Text style={styles.strong}>{item.hours}</Text>
          <Text style={styles.desc}>{t('shop.hoursOfIncome')}</Text>
        </View>
      );
    case 'star':
      return <Text style={styles.desc}>{t('shop.starDesc')}</Text>;
    case 'perk':
      return <Text style={styles.desc}>{t(`shop.${item.id}Desc`)}</Text>;
    case 'crew':
      return <Text style={styles.desc}>{t('shop.crewDesc')}</Text>;
  }
}

interface Props {
  gameRef: { current: GameState | null };
  onCommand: (cmd: Command) => void;
  onClose: () => void;
  initialTab?: Tab;
}

export function Shop({ gameRef, onCommand, onClose, initialTab = 'boosts' }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirm, setConfirm] = useState<(ShopItem & { kind: 'gems' }) | null>(null);
  const data = usePoll(gameRef, readShop, 4);
  if (!data) return null;
  const items = SHOP.filter((i) => TAB_OF[i.kind] === tab);
  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={() => undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('shop.title')}</Text>
          <View style={styles.wallet}>
            <Image source={{ uri: gemUri(22) }} style={styles.gem} />
            <Text style={styles.walletText}>{data.gems}</Text>
          </View>
          <View style={styles.grow} />
          <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
            <Text style={styles.closeText}>{'✕'}</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          {TABS.map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, k === tab && styles.tabOn]}>
              <Text style={[styles.tabText, k === tab && styles.tabTextOn]}>{`${TAB_ICON[k]} ${t(`shop.tab${k[0]!.toUpperCase()}${k.slice(1)}`)}`}</Text>
            </Pressable>
          ))}
        </View>
        {tab === 'gems' && <Text style={styles.demo}>{t('shop.demo')}</Text>}
        <ScrollView contentContainerStyle={styles.grid}>
          {items.map((item) => {
            const can = data.can[item.id] ?? false;
            const owned = (item.kind === 'perk' || item.kind === 'crew') && data.owned[item.id] === 1;
            const short = item.kind !== 'gems' && data.gems < item.cost;
            return (
              <View key={item.id} style={[styles.item, item.kind === 'gems' && item.tag && styles.itemTagged]}>
                {item.kind === 'gems' && item.tag && (
                  <Text style={styles.tag}>{t(item.tag === 'best' ? 'shop.best' : 'shop.popular')}</Text>
                )}
                <Text style={styles.icon}>{item.kind === 'star' ? '⭐' : ICON[item.id] ?? '🎁'}</Text>
                <Title item={item} />
                <Description item={item} />
                {item.kind === 'gems' ? (
                  <Pressable accessibilityRole="button" onPress={() => setConfirm(item)} style={[styles.buy, styles.buyMoney]}>
                    <Text style={styles.buyText}>{item.price}</Text>
                  </Pressable>
                ) : owned ? (
                  <Text style={styles.owned}>{`✓ ${t('shop.owned')}`}</Text>
                ) : short ? (
                  <Pressable accessibilityRole="button" onPress={() => setTab('gems')} style={[styles.buy, styles.buyShort]}>
                    <Image source={{ uri: gemUri(16) }} style={styles.gemSmall} />
                    <Text style={styles.buyText}>{item.cost}</Text>
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" disabled={!can} onPress={() => onCommand({ type: 'shop', item: item.id })} style={[styles.buy, !can && styles.buyOff]}>
                    <Image source={{ uri: gemUri(16) }} style={styles.gemSmall} />
                    <Text style={styles.buyText}>{can ? item.cost : t('shop.noRoom')}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
        {confirm && (
          <View style={styles.confirmWrap}>
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>{t(`shop.${confirm.id}`)}</Text>
              <View style={styles.line}>
                <Image source={{ uri: gemUri(22) }} style={styles.gem} />
                <Text style={styles.walletText}>{confirm.gems}</Text>
              </View>
              <Text style={styles.desc}>{t('shop.confirm')}</Text>
              <Text style={styles.demoSmall}>{t('shop.demo')}</Text>
              <View style={styles.line}>
                <Pressable accessibilityRole="button" onPress={() => setConfirm(null)} style={[styles.buy, styles.buyOff]}>
                  <Text style={styles.buyText}>{t('shop.cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onCommand({ type: 'gems', amount: confirm.gems });
                    setConfirm(null);
                  }}
                  style={styles.buy}
                >
                  <Text style={styles.buyText}>{t('shop.buyDemo')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

/** The gem counter under the coins; tapping it opens the shop. */
const readGems = (s: GameState) => ({ gems: s.gems, boost: s.time < s.boost.until ? { mult: s.boost.mult, left: s.boost.until - s.time } : null });
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** The gem counter under the coins (and a running boost's time); tapping it opens the shop. */
export function GemPill({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: object }) {
  const g = usePoll(gameRef, readGems, 2);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="shop" onPress={onPress} hitSlop={6} style={[styles.pill, style]}>
      <Image source={{ uri: gemUri(26) }} style={styles.pillGem} />
      <Text style={styles.pillText}>{g?.gems ?? 0}</Text>
      <View style={styles.plus}>
        <Text style={styles.plusText}>+</Text>
      </View>
      {g?.boost && (
        <View style={styles.boost}>
          <Text style={styles.boostText}>{`⚡x${g.boost.mult} ${clock(g.boost.left)}`}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 620,
    maxWidth: '96%',
    maxHeight: '94%',
    backgroundColor: panel.bg,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: gold,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    boxShadow: '0px 6px 0px #120818',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 20, fontWeight: '900' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E0E24', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 2 },
  walletText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  gem: { width: 22, height: 22 },
  gemSmall: { width: 16, height: 16 },
  grow: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tab: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: '#3A1D40', justifyContent: 'center' },
  tabOn: { backgroundColor: gold },
  tabText: { color: '#E8D7F0', fontWeight: '800', fontSize: 13 },
  tabTextOn: { color: '#2A1530' },
  demo: { color: '#9CF5A8', fontSize: 12, fontWeight: '800', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  item: {
    width: 140,
    flexGrow: 1,
    backgroundColor: panel.row,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemTagged: { borderColor: gold },
  tag: { position: 'absolute', top: -2, end: 6, backgroundColor: '#E5483B', color: '#FFFFFF', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  icon: { fontSize: 30 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  name: { color: '#FFF4E3', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  desc: { color: '#C9B3D6', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  strong: { color: '#FFE27A', fontSize: 13, fontWeight: '900' },
  big: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', ...textShadow('#120818', 1, 0) },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', marginTop: 2 },
  buyMoney: { backgroundColor: '#2F7FE0', borderColor: '#A8D4FF' },
  buyShort: { backgroundColor: '#6A3A72', borderColor: '#9A7AA2' },
  buyOff: { backgroundColor: '#4A3A52', borderColor: '#6A5A72' },
  buyText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  owned: { color: '#7EE08F', fontWeight: '900', fontSize: 13, marginTop: 8 },
  confirmWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.6)', alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  confirm: { backgroundColor: panel.bg, borderWidth: 2.5, borderColor: gold, borderRadius: 18, padding: 16, gap: 8, alignItems: 'center', width: 300, maxWidth: '90%' },
  confirmTitle: { color: '#FFE9A8', fontSize: 18, fontWeight: '900' },
  demoSmall: { color: '#9CF5A8', fontSize: 11, fontWeight: '800' },
  pill: {
    position: 'absolute',
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 15,
    paddingStart: 26,
    paddingEnd: 4,
    gap: 6,
    backgroundColor: 'rgba(40,16,50,0.93)',
    borderWidth: 2,
    borderColor: '#9C7BFF',
    boxShadow: '0px 2px 0px rgba(18,8,24,0.85)',
  },
  pillGem: { position: 'absolute', left: -6, top: -6, width: 34, height: 34 },
  pillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', minWidth: 20, ...textShadow('#120818', 1, 0) },
  plus: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#35B957', alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 18 },
  boost: { backgroundColor: '#FF7A1A', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginEnd: 2 },
  boostText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
