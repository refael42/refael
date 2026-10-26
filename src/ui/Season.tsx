import { useState } from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { SEASON, SEASON_TIERS, type MissionKind, type SeasonReward } from '../data/season';
import type { Purchases } from '../iap/usePurchases';
import { useT } from '../i18n';
import type { HudIcon } from '../render/art/hudArt';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { missionDone, missionHave, missionsReady, seasonBonus, seasonCoins, seasonEnds, seasonPrizes, tiersReached, type Mission } from '../sim/season';
import { countdown, shortTime } from './Festival';
import { GameIcon, IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// The season pass (owner M50). A round button in the events row (the season's days left, a
// badge for missions and prizes waiting); the page has two tabs: the missions (today's three,
// the weeks' five) and the prize track, tier by tier, free above and gold below. The gold pass
// is bought here, in the store or with gems.

const GOLD = '#F2C14E';
const PURPLE = '#7B3FA0';

const MISSION_ICON: Record<MissionKind, HudIcon> = {
  serve: 'iconPlate',
  fiveStar: 'hudStar',
  hot: 'iconFlame',
  request: 'iconLeaf',
  prep: 'iconChef',
  upgrades: 'iconHammer',
  rush: 'iconBolt',
  dessert: 'iconRosette',
  drink: 'iconCocktail',
  delivery: 'iconScooter',
  caught: 'iconMagnifier',
};

const readChip = (s: GameState) => {
  const ss = s.season;
  if (ss.id < 0) return null;
  return { waiting: missionsReady(ss) + seasonPrizes(ss), left: Math.max(0, Math.ceil((seasonEnds(ss.id) - Date.now()) / 1000)) };
};

/** In the events row: the season's days left; missions and prizes waiting glow. */
export function SeasonChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  if (!d) return null;
  return (
    <SideButton
      label="season"
      icon={hudIcon('iconCrown', Math.round(SIDE.icon * PixelRatio.get()))}
      caption={shortTime(d.left, t)}
      hurry={d.left < SEASON.hurryDays * 86400}
      ready={d.waiting > 0}
      badge={d.waiting > 0 ? d.waiting : undefined}
      onPress={onPress}
      style={style}
    />
  );
}

/** Prizes waiting in the season (for the events button's badge). */
export const seasonWaiting = (s: GameState): number => (s.season.id < 0 ? 0 : missionsReady(s.season) + seasonPrizes(s.season));

interface MissionRow {
  kind: MissionKind;
  have: number;
  need: number;
  xp: number;
  done: boolean;
  claimed: boolean;
  weekly: boolean;
  index: number;
  week?: number;
}

const rowOf = (s: GameState, m: Mission, weekly: boolean, index: number): MissionRow => ({
  kind: m.kind, have: missionHave(s.season, m), need: m.need, xp: m.xp, done: missionDone(s.season, m), claimed: m.claimed, weekly, index, week: m.week,
});

const readSeason = (s: GameState) => {
  const ss = s.season;
  if (ss.id < 0) return null;
  const now = Date.now();
  const tierLeft = ss.xp % SEASON.tierXp;
  // Missions waiting to be taken first, then the open ones, the taken ones last.
  const order = (r: MissionRow) => (r.claimed ? 2 : r.done ? 0 : 1);
  const weekly = ss.weekly.map((m, i) => rowOf(s, m, true, i)).sort((a, b) => order(a) - order(b) || (b.week ?? 0) - (a.week ?? 0));
  return {
    id: ss.id,
    xp: ss.xp,
    tier: tiersReached(ss),
    tierLeft,
    gold: ss.gold,
    free: ss.free,
    goldTaken: ss.goldTaken,
    extra: ss.extra,
    prizes: seasonPrizes(ss),
    left: Math.max(0, Math.ceil((seasonEnds(ss.id) - now) / 1000)),
    // To local midnight: when today's missions change.
    dayLeft: Math.max(0, Math.ceil(((ss.day + 1) * 86400000 + new Date(now).getTimezoneOffset() * 60000 - now) / 1000)),
    daily: JSON.stringify(ss.daily.map((m, i) => rowOf(s, m, false, i))),
    weekly: JSON.stringify(weekly),
    coins: [...SEASON.free, ...SEASON.gold].map((r) => (r.kind === 'coins' ? formatBig(seasonCoins(s, r)) : '')).join('|'),
    medals: `${ss.medals.free},${ss.medals.gold}`,
    bonus: Math.round((seasonBonus(s) - 1) * 100),
    gems: s.gems,
  };
};

