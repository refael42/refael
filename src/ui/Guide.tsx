import { hudIcon } from '../render/icons';
import { SIDE, SideButton } from './SideButton';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle, PixelRatio } from 'react-native';
import { GUIDE, verdictOf } from '../data/guide';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { guideProgress, scoreOf, scoreParts } from '../sim/game/guide';
import { GuideMark } from './GuideCards';
import type { GameState } from '../sim/game/types';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';
import { GameIcon, IconText } from './GameIcon';
import type { HudIcon } from '../render/art/hudArt';

// The restaurant guide on screen (owner M29: "Michelin logic"): a chip under the stars with the
// guide's mark, a page that explains how inspectors judge and how the kitchen stands, and a card
// when a new edition comes out.

/** The guide's mark: red rosettes for stars, the plate for "recommended". */
export const rosettes = (stars: number, plate: boolean): string => (stars > 0 ? '✿'.repeat(stars) : plate ? '🍽' : '—');

const readChip = (s: GameState) => ({
  stars: s.guide.stars,
  plate: s.guide.plate,
  // Days until the next edition.
  days: GUIDE.everyDays - (s.day % GUIDE.everyDays),
});

export function GuideChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const d = usePoll(gameRef, readChip, 1);
  if (!d) return null;
  return <SideButton label="guide" icon={hudIcon('hudBook', Math.round(SIDE.icon * PixelRatio.get()))} caption={d.stars > 0 || d.plate ? rosettes(d.stars, d.plate) : undefined} onPress={onPress} style={style} />;
}

const PARTS = ['chef', 'mastery', 'equipment', 'ingredients', 'temperature', 'consistency'] as const;
const PART_ICON: Record<(typeof PARTS)[number], HudIcon> = { chef: 'iconChef', mastery: 'hudScroll', equipment: 'shopTurbo', ingredients: 'iconLeaf', temperature: 'iconFlame', consistency: 'iconCheck' };

const readPage = (s: GameState) => {
  const parts = scoreParts(s, null, s.time + GUIDE.hotSeconds);
  return {
    stars: s.guide.stars,
    plate: s.guide.plate,
    edition: s.guide.edition,
    days: GUIDE.everyDays - (s.day % GUIDE.everyDays),
    visits: s.guide.visits.map((v) => `${v.day}:${verdictOf(v.score)}`).join('|'),
    last: s.guide.last ? `${s.guide.last.stars}|${s.guide.last.change}|${s.guide.last.visits}|${s.guide.last.plate ? 1 : 0}` : '',
    now: scoreOf(s, null, s.time + GUIDE.hotSeconds),
    rumor: s.guide.rumor ? (s.guide.attention >= 0 ? 2 : 1) : 0,
    progress: JSON.stringify(guideProgress(s)),
    ...Object.fromEntries(PARTS.map((k) => [k, Math.round(parts[k] * 100)])),
  } as Record<string, string | number | boolean>;
};

/** A visit's slot on the road to the next star: its score against the marks (or empty, still to come). */
const slotStyle = (score: number | undefined, needAvg: number, needWorst: number) =>
  score === undefined ? styles.slotEmpty : score >= needAvg ? styles.slotGood : score >= needWorst ? styles.slotMid : styles.slotLow;

