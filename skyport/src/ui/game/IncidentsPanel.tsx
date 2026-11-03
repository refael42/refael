import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOLIDAYS } from '../../data/holidays';
import { BUZZ_PAX, type IncidentKind } from '../../data/incidents';
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
  medical: 'medic',
  celebrity: 'camera',
  historic: 'ticket',
};

function Row({ inc, state, send, onShow }: { inc: Incident; state: GameState; send: (c: Command) => void; onShow: (flight: number) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const f = inc.flight ? state.flights.find((x) => x.id === inc.flight) : undefined;
  let status = '';
  if (inc.state === 'announced') status = t('inc.startsIn', { t: formatDuration(Math.max(0, inc.at - state.time)) });
  else if (inc.state === 'active') {
    if (inc.kind === 'historic' && f && f.dockedAt > 0) status = t('inc.historic.selling', { n: formatBig(Big.fromNumber(Math.round(inc.amount))) });
    else if (inc.ends > 0) status = t('inc.left', { t: formatDuration(Math.max(0, inc.ends - state.time)) });
    else status = t('inc.now');
  } else status = inc.result > 0 ? t(`inc.${inc.kind}.good` as TKey, { n: formatBig(Big.fromNumber(inc.amount)) }) : inc.result < 0 ? t(`inc.${inc.kind}.bad` as TKey) : t('inc.over');
  const urgent = inc.kind === 'emergency' || inc.kind === 'medical';
  const tone = inc.state === 'done' ? (inc.result > 0 ? C.green : inc.result < 0 ? C.red : C.textDim) : urgent ? C.red : C.primary;
  const canClear = urgent && inc.state === 'active' && f && !f.landCleared && (f.phase === 'holding' || f.phase === 'inbound');
  // a celebrity: press or privacy, until the plane leaves
  const canChoose = inc.kind === 'celebrity' && inc.state === 'active' && f && f.offBlockAt === 0;
  const exhibit = inc.kind === 'historic' && inc.state === 'active' && f && f.dockedAt > 0 && f.holdUntil > state.time ? f : null;
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
      {exhibit ? <Text style={[styles.note, ta]}>{t('inc.historic.left', { t: formatDuration(Math.max(0, exhibit.holdUntil - state.time)) })}</Text> : null}
      {canChoose ? (
        <View style={[styles.row, { flexDirection: dir.row }]}>
          {[0, 1].map((c) => (
            <Pressable
              key={c}
              onPress={() => send({ type: 'celebPrivacy', incident: inc.id, private: c === 1 })}
              style={({ pressed }) => [styles.choice, inc.choice === c && styles.choiceOn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: inc.choice === c }}
              testID={c === 1 ? 'celeb-private' : 'celeb-press'}
            >
              <Icon name={c === 1 ? 'star' : 'camera'} size={18} />
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.choiceTitle, ta, inc.choice === c && { color: C.primary }]}>{t(c === 1 ? 'inc.celebrity.private' : 'inc.celebrity.press')}</Text>
                <Text style={[styles.choiceBody, ta]}>{t(c === 1 ? 'inc.celebrity.privateHow' : 'inc.celebrity.pressHow', { p: Math.round((BUZZ_PAX - 1) * 100) })}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
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
  const hol = state.holiday >= 0 ? HOLIDAYS[state.holiday] : undefined;
  const done = state.incidents.filter((i) => i.state === 'done').reverse();
  return (
    <Sheet title={t('inc.panel')} subtitle={t('inc.sub')} onClose={onClose}>
      {hol ? (
        <View style={[styles.card, styles.weekend, { borderColor: hol.colors[0] === '#ffffff' ? C.primary : hol.colors[0] }]} testID="holiday-card">
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <Icon name="party" size={26} />
            <Text style={[styles.title, ta, { flex: 1 }]}>{t(`hol.${hol.id}.title` as TKey)}</Text>
            <Text style={[styles.status, { color: C.primary }]}>{state.holidayDay > 0 ? t('hol.day', { n: state.holidayDay, of: hol.days }) : t('hol.rush')}</Text>
          </View>
          <Text style={[styles.body, ta]}>{t(`hol.${hol.id}.body` as TKey)}</Text>
          <Text style={[styles.note, ta]}>{t('hol.pax', { p: Math.round((hol.pax - 1) * 100) })}</Text>
        </View>
      ) : null}
      {isWeekend(state.time) ? (
        <View style={[styles.card, styles.weekend]}>
          <Text style={[styles.title, ta]}>{t('inc.weekend.title')}</Text>
          <Text style={[styles.body, ta]}>{t('inc.weekend.body')}</Text>
        </View>
      ) : null}
      {state.time < state.buzzUntil ? (
        <View style={[styles.card, styles.weekend]} testID="buzz-card">
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <Icon name="camera" size={22} />
            <Text style={[styles.title, ta, { flex: 1 }]}>{t('inc.buzz.title')}</Text>
            <Text style={[styles.status, { color: C.primary }]}>{t('inc.left', { t: formatDuration(Math.max(0, state.buzzUntil - state.time)) })}</Text>
          </View>
          <Text style={[styles.body, ta]}>{t('inc.buzz.body', { p: Math.round((BUZZ_PAX - 1) * 100) })}</Text>
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
  note: { color: C.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  choice: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 10, backgroundColor: C.chip, borderWidth: 2, borderColor: 'transparent' },
  choiceOn: { borderColor: C.primary, backgroundColor: C.primarySoft },
  choiceTitle: { color: C.text, fontWeight: '800', fontSize: 13 },
  choiceBody: { color: C.textDim, fontWeight: '600', fontSize: 11, lineHeight: 15 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pressed: { transform: [{ scale: 0.97 }] },
});
