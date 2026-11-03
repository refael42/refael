import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import { useDir, useT, type TKey } from '../../i18n';
import { arrivalsBoard, clockText, departuresBoard, type BoardRow, type BoardStatus, type GameState } from '../../sim';
import { Icon } from '../Icon';
import { SHADOW } from '../theme';

const MONO = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' });

export const STATUS_COLOR: Record<BoardStatus, string> = {
  scheduled: '#cbd5e1',
  delayed: '#f87171',
  approach: '#93c5fd',
  holding: '#fbbf24',
  landing: '#93c5fd',
  landed: '#34d399',
  onTime: '#34d399',
  boarding: '#fbbf24',
  closed: '#fb923c',
  departed: '#64748b',
  cancelled: '#ef4444',
};

/** Split-flap characters: one dark tile per letter. */
function Flaps({ text, color = '#fbbf24' }: { text: string; color?: string }) {
  return (
    <View style={styles.flaps}>
      {text.split('').map((ch, i) => (
        <View key={i} style={styles.flap}>
          <Text style={[styles.flapText, { color }]}>{ch}</Text>
          <View style={styles.flapLine} />
        </View>
      ))}
    </View>
  );
}

function Row({ r, onPick, blink }: { r: BoardRow; onPick: (id: number) => void; blink: boolean }) {
  const t = useT();
  const dir = useDir();
  const a = AIRLINES[r.al] ?? AIRLINES[0];
  const gone = r.status === 'departed' || r.status === 'cancelled';
  const color = STATUS_COLOR[r.status];
  const flashing = (r.status === 'boarding' || r.status === 'landing') && blink;
  return (
    <Pressable
      onPress={() => r.flightId && onPick(r.flightId)}
      disabled={!r.flightId}
      style={({ pressed }) => [styles.row, { flexDirection: dir.row }, gone && styles.rowGone, pressed && styles.rowPressed]}
      accessibilityRole="button"
      testID={`board-row-${r.key}`}
    >
      <View style={styles.colTime}>
        <Flaps text={clockText(r.time)} />
      </View>
      <View style={[styles.colFlight, { flexDirection: dir.row }]}>
        <View style={[styles.alBar, { backgroundColor: a.livery.tail }]} />
        <View style={{ flex: 1, gap: 3, alignItems: dir.rtl ? 'flex-end' : 'flex-start' }}>
          <Flaps text={`${a.code}${r.num}`} color="#f8fafc" />
          <Text style={[styles.city, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]} numberOfLines={1}>
            {t(`city.${cityId(r.city)}` as TKey)}
          </Text>
        </View>
      </View>
      <View style={[styles.colStatus, { alignItems: dir.rtl ? 'flex-start' : 'flex-end' }]}>
        <Text style={[styles.status, { color, opacity: flashing ? 0.45 : 1 }]} numberOfLines={1}>
          {t(`board.st.${r.status}` as TKey)}
        </Text>
        {r.expected > 0 ? (
          <Text style={styles.expected} numberOfLines={1}>
            {t('board.expected', { time: clockText(r.expected) })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function cityId(i: number): string {
  return (CITIES[i] ?? CITIES[0]).id;
}

/** The departures / arrivals board: dark panel, amber split-flap letters. */
export function FlightBoard({ state, onPick, onClose, initialTab = 0 }: { state: GameState; rev: number; onPick: (flightId: number) => void; onClose: () => void; initialTab?: number }) {
  const t = useT();
  const dir = useDir();
  const [tab, setTab] = useState(initialTab);
  const rows = tab === 0 ? departuresBoard(state) : arrivalsBoard(state);
  const blink = Math.floor(state.time * 1.5) % 2 === 0;
  // short screens (phone in landscape): no big title, the clock and close sit next to the tabs
  const short = useWindowDimensions().height < 520;
  const clock = <Flaps text={clockText(state.time)} color="#f8fafc" />;
  const close = (
    <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel={t('card.close')}>
      <Icon name="close" size={14} />
    </Pressable>
  );
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.board, short && styles.boardShort]} testID="flight-board">
        {short ? null : (
          <View style={[styles.head, { flexDirection: dir.row }]}>
            <Icon name={tab === 0 ? 'takeoff' : 'land'} size={26} />
            <Text style={[styles.title, { textAlign: dir.textAlign }]} numberOfLines={1}>
              {tab === 0 ? t('board.departures') : t('board.arrivals')}
            </Text>
            {clock}
            {close}
          </View>
        )}
        <View style={[styles.head, { flexDirection: dir.row }]}>
          <View style={[styles.tabs, { flexDirection: dir.row, flex: 1 }]}>
            {[t('board.departures'), t('board.arrivals')].map((label, i) => (
              <Pressable key={i} style={[styles.tab, short && styles.tabShort, tab === i && styles.tabOn]} onPress={() => setTab(i)} accessibilityRole="tab" testID={`board-tab-${i}`}>
                <Text style={[styles.tabText, tab === i && styles.tabTextOn]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {short ? clock : null}
          {short ? close : null}
        </View>
        <View style={[styles.cols, { flexDirection: dir.row }]}>
          <Text style={[styles.colHead, styles.colTime]}>{t('board.time')}</Text>
          <Text style={[styles.colHead, styles.colFlightHead, { textAlign: dir.textAlign }]} numberOfLines={1}>
            {t('board.flight')} · {tab === 0 ? t('board.to') : t('board.from')}
          </Text>
          <Text style={[styles.colHead, styles.colStatusHead, { textAlign: dir.rtl ? 'left' : 'right' }]}>{t('board.status')}</Text>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 4 }}>
          {rows.length === 0 ? <Text style={styles.empty}>{t('board.empty')}</Text> : null}
          {rows.map((r) => (
            <Row key={r.key} r={r} onPick={onPick} blink={blink} />
          ))}
        </ScrollView>
        {short ? null : (
          <Text style={styles.hint} numberOfLines={1}>
            {t('board.hint')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  board: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: '#0b1222', borderRadius: 24, padding: 14, gap: 10, borderWidth: 1, borderColor: '#1e293b', ...SHADOW },
  head: { alignItems: 'center', gap: 10 },
  boardShort: { padding: 10, gap: 6, maxHeight: '96%' },
  tabShort: { paddingVertical: 5 },
  title: { flex: 1, color: '#fbbf24', fontSize: 22, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  tabs: { backgroundColor: '#111a2e', borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  tabOn: { backgroundColor: '#1e293b' },
  tabText: { color: '#64748b', fontWeight: '800', fontSize: 14 },
  tabTextOn: { color: '#f8fafc' },
  cols: { alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  colHead: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  list: { flexGrow: 0, flexShrink: 1 },
  row: { alignItems: 'center', gap: 8, backgroundColor: '#111a2e', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  rowGone: { opacity: 0.55 },
  rowPressed: { backgroundColor: '#1e293b' },
  colTime: { width: 70 },
  colFlight: { flex: 1, alignItems: 'center', gap: 6 },
  colFlightHead: { flex: 1, paddingHorizontal: 10 },
  alBar: { width: 4, height: 36, borderRadius: 2 },
  city: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  colStatus: { width: 96 },
  colStatusHead: { width: 96 },
  status: { fontSize: 13, fontWeight: '900' },
  expected: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  flaps: { flexDirection: 'row', gap: 1.5, direction: 'ltr' },
  flap: { width: 12.5, height: 20, borderRadius: 3, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  flapText: { fontFamily: MONO, fontSize: 13, fontWeight: '800' },
  flapLine: { position: 'absolute', left: 0, right: 0, top: 9.5, height: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  empty: { color: '#94a3b8', fontSize: 14, padding: 16, textAlign: 'center' },
  hint: { color: '#475569', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