/** The road to the next star: the visits so far as slots, the average against the mark, what is missing. */
function Road({ p, stars }: { p: ReturnType<typeof guideProgress>; stars: number }) {
  const t = useT();
  if (p.status === 'top') return <Text style={styles.small}>{t('guide.top')}</Text>;
  const slots = Math.max(p.needVisits, p.have);
  const status = t(`guide.status.${p.status}`).replace('{n}', String(Math.max(0, p.needVisits - p.have))).replace('{avg}', String(p.avg)).replace('{need}', String(p.needAvg)).replace('{worst}', String(p.worst)).replace('{min}', String(p.needWorst));
  return (
    <View style={styles.road}>
      <View style={styles.roadHead}>
        <GuideMark stars={stars + 1} plate size={22} />
        <Text style={styles.roadTitle}>{t(`guide.toStar${stars + 1}`)}</Text>
        <View style={styles.grow} />
        {p.gems > 0 && (
          <View style={styles.gemTag}>
            <GameIcon name="hudGem" size={16} />
            <Text style={styles.gemText}>{`+${p.gems}`}</Text>
          </View>
        )}
      </View>
      <View style={styles.slots}>
        <Text style={styles.slotLabel}>{t('guide.visits')}</Text>
        {Array.from({ length: slots }, (_, i) => (
          <View key={i} style={[styles.slot, slotStyle(p.scores[i], p.needAvg, p.needWorst)]}>
            {p.scores[i] !== undefined && <Text style={styles.slotText}>{p.scores[i]}</Text>}
          </View>
        ))}
      </View>
      <View style={styles.avgRow}>
        <Text style={styles.slotLabel}>{t('guide.average')}</Text>
        <View style={styles.avgBack}>
          <View style={[styles.avgFill, { width: `${p.avg}%` }, p.avg >= p.needAvg ? styles.barGood : p.avg >= p.needWorst ? styles.barMid : styles.barLow]} />
          {/* The mark to reach, and the worst night allowed. */}
          <View style={[styles.avgMark, { start: `${p.needAvg}%` }]} />
          <View style={[styles.avgMin, { start: `${p.needWorst}%` }]} />
        </View>
        <Text style={styles.avgNum}>{p.have ? `${p.avg}/${p.needAvg}` : `—/${p.needAvg}`}</Text>
      </View>
      <Text style={[styles.status, p.status === 'onTrack' ? styles.statusGood : p.status === 'badNight' ? styles.statusBad : null]}>{status}</Text>
      {p.risk && <Text style={styles.statusBad}>{t('guide.risk')}</Text>}
      {p.plateNeeded && <Text style={styles.small}>{t('guide.platePath').replace('{n}', String(GUIDE.plateScore))}</Text>}
    </View>
  );
}

export function GuidePanel({ gameRef, onClose }: { gameRef: { current: GameState | null }; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPage, 1);
  if (!d) return null;
  const stars = d.stars as number;
  const visits = (d.visits as string) ? (d.visits as string).split('|').map((v) => v.split(':') as [string, string]) : [];
  const need = stars < 3 ? GUIDE.starScore[stars]! : null;
  const last = (d.last as string) ? (d.last as string).split('|').map(Number) : null;
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <IconText icon="hudBook" size={24} style={styles.grow} textStyle={styles.title}>{t('guide.name')}</IconText>
        <View style={styles.grow} />
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
        <View style={styles.markRow}>
          <View style={styles.mark}>
            <GuideMark stars={stars} plate={d.plate as boolean} size={30} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.markText}>{t(stars > 0 ? `guide.stars${stars}` : d.plate ? 'guide.plate' : 'guide.none')}</Text>
            <Text style={styles.small}>{t('guide.next').replace('{n}', String(d.days))}</Text>
          </View>
        </View>
        {last && (
          <Text style={styles.small}>{`${t('guide.lastEdition')} ${t(last[1]! > 0 ? 'guide.won' : last[1]! < 0 ? 'guide.lost' : 'guide.kept')} (${last[2]} ${t('guide.visits')})`}</Text>
        )}
        {(d.rumor as number) > 0 && (
          <View style={styles.rumorRow}>
            <GameIcon name={(d.rumor as number) === 2 ? 'iconChef' : 'iconMagnifier'} size={26} />
            <Text style={styles.rumorText}>{t((d.rumor as number) === 2 ? 'guide.rumorChosen' : 'guide.rumorOn')}</Text>
          </View>
        )}
        <Road p={JSON.parse(d.progress as string) as ReturnType<typeof guideProgress>} stars={stars} />
        <Text style={styles.section}>{t('guide.thisEdition')}</Text>
        {visits.length === 0 ? (
          <Text style={styles.small}>{t('guide.noVisits')}</Text>
        ) : (
          visits.map(([day, verdict], i) => (
            <View key={i} style={styles.visit}>
              <IconText icon="iconCalendar" size={14} textStyle={styles.visitDay}>{`${t('guide.day')} ${day}`}</IconText>
              <Text style={styles.visitText}>{t(verdict)}</Text>
            </View>
          ))
        )}
        <Text style={styles.section}>{t('guide.judged')}</Text>
        {PARTS.map((k) => (
          <View key={k} style={styles.part}>
            <GameIcon name={PART_ICON[k]} size={22} />
            <View style={styles.grow}>
              <Text style={styles.partName}>{t(`guide.part.${k}`)}</Text>
              <View style={styles.barBack}>
                <View style={[styles.barFill, { width: `${d[k] as number}%` }, (d[k] as number) >= 80 ? styles.barGood : (d[k] as number) >= 55 ? styles.barMid : styles.barLow]} />
              </View>
            </View>
            <Text style={styles.partTip}>{t(`guide.tip.${k}`)}</Text>
          </View>
        ))}
        <Text style={styles.small}>{need !== null ? t('guide.now').replace('{now}', String(d.now)).replace('{need}', String(need)) : ''}</Text>
        <Text style={styles.section}>{t('guide.howTitle')}</Text>
        <Text style={styles.how}>{t('guide.how')}</Text>
      </ScrollView>
    </Overlay>
  );
}

