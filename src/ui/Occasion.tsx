import { Image, PixelRatio, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { dishDef } from '../data/dishes';
import { OCCASION, OCCASION_BY_ID, OCCASIONS } from '../data/occasions';
import { useT } from '../i18n';
import { OCCASION_ICONS } from '../render/art/occasionArt';
import { spriteIcon } from '../render/icons';
import { DISH_ICONS } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import { bookingValue } from '../sim/occasions';
import type { Command, GameState } from '../sim/game/types';
import { IconText } from './GameIcon';
import { Overlay } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// Private events (src/sim/occasions.ts). While the phone rings or a booking is on, a round
// button by the others at the bottom (it shakes and says "!" while ringing, then counts down to
// the party). The card: who calls, how many, the set menu, what it pays; yes or no. Once booked:
// the table kept, the party at the door, the evening as it goes.

const icon = (name: string, px: number) => spriteIcon(name as never, Math.round(px * PixelRatio.get()));
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const readButton = (s: GameState) => {
  const b = s.occasion.current;
  if (!b) return null;
  return { kind: OCCASIONS.findIndex((o) => o.id === b.kind), phase: b.phase, left: Math.max(0, Math.ceil(b.at - s.time)) };
};

export function OccasionButton({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readButton, 2);
  if (!d) return null;
  const ringing = d.phase === 'offer';
  const caption = ringing ? t('occ.ringing') : d.phase === 'booked' || d.phase === 'held' ? mmss(d.left) : t(`occ.phase.${d.phase === 'door' ? 'door' : 'on'}`);
  return (
    <SideButton
      label="booking"
      icon={icon(ringing ? 'phoneIcon' : OCCASION_ICONS[d.kind]!, SIDE.icon)}
      caption={caption}
      hurry={ringing || d.phase === 'door'}
      ready={ringing}
      badge={ringing ? '!' : undefined}
      onPress={onPress}
      style={style}
    />
  );
}

const readCard = (s: GameState) => {
  const b = s.occasion.current;
  if (!b) return null;
  const t = b.table >= 0 ? s.tables[b.table] : undefined;
  return {
    kind: b.kind,
    size: b.size,
    phase: b.phase,
    dishes: b.dishes.join(','),
    left: Math.max(0, Math.ceil(b.at - s.time)),
    value: formatBig(bookingValue(s, b)),
    biggest: s.tables.reduce((m, x) => Math.max(m, x.seats), 0),
    tableReady: t ? t.state === 0 : false,
    paid: b.paid,
    stars: b.paid > 0 ? Math.round((b.stars / b.paid) * 10) / 10 : 0,
  };
};

export function OccasionPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readCard, 2);
  if (!d) {
    return (
      <Overlay onClose={onClose} card={styles.card}>
        <Text style={[styles.status, styles.pad]}>{t('occ.none')}</Text>
      </Overlay>
    );
  }
  const def = OCCASION_BY_ID[d.kind];
  const kind = OCCASIONS.indexOf(def);
  const dishes = d.dishes.split(',').filter((x) => x !== '').map(Number);
  const answer = (accept: boolean) => {
    tapFeedback();
    onCommand({ type: 'booking', accept });
    onClose();
  };
  const status =
    d.phase === 'offer'
      ? t('occ.answerIn').replace('{t}', mmss(d.left))
      : d.phase === 'booked'
        ? t('occ.comesIn').replace('{t}', mmss(d.left))
        : d.phase === 'held'
          ? `${t('occ.held')} ${t('occ.comesIn').replace('{t}', mmss(d.left))}`
          : d.phase === 'door'
            ? t(d.tableReady ? 'occ.seating' : 'occ.door')
            : t('occ.on').replace('{n}', String(d.paid)).replace('{m}', String(d.size)) + (d.paid > 0 ? ` · ★${d.stars.toFixed(1)}` : '');
  return (
    <Overlay onClose={onClose} card={[styles.card, { borderColor: def.colors[0] === '#FFFFFF' ? def.colors[2] : def.colors[0] }]}>
      <View style={[styles.header, { backgroundColor: darkOf(kind) }]}>
        <Image source={{ uri: icon(OCCASION_ICONS[kind]!, 48) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t(`occ.name.${def.id}`)}</Text>
          <Text style={styles.sub}>{t('occ.guests').replace('{n}', String(d.size))}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.line}>{t(`occ.call.${def.id}`).replace('{n}', String(d.size))}</Text>
        <Text style={styles.label}>{t('occ.menu')}</Text>
        <View style={styles.menu}>
          {dishes.map((dish) => (
            <View key={dish} style={styles.dish}>
              <Image source={{ uri: spriteIcon(DISH_ICONS[dish]!, Math.round(30 * PixelRatio.get())) }} style={styles.dishIcon} />
              <Text style={styles.dishName}>{t(dishDef(dish).nameKey)}</Text>
            </View>
          ))}
          {def.cake && (
            <View style={styles.dish}>
              <Image source={{ uri: icon('cakeIcon', 30) }} style={styles.dishIcon} />
              <Text style={styles.dishName}>{t('occ.cake')}</Text>
            </View>
          )}
        </View>
        <View style={styles.pay}>
          <IconText icon="hudCoin" size={18} textStyle={styles.payText}>{`≈ ${d.value}`}</IconText>
          <IconText icon="hudGem" size={18} textStyle={styles.payText}>{t('occ.gemsUpTo').replace('{n}', String(def.gems))}</IconText>
        </View>
        <Text style={styles.hint}>{t('occ.hint').replace('{x}', `${def.fee}`).replace('{s}', String(OCCASION.perfectStars))}</Text>
        <Text style={styles.status}>{status}</Text>
        {d.phase === 'offer' && (
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" onPress={() => answer(false)} style={[styles.button, styles.no]}>
              <Text style={styles.buttonText}>{t('occ.decline')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => answer(true)} style={[styles.button, styles.yes]}>
              <Text style={styles.buttonText}>{t('occ.accept')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Overlay>
  );
}

/** The header's color by kind: the anniversary red, a party pink, business navy, bar mitzvah blue, wedding gold. */
const darkOf = (kind: number) => ['#B32A2A', '#C2406A', '#2E4A7A', '#2F68B0', '#A8812E'][kind] ?? '#C2406A';

const styles = StyleSheet.create({
  card: { width: 460, maxWidth: '94%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, overflow: 'hidden' },
  pad: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerIcon: { width: 48, height: 48 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#FFF4E3', fontSize: 13, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  line: { color: '#FFF4E3', fontSize: 14, fontWeight: '800' },
  label: { color: '#C9B3D6', fontSize: 12, fontWeight: '900', marginTop: 2 },
  menu: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  dishIcon: { width: 30, height: 30 },
  dishName: { color: '#FFF4E3', fontSize: 13, fontWeight: '800' },
  pay: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 4 },
  payText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  hint: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700' },
  status: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  button: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  yes: { backgroundColor: '#35B957', borderColor: '#B9F5A8' },
  no: { backgroundColor: '#6A4A74', borderColor: '#9A7AA6' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
