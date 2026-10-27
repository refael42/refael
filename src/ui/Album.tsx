import { useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { ALBUM, ALBUM_PAGES, STICKERS, type StickerDef } from '../data/album';
import { useT } from '../i18n';
import { lookIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { albumReady, pageReady, stickerLevel, stickerReady } from '../sim/album';
import type { Command, GameState } from '../sim/game/types';
import { GameIcon, IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// The customer album (owner M52). A round button in the events row (a badge for rewards
// waiting); the page shows three pages of stickers: each guest kind met, its stars, what is
// still missing (as a shadow with a hint), and the page's lasting bonus.

const portrait = (st: StickerDef, px: number) => lookIcon(st.id, st.look, st.rank ?? 0, Math.round(px * PixelRatio.get()));

const readChip = (s: GameState) => ({ ready: albumReady(s.album), found: STICKERS.filter((st) => stickerLevel(s.album, st.id) > 0).length });

export function AlbumChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const d = usePoll(gameRef, readChip, 1);
  if (!d) return null;
  return (
    <SideButton
      label="album"
      icon={portrait(STICKERS[0]!, SIDE.icon)}
      caption={`${d.found}/${STICKERS.length}`}
      ready={d.ready > 0}
      badge={d.ready > 0 ? d.ready : undefined}
      onPress={onPress}
      style={style}
    />
  );
}

/** Rewards waiting in the album (the events button's badge). */
export const albumWaiting = (s: GameState): number => albumReady(s.album);

const readAlbum = (s: GameState) => ({
  // Per sticker: level, rewards waiting, how many served (joined: a string compares cheaply).
  stickers: STICKERS.map((st) => `${stickerLevel(s.album, st.id)}:${stickerReady(s.album, st.id)}:${s.album.counts[st.id] ?? 0}`).join('|'),
  pages: ALBUM_PAGES.map((_, i) => {
    const r = pageReady(s.album, i);
    return `${s.album.pages[i] ?? 0}:${r.full ? 1 : 0}:${r.gold ? 1 : 0}`;
  }).join('|'),
});

export function AlbumPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readAlbum, 2);
  const [pageIndex, setPage] = useState(0);
  if (!d) return null;
  const stickers = new Map(STICKERS.map((st, i) => {
    const [level, ready, count] = d.stickers.split('|')[i]!.split(':').map(Number) as [number, number, number];
    return [st.id, { level, ready, count }];
  }));
  const pages = d.pages.split('|').map((p) => p.split(':').map(Number) as [number, number, number]);
  const page = ALBUM_PAGES[pageIndex]!;
  const [bits, full, gold] = pages[pageIndex]!;
  const found = page.stickers.filter((st) => stickers.get(st.id)!.level > 0).length;
  const golds = page.stickers.filter((st) => stickers.get(st.id)!.level >= 4).length;
  const total = STICKERS.filter((st) => stickers.get(st.id)!.level > 0).length;
  return (
    <Overlay onClose={onClose} card={[styles.card, { borderColor: page.color }]}>
      <View style={[styles.header, { backgroundColor: page.color }]}>
        <GameIcon name="iconBook" size={36} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('album.title')}</Text>
          <Text style={styles.sub}>{t('album.found').replace('{n}', String(total)).replace('{m}', String(STICKERS.length))}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {ALBUM_PAGES.map((p, i) => {
          const waiting = p.stickers.reduce((n, st) => n + stickers.get(st.id)!.ready, 0) + pages[i]![1] + pages[i]![2];
          return (
            <Pressable key={p.id} accessibilityRole="tab" onPress={() => setPage(i)} style={[styles.tab, i === pageIndex && { backgroundColor: p.color, borderColor: '#FFE9A8' }]}>
              <Text style={[styles.tabText, i === pageIndex && styles.tabTextOn]}>{t(`album.page.${p.id}`)}</Text>
              {waiting > 0 && <Text style={styles.tabBadge}>{waiting}</Text>}
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.grid}>
        {page.stickers.map((st) => {
          const v = stickers.get(st.id)!;
          const met = v.level > 0;
          const next = ALBUM.stars[Math.max(0, v.level - 1)];
          return (
            <View key={st.id} style={[styles.sticker, met && styles.stickerMet, v.level >= 4 && styles.stickerGold, v.ready > 0 && styles.stickerReady]}>
              <Image source={{ uri: portrait(st, 64) }} style={[styles.portrait, !met && styles.shadow]} />
              <Text numberOfLines={1} style={[styles.name, !met && styles.nameHidden]}>{met ? t(`album.name.${st.id}`) : '???'}</Text>
              {met ? (
                <>
                  <View style={styles.stars}>
                    {ALBUM.stars.map((_, k) => (
                      <Text key={k} style={[styles.star, v.level >= k + 2 && (k === 0 ? styles.bronze : k === 1 ? styles.silver : styles.gold)]}>{'★'}</Text>
                    ))}
                  </View>
                  <Text style={styles.count}>{next !== undefined && v.level < 4 ? `${v.count}/${next}` : `${v.count}`}</Text>
                </>
              ) : (
                <Text numberOfLines={3} style={styles.hint}>{t(`album.hint.${st.id}`)}</Text>
              )}
              {v.ready > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    tapFeedback();
                    onCommand({ type: 'albumSticker', id: st.id });
                  }}
                  style={styles.take}
                >
                  <IconText icon="hudGem" size={12} textStyle={styles.takeText}>{`+${v.level - v.ready === 0 ? ALBUM.stickerGems : ALBUM.starGems[v.level - v.ready - 1]}`}</IconText>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={styles.perk}>{`${t('album.pageReward')} ${t(`album.perk.${page.perk.stat}`).replace('{n}', String(Math.round((page.perk.mult - 1) * 100)))}`}</Text>
          <Text style={styles.progress}>
            {(bits & 1) === 0 ? t('album.pageProgress').replace('{n}', String(found)) : (bits & 2) === 0 ? t('album.goldProgress').replace('{n}', String(golds)) : t('album.pageDone')}
          </Text>
        </View>
        {(full === 1 || gold === 1) && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tapFeedback();
              onCommand({ type: 'albumPage', page: pageIndex });
            }}
            style={styles.pageTake}
          >
            <IconText icon="hudGem" size={14} textStyle={styles.takeText}>{`+${full === 1 ? ALBUM.pageGems : ALBUM.goldGems}`}</IconText>
          </Pressable>
        )}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 720, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#FFF4E3', fontSize: 13, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: panel.row, borderWidth: 1.5, borderColor: 'transparent' },
  tabText: { color: '#C9B3D6', fontSize: 14, fontWeight: '900' },
  tabTextOn: { color: '#FFFFFF' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: '#E5372B', color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  sticker: { width: 104, minHeight: 168, borderRadius: 14, backgroundColor: '#2A1832', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, gap: 2, borderWidth: 2, borderColor: '#4A2A54', borderStyle: 'dashed' },
  stickerMet: { backgroundColor: '#FFF6E3', borderStyle: 'solid', borderColor: '#E8C76A' },
  stickerGold: { borderColor: '#F2C14E', borderWidth: 3 },
  stickerReady: { borderColor: '#35B957', borderWidth: 3 },
  portrait: { width: 64, height: 64 },
  shadow: { tintColor: '#120A16', opacity: 0.7 },
  name: { color: '#2A1530', fontSize: 13, fontWeight: '900' },
  nameHidden: { color: '#8A7396' },
  stars: { flexDirection: 'row', gap: 2 },
  star: { color: '#D8CCE0', fontSize: 15, fontWeight: '900' },
  bronze: { color: '#C77B3A' },
  silver: { color: '#9AA6B4' },
  gold: { color: '#E5A800' },
  count: { color: '#6E5A7A', fontSize: 11.5, fontWeight: '800' },
  hint: { color: '#B9A3C6', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  take: { marginTop: 2, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  takeText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  footerText: { flex: 1 },
  perk: { color: '#FFE9A8', fontSize: 12.5, fontWeight: '900' },
  progress: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700' },
  pageTake: { height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
});
