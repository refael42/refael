import { useEffect, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { TRUCK, TRUCK_SPOTS } from '../data/truck';
import { TIERS } from '../data/buildings';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { fromSave } from '../sim/big';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { rushCost, spotOpen, tripPay, truckOpen, upgradeCost } from '../sim/truck';
import { IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// The food truck (owner: idea 8): a round button at the bottom (the time left on its trip, a "!"
// when it is back), and its page: where to send it and what each trip brings, the trip on now,
// taking the takings, calling it back for gems, and upgrading it.

const icon = (px: number) => spriteIcon('truckIcon', Math.round(px * PixelRatio.get()));

/** "1:05:09", "4:32": hours only when there are some. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** The phone's clock, ticking once a second. */
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const readButton = (s: GameState) => (truckOpen(s) ? { end: s.truck.trip?.end ?? 0 } : null);

export function TruckButton({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readButton, 1);
  const now = useNow();
  if (!d) return null;
  const out = d.end > 0;
  const back = out && now >= d.end;
  return <SideButton label="truck" icon={icon(SIDE.icon)} caption={!out ? t('truck.button') : back ? t('truck.back') : clock(d.end - now)} ready={back || !out} badge={back ? '!' : undefined} onPress={onPress} style={style} />;
}

const readPanel = (s: GameState) => ({
  level: s.truck.level,
  trip: s.truck.trip ? `${s.truck.trip.spot}:${s.truck.trip.end}:${s.truck.trip.coins}:${s.truck.trip.gems}` : '',
  pays: TRUCK_SPOTS.map((_, i) => formatBig(tripPay(s, i).coins)).join('|'),
  open: TRUCK_SPOTS.map((_, i) => (spotOpen(s, i) ? 1 : 0)).join(''),
  cost: formatBig(upgradeCost(s)),
  afford: s.coins.gte(upgradeCost(s)),
  gems: s.gems,
});

export function TruckPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPanel, 2);
  const now = useNow();
  if (!d) return null;
  const pays = d.pays.split('|');
  const [spotS, endS, coinsS, gemsS] = d.trip ? d.trip.split(':') : [];
  const trip = d.trip ? { spot: Number(spotS), end: Number(endS), coins: formatBig(fromSave(coinsS!)), gems: Number(gemsS) } : null;
  const back = trip !== null && now >= trip.end;
  const rush = trip && !back && gameRef.current ? rushCost(gameRef.current, now) : 0;
  const act = (cmd: Command) => {
    tapFeedback();
    onCommand(cmd);
  };
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: icon(44) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('truck.title')}</Text>
          <Text style={styles.sub}>{t('truck.level').replace('{n}', String(d.level + 1))}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      {trip ? (
        <View style={styles.trip}>
          <Text style={styles.tripTitle}>{t(back ? 'truck.isBack' : 'truck.onTrip').replace('{p}', t(`truck.spot.${TRUCK_SPOTS[trip.spot]!.id}`))}</Text>
          {!back && <Text style={styles.timer}>{clock(trip.end - now)}</Text>}
          <View style={styles.payRow}>
            <IconText icon="hudCoin" size={18} textStyle={styles.pay}>{trip.coins}</IconText>
            {trip.gems > 0 && <IconText icon="hudGem" size={18} textStyle={styles.pay}>{`+${trip.gems}`}</IconText>}
          </View>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="truck-collect" onPress={() => act({ type: 'truckCollect', now: Date.now() })} style={styles.go}>
              <Text style={styles.goText}>{t('truck.collect')}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" disabled={d.gems < rush} onPress={() => act({ type: 'truckRush', now: Date.now() })} style={[styles.rush, d.gems < rush && styles.off]}>
              <IconText icon="hudGem" size={14} textStyle={styles.goText}>{`${t('truck.rush')} ${rush}`}</IconText>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView style={scrollFill} contentContainerStyle={styles.rows}>
          {TRUCK_SPOTS.map((sp, i) => {
            const open = d.open[i] === '1';
            return (
              <View key={sp.id} style={[styles.row, !open && styles.locked]}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{t(`truck.spot.${sp.id}`)}</Text>
                  <Text style={styles.desc}>{open ? `${clock(sp.minutes * 60000)} · ${t('truck.brings')}` : t('truck.from').replace('{b}', t(`tier.${TIERS[sp.minTier]?.id ?? 'grand'}`))}</Text>
                </View>
                {open && (
                  <View style={styles.payCol}>
                    <IconText icon="hudCoin" size={14} textStyle={styles.small}>{pays[i]!}</IconText>
                    {sp.gems > 0 && <IconText icon="hudGem" size={14} textStyle={styles.small}>{`+${sp.gems}`}</IconText>}
                  </View>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`truck-send-${sp.id}`} disabled={!open} onPress={() => act({ type: 'truckSend', spot: i, now: Date.now() })} style={[styles.send, !open && styles.off]}>
                  <Text style={styles.goText}>{t('truck.send')}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Text style={styles.footText}>{d.level >= TRUCK.maxLevel ? t('truck.max') : t('truck.upgrade').replace('{n}', String(Math.round(TRUCK.perLevel * 100)))}</Text>
        {d.level < TRUCK.maxLevel && (
          <Pressable accessibilityRole="button" disabled={!d.afford} onPress={() => act({ type: 'truckUpgrade' })} style={[styles.upgrade, !d.afford && styles.off]}>
            <IconText icon="hudCoin" size={14} textStyle={styles.goText}>{d.cost}</IconText>
          </Pressable>
        )}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 520, maxWidth: '95%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: '#D8352B', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#B82A22' },
  headerIcon: { width: 44, height: 44 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#FFE9D8', fontSize: 13, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  trip: { alignItems: 'center', gap: 8, padding: 16 },
  tripTitle: { color: '#FFF4E3', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  timer: { color: '#FFE27A', fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  payRow: { flexDirection: 'row', gap: 16 },
  pay: { color: '#FFE9A8', fontSize: 18, fontWeight: '900' },
  rows: { padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  locked: { opacity: 0.55 },
  rowText: { flex: 1 },
  name: { color: '#FFF4E3', fontSize: 14.5, fontWeight: '900' },
  desc: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700' },
  payCol: { alignItems: 'flex-end', gap: 2 },
  small: { color: '#FFE9A8', fontSize: 12.5, fontWeight: '900' },
  send: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  go: { height: 42, paddingHorizontal: 26, borderRadius: 21, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  rush: { height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: '#6A2C8F', borderWidth: 1.5, borderColor: '#C9A0FF', justifyContent: 'center' },
  off: { backgroundColor: '#5A4A62', borderColor: '#7A6A82' },
  goText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#4A2A54' },
  footText: { flex: 1, color: '#E8D7F0', fontSize: 12.5, fontWeight: '800' },
  upgrade: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#E2B13C', borderWidth: 1.5, borderColor: '#FFE9A8', justifyContent: 'center' },
});