const RED = '#C8102E';

const styles = StyleSheet.create({
  card: { width: 620, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  grow: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { gap: 8, paddingBottom: 4 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: panel.row, borderRadius: 14, padding: 10 },
  mark: { minWidth: 60, alignItems: 'center' },
  road: { gap: 6, backgroundColor: '#2A1233', borderRadius: 14, borderWidth: 1.5, borderColor: '#6E3A7A', padding: 10 },
  roadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roadTitle: { color: '#FFE9A8', fontSize: 14, fontWeight: '900' },
  gemTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1E0E24', borderRadius: 10, borderWidth: 1.5, borderColor: gold, paddingHorizontal: 7, paddingVertical: 2 },
  gemText: { color: '#FFE9A8', fontSize: 12, fontWeight: '900' },
  slots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotLabel: { width: 64, color: '#C9B3D6', fontSize: 11.5, fontWeight: '800' },
  slot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  slotEmpty: { borderColor: '#6E3A7A', borderStyle: 'dashed', backgroundColor: 'transparent' },
  slotGood: { borderColor: '#1F7A3A', backgroundColor: '#3DDC6A' },
  slotMid: { borderColor: '#9A6A00', backgroundColor: '#F2C14E' },
  slotLow: { borderColor: '#8A1E1A', backgroundColor: '#E5483B' },
  slotText: { color: '#1E0E24', fontSize: 11, fontWeight: '900' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgBack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#1E0E24', overflow: 'hidden' },
  avgFill: { height: 10, borderRadius: 5 },
  avgMark: { position: 'absolute', top: -2, width: 3, height: 14, backgroundColor: '#FFFFFF' },
  avgMin: { position: 'absolute', top: 0, width: 2, height: 10, backgroundColor: '#E5483B' },
  avgNum: { width: 52, color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  status: { color: '#F2E6F7', fontSize: 12.5, fontWeight: '800' },
  statusGood: { color: '#7CF0A0' },
  statusBad: { color: '#FF8A7E', fontSize: 12.5, fontWeight: '800' },
  rumorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3A0F1E', borderRadius: 12, borderWidth: 1.5, borderColor: RED, paddingHorizontal: 10, paddingVertical: 6 },
  rumorText: { flex: 1, color: '#FFE3E8', fontSize: 12.5, fontWeight: '800' },
  markText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  small: { color: '#C9B3D6', fontSize: 12.5, fontWeight: '700' },
  section: { color: '#FFE9A8', fontSize: 14, fontWeight: '900', marginTop: 4 },
  visit: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  visitDay: { color: '#FFE9A8', fontSize: 12.5, fontWeight: '900' },
  visitText: { flex: 1, color: '#F2E6F7', fontSize: 12.5, fontWeight: '700' },
  part: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  partIcon: { fontSize: 18 },
  partName: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  partTip: { width: 200, color: '#C9B3D6', fontSize: 11, fontWeight: '700' },
  barBack: { height: 6, borderRadius: 3, backgroundColor: '#1E0E24', marginTop: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barGood: { backgroundColor: '#3DDC6A' },
  barMid: { backgroundColor: '#F2C14E' },
  barLow: { backgroundColor: '#E5483B' },
  how: { color: '#E8D7F0', fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
});