/** "Serve 30 hot plates" in the player's language. */
const missionText = (t: (k: string) => string, r: MissionRow) => t(`season.m.${r.kind}`).replace('{n}', String(r.need));

function Prize({ r, coins, size }: { r: SeasonReward; coins: string; size: number }) {
  const t = useT();
  const label = (icon: HudIcon, text: string) => (
    <>
      <GameIcon name={icon} size={size} />
      <Text numberOfLines={1} style={styles.prizeText}>{text}</Text>
    </>
  );
  switch (r.kind) {
    case 'coins':
      return label('hudCoin', coins);
    case 'gems':
      return label('hudGem', `+${r.gems}`);
    case 'spins':
      return label('iconGift', `x${r.spins}`);
    case 'boost':
      return label('iconBolt', `x${r.mult} ${r.minutes}${t('fest.min')}`);
    case 'talent':
      return label('iconTalent', `+${r.points}`);
    case 'medal':
      return label('iconTrophy', `+${r.gems}`);
  }
}

type Data = NonNullable<ReturnType<typeof readSeason>>;

function Missions({ d, onCommand }: { d: Data; onCommand: (cmd: Command) => void }) {
  const t = useT();
  const daily = JSON.parse(d.daily) as MissionRow[];
  const weekly = JSON.parse(d.weekly) as MissionRow[];
  const row = (r: MissionRow) => (
    <View key={`${r.weekly ? 'w' : 'd'}${r.index}`} style={[styles.mission, r.done && !r.claimed && styles.missionReady, r.claimed && styles.missionTaken]}>
      <GameIcon name={MISSION_ICON[r.kind]} size={30} />
      <View style={styles.missionBody}>
        <Text numberOfLines={2} style={styles.missionText}>{missionText(t, r)}</Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.round((100 * r.have) / r.need)}%` }]} />
          <Text style={styles.barText}>{`${r.have}/${r.need}`}</Text>
        </View>
      </View>
      {r.claimed ? (
        <Text style={styles.check}>{'✓'}</Text>
      ) : r.done ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tapFeedback();
            onCommand({ type: 'seasonMission', weekly: r.weekly, index: r.index });
          }}
          style={styles.take}
        >
          <Text style={styles.takeText}>{`+${r.xp} XP`}</Text>
        </Pressable>
      ) : (
        <Text style={styles.xp}>{`${r.xp} XP`}</Text>
      )}
    </View>
  );
  return (
    <ScrollView style={scrollFill} contentContainerStyle={styles.missions}>
      <IconText icon="iconCalendar" size={16} textStyle={styles.section}>{`${t('season.daily')} · ${t('season.newIn')} ${countdown(d.dayLeft, t)}`}</IconText>
      {daily.map(row)}
      <IconText icon="iconTrophy" size={16} textStyle={styles.section}>{t('season.weekly')}</IconText>
      {weekly.map(row)}
      <Text style={styles.hint}>{t('season.weeklyHint')}</Text>
    </ScrollView>
  );
}

function Track({ d, onCommand, purchases }: { d: Data; onCommand: (cmd: Command) => void; purchases: Purchases }) {
  const t = useT();
  const coins = d.coins.split('|');
  const take = (track: 'free' | 'gold') => () => {
    tapFeedback();
    onCommand({ type: 'seasonClaim', track });
  };
  const price = purchases.prices[SEASON.goldProduct];
  return (
    <>
      {!d.gold && (
        <View style={styles.goldCard}>
          <GameIcon name="iconCrown" size={34} />
          <View style={styles.goldBody}>
            <Text style={styles.goldTitle}>{t('season.goldTitle')}</Text>
            <Text style={styles.goldDesc}>{t('season.goldDesc').replace('{n}', String(Math.round(SEASON.medal.gold * 100)))}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!price || purchases.busy !== null}
            onPress={() => {
              tapFeedback();
              purchases.buy(SEASON.goldProduct);
            }}
            style={[styles.goldBuy, (!price || purchases.busy !== null) && styles.off]}
          >
            <Text style={styles.goldBuyText}>{purchases.busy === SEASON.goldProduct ? '…' : price ?? '—'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={d.gems < SEASON.goldGems}
            onPress={() => {
              tapFeedback();
              onCommand({ type: 'seasonGold' });
            }}
            style={[styles.goldGems, d.gems < SEASON.goldGems && styles.off]}
          >
            <IconText icon="hudGem" size={14} textStyle={styles.goldBuyText}>{String(SEASON.goldGems)}</IconText>
          </Pressable>
        </View>
      )}
      {d.prizes > 1 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tapFeedback();
            // Each takes the next prize on its track (in order); extra ones do nothing.
            for (let i = 0; i < d.prizes; i++) {
              onCommand({ type: 'seasonClaim', track: 'free' });
              onCommand({ type: 'seasonClaim', track: 'gold' });
            }
          }}
          style={styles.takeAll}
        >
          <Text style={styles.takeText}>{`${t('season.takeAll')} (${d.prizes})`}</Text>
        </Pressable>
      )}
      <ScrollView horizontal style={scrollFill} contentContainerStyle={styles.track}>
        <View style={styles.labels}>
          <Text style={styles.trackLabel}>{t('season.free')}</Text>
          <IconText icon="iconCrown" size={14} textStyle={[styles.trackLabel, { color: GOLD }]}>{t('season.gold')}</IconText>
        </View>
        {SEASON.free.map((free, i) => {
          const reached = i < d.tier;
          const cell = (track: 'free' | 'gold', r: SeasonReward, taken: number) => {
            const done = i < taken;
            const ready = reached && !done && (track === 'free' || d.gold);
            const locked = track === 'gold' && !d.gold;
            return (
              <View style={[styles.cell, track === 'gold' && styles.cellGold, i === SEASON_TIERS - 1 && styles.cellLast, ready && styles.cellReady, done && styles.cellDone]}>
                <Prize r={r} coins={coins[(track === 'gold' ? SEASON_TIERS : 0) + i] ?? ''} size={i === SEASON_TIERS - 1 ? 34 : 24} />
                {ready ? (
                  <Pressable accessibilityRole="button" disabled={i !== taken} onPress={take(track)} style={[styles.takeSmall, i !== taken && styles.off]}>
                    <Text style={styles.takeText}>{t('fest.take')}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cellMark}>{done ? '✓' : locked ? '🔒' : ''}</Text>
                )}
              </View>
            );
          };
          return (
            <View key={i} style={styles.tier}>
              <Text style={[styles.tierNum, reached && styles.tierNumOn]}>{i + 1}</Text>
              {cell('free', free, d.free)}
              {cell('gold', SEASON.gold[i]!, d.goldTaken)}
            </View>
          );
        })}
        <View style={styles.tier}>
          <Text style={styles.tierNum}>{'30+'}</Text>
          <View style={[styles.cell, styles.cellExtra]}>
            <Prize r={SEASON.extra} coins="" size={24} />
            {d.free >= SEASON_TIERS && d.tier >= SEASON_TIERS && Math.floor(d.xp / SEASON.tierXp) - SEASON_TIERS > d.extra ? (
              <Pressable accessibilityRole="button" onPress={take('free')} style={styles.takeSmall}>
                <Text style={styles.takeText}>{t('fest.take')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.cellMark}>{t('season.extra')}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

export function SeasonPanel({ gameRef, onCommand, onClose, purchases }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void; purchases: Purchases }) {
  const t = useT();
  const d = usePoll(gameRef, readSeason, 2);
  const [tab, setTab] = useState<'missions' | 'track'>('missions');
  if (!d) return null;
  const [free, gold] = d.medals.split(',').map(Number) as [number, number];
  const maxed = d.tier >= SEASON_TIERS;
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={[styles.header, d.gold && styles.headerGold]}>
        <GameIcon name="iconCrown" size={40} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('season.title').replace('{n}', String(d.id + 1))}</Text>
          <IconText icon="iconTimer" size={14} textStyle={styles.ends}>{`${t('fest.endsIn')} ${countdown(d.left, t)}`}</IconText>
        </View>
        <View style={styles.tierBox}>
          <Text style={styles.tierValue}>{d.tier}</Text>
          <Text style={styles.tierLabel}>{t('season.tier')}</Text>
        </View>
        <View style={styles.xpBox}>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${maxed ? 100 : Math.round((100 * d.tierLeft) / SEASON.tierXp)}%` }]} />
          </View>
          <Text style={styles.xpText}>{maxed ? t('season.maxed') : `${d.tierLeft}/${SEASON.tierXp} XP`}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {(['missions', 'track'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="tab" onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{t(`season.tab.${k}`)}</Text>
            {k === 'track' && d.prizes > 0 && <Text style={styles.tabBadge}>{d.prizes}</Text>}
          </Pressable>
        ))}
      </View>
      {tab === 'missions' ? <Missions d={d} onCommand={onCommand} /> : <Track d={d} onCommand={onCommand} purchases={purchases} />}
      <View style={styles.footer}>
        <IconText icon="iconTrophy" size={16} textStyle={styles.footerText}>
          {free + gold > 0 ? t('season.medals').replace('{s}', String(free)).replace('{g}', String(gold)).replace('{n}', String(d.bonus)) : t('season.medalHint').replace('{n}', String(Math.round(SEASON.medal.free * 100)))}
        </IconText>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 720, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: GOLD, overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: PURPLE },
  headerGold: { backgroundColor: '#B8862A' },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  ends: { color: '#FFF4E3', fontSize: 13, fontWeight: '800' },
  tierBox: { alignItems: 'center', backgroundColor: 'rgba(42,21,48,0.55)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  tierValue: { color: '#FFE27A', fontSize: 22, fontWeight: '900' },
  tierLabel: { color: '#FFF4E3', fontSize: 10.5, fontWeight: '800' },
  xpBox: { width: 130, gap: 2 },
  xpBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(42,21,48,0.6)', overflow: 'hidden' },
  xpFill: { height: 10, backgroundColor: '#7EE08F' },
  xpText: { color: '#FFF4E3', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.6)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 10, backgroundColor: panel.row },
  tabOn: { backgroundColor: '#4A2252', borderWidth: 1.5, borderColor: GOLD },
  tabText: { color: '#C9B3D6', fontSize: 14, fontWeight: '900' },
  tabTextOn: { color: '#FFE9A8' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: '#E5372B', color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },
  missions: { gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  section: { color: '#FFE9A8', fontSize: 14, fontWeight: '900', marginTop: 2 },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 2, borderColor: 'transparent' },
  missionReady: { borderColor: '#7EE08F', backgroundColor: '#24502F' },
  missionTaken: { opacity: 0.5 },
  missionBody: { flex: 1, gap: 4 },
  missionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bar: { height: 14, borderRadius: 7, backgroundColor: 'rgba(42,21,48,0.7)', overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#35B957' },
  barText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', textAlign: 'center' },
  xp: { color: '#E8C76A', fontSize: 12, fontWeight: '900', minWidth: 54, textAlign: 'center' },
  check: { color: '#7EE08F', fontSize: 18, fontWeight: '900', minWidth: 54, textAlign: 'center' },
  take: { height: 30, minWidth: 54, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center', alignItems: 'center' },
  takeSmall: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  takeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  takeAll: { alignSelf: 'center', height: 30, paddingHorizontal: 18, marginTop: 8, borderRadius: 15, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  hint: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  goldCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 8, padding: 8, borderRadius: 14, backgroundColor: '#4A3412', borderWidth: 2, borderColor: GOLD },
  goldBody: { flex: 1 },
  goldTitle: { color: '#FFE27A', fontSize: 15, fontWeight: '900' },
  goldDesc: { color: '#FFF4E3', fontSize: 11.5, fontWeight: '700' },
  goldBuy: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  goldGems: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#5B8EDB', borderWidth: 1.5, borderColor: '#BFE6FF', justifyContent: 'center' },
  goldBuyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  off: { opacity: 0.45 },
  track: { flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  labels: { justifyContent: 'flex-end', gap: 6, paddingBottom: 0 },
  trackLabel: { color: '#FFE9A8', fontSize: 12, fontWeight: '900', height: 88, textAlignVertical: 'center', lineHeight: 88 },
  tier: { alignItems: 'center', gap: 6 },
  tierNum: { color: '#B9A3C6', fontSize: 13, fontWeight: '900' },
  tierNumOn: { color: '#FFE27A' },
  cell: { width: 70, height: 88, borderRadius: 12, backgroundColor: panel.row, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderWidth: 2, borderColor: 'transparent' },
  cellGold: { backgroundColor: '#4A3412' },
  cellLast: { borderColor: GOLD },
  cellExtra: { height: 182 },
  cellReady: { borderColor: '#7EE08F', backgroundColor: '#24502F' },
  cellDone: { opacity: 0.45 },
  cellMark: { color: '#E8C76A', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  prizeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 12, paddingTop: 8 },
  footerText: { color: '#7EE08F', fontSize: 12.5, fontWeight: '800' },
});

