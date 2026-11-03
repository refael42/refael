import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IncidentKind } from '../../data/incidents';
import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Big, formatBig, formatDuration, isWeekend, type Command, type GameState, type Incident } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

const ICON: Record<IncidentKind, IconName> = {
  storm: 'cloud',
  birds: 'warn',
  fod: 'wrench',
  emergency: 'warn',
  vip: 'star',
  airshow: 'plane',
};

function Row({ inc, state, send, onShow }: { inc: Incident; state: GameState; send: (c: Command) => void; onShow: (flight: number) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const f = inc.flight ? state.flights.find((x) => x.id === inc.flight) : undefined;
  let status = '';
  if (inc.state === 'announced') status = t('inc.startsIn', { t: formatDuration(Math.max(0, inc.at - state.time)) });
  else if (inc.state === 'active') {
    if (inc.ends > 0) status = t('inc.left', { t: formatDuration(Math.max(0, inc.ends - state.time)) });
    else status = t('inc.now');
  } else status = inc.result > 0 ? t(`inc.${inc.kind}.good` as TKey, { n: formatBig(Big.fromNumber(inc.amount)) }) : inc.result < 0 ? t(`inc.${inc.kind}.bad` as TKey) : t('inc.over');
  const tone = inc.state === 'done' ? (inc.result > 0 ? C.green : inc.result < 0 ? C.red : C.textDim) : inc.kind === 'emergency' ? C.red : C.primary;
  const canClear = inc.kind === 'emergency' && inc.state === 'active' && f && !f.landCleared && (f.phase === 'holding' || f.phase === 'inbound');
  return (
    <View style={[styles.card, inc.state === 'done' && styles.done]} testID={`incident-${inc.kind}`}>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Icon name={ICON[inc.kind]} size={26} />
        <Text style={[styles.title, ta, { flex: 1 }]}>{t(`inc.${inc.kind}.title` as TKey)}</Text>
        <Text style={[styles.status, { color: tone }]} numberOfLines={1}>
          {inc.state === 'done' ? '' : status}
        </Text>
      </View>
      <Text style={[styles.body, ta]}>{inc.state === 'done' ? status : t(`inc.${inc.kind}.body` as TKey)}</Text>
      {f && inc.state !== 'done' ? (
        <View style={[styles.row, { flexDirection: dir.row }]}>
          {canClear ? (
            <Pressable onPress={() => send({ type: 'clearLanding', flightId: f.id })} style={({ pressed }) => [styles.btn, { backgroundColor: C.red }, pressed && styles.pressed]} accessibilityRole="button" testID="incident-clear">
              <Icon name="actLand" size={18} />
              <Text style={styles.btnText}>{t('inc.clear')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onShow(f.id)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]} accessibilityRole="button">
            <Icon name="plane" size={18} />
            <Text style={styles.btnText}>{t('inc.showPlane')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function IncidentsPanel({ state, send, onShow, onClose }: { state: GameState; rev: number; send: (c: Command) => void; onShow: (flight: number) => void; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const open = state.incidents.filter((i) => i.state !== 'done');
  const done = state.incidents.filter((i) => i.state === 'done').reverse();
  return (
    <Sheet title={t('inc.panel')} subtitle={t('inc.sub')} onClose={onClose}>
      {isWeekend(state.time) ? (
        <View style={[styles.card, styles.weekend]}>
          <Text style={[styles.title, ta]}>{t('inc.weekend.title')}</Text>
          <Text style={[styles.body, ta]}>{t('inc.weekend.body')}</Text>
        </View>
      ) : null}
      {open.length === 0 ? (
        <View style={styles.card}>
          <Text style={[styles.body, ta]}>{state.tier < 2 ? t('inc.none1') : t('inc.none')}</Text>
        </View>
      ) : null}
      {open.map((inc) => (
        <Row key={inc.id} inc={inc} state={state} send={send} onShow={onShow} />
      ))}
      {done.length > 0 ? <Text style={[styles.section, ta]}>{t('inc.recent')}</Text> : null}
      {done.map((inc) => (
        <Row key={inc.id} inc={inc} state={state} send={send} onShow={onShow} />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, gap: 8, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  done: { opacity: 0.8 },
  weekend: { borderWidth: 2, borderColor: C.primary },
  row: { alignItems: 'center', gap: 10 },
  title: { color: C.text, fontWeight: '800', fontSize: 16 },
  status: { fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  body: { color: C.textDim, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  section: { color: C.text, fontWeight: '800', fontSize: 14, marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pressed: { transform: [{ scale: 0.97 }] },
});
