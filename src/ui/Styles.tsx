import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { dishDef } from '../data/dishes';
import { STYLE, STYLES } from '../data/styles';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { DISH_ICONS } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { styleCost, stylesOpen } from '../sim/styles';
import { IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// Restaurant styles (owner's idea 6): four cards (classic, Japanese, Italian, Mexican), each with
// a swatch of its floor and walls, its dishes, and a button to take it on.

const styleIcon = (px: number) => spriteIcon('styleIcon', Math.round(px * PixelRatio.get()));
const dishIcon = (dish: number, px: number) => spriteIcon(DISH_ICONS[dish]!, Math.round(px * PixelRatio.get()));

const readChip = (s: GameState) => stylesOpen(s);

export function StylesChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const open = usePoll(gameRef, readChip, 1);
  if (!open) return null;
  return <SideButton label="styles" icon={styleIcon(SIDE.icon)} caption={t('style.button')} onPress={onPress} style={style} />;
}

const readPanel = (s: GameState) => {
  const cost = styleCost(s);
  return { open: stylesOpen(s), id: s.style.id, cost: cost.gt(0) ? formatBig(cost) : '', ok: s.coins.gte(cost) };
};

/** A little picture of the style: its floor's colors under a strip of its wall. */
function Swatch({ id }: { id: number }) {
  const st = STYLES[id]!;
  const [base, second, pattern, border] = st.colors;
  return (
    <View style={styles.swatch}>
      <View style={[styles.wall, { backgroundColor: st.wall ?? '#4A1F4E' }]} />
      <View style={[styles.floor, { backgroundColor: base, borderColor: border }]}>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <View key={k} style={[styles.tile, { backgroundColor: k % 2 === 0 ? second : base, borderColor: pattern }]} />
        ))}
      </View>
    </View>
  );
}

export function StylesPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPanel, 2);
  if (!d) return null;
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: styleIcon(40) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('style.title')}</Text>
          <Text style={styles.sub}>{t('style.sub')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
        <View style={styles.cards}>
          {STYLES.map((st, i) => {
            const on = d.id === i;
            return (
              <View key={st.id} style={[styles.styleCard, on && styles.styleOn]}>
                <Swatch id={i} />
                <Text style={styles.name}>{t(`style.name.${st.id}`)}</Text>
                <Text style={styles.desc}>{t(`style.desc.${st.id}`)}</Text>
                {st.dishes.length > 0 && (
                  <View style={styles.dishes}>
                    {st.dishes.map((dish) => (
                      <View key={dish} style={styles.dish}>
                        <Image source={{ uri: dishIcon(dish, 24) }} style={styles.dishIcon} />
                        <Text style={styles.dishName} numberOfLines={1}>{t(dishDef(dish).nameKey)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {st.dishes.length > 0 && <Text style={styles.perk}>{t('style.perk').replace('{p}', String(Math.round((STYLE.dishPrice - 1) * 100)))}</Text>}
                <View style={styles.grow} />
                {on ? (
                  <Text style={styles.current}>{t('style.current')}</Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`style-${st.id}`}
                    disabled={!d.open || !d.ok}
                    onPress={() => {
                      tapFeedback();
                      onCommand({ type: 'style', id: i });
                    }}
                    style={[styles.pick, (!d.open || !d.ok) && styles.off]}
                  >
                    {d.cost ? <IconText icon="hudCoin" size={14} textStyle={styles.pickText}>{d.cost}</IconText> : <Text style={styles.pickText}>{t('style.free')}</Text>}
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.hint}>{d.open ? t('style.hint') : t('style.locked')}</Text>
      </ScrollView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 700, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: '#E8C690', overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#7A4A2A' },
  headerIcon: { width: 40, height: 40 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#FFF0DC', fontSize: 12, fontWeight: '700' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { padding: 10, gap: 8 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  styleCard: { width: 158, minHeight: 250, backgroundColor: panel.row, borderRadius: 14, padding: 8, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  styleOn: { borderColor: '#E5A800' },
  swatch: { height: 70, borderRadius: 10, overflow: 'hidden' },
  wall: { height: 20 },
  floor: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 3 },
  tile: { width: '33.33%', height: '50%', borderWidth: 0.5 },
  name: { color: '#FFF4E3', fontSize: 15, fontWeight: '900' },
  desc: { color: '#C9B3D6', fontSize: 11, fontWeight: '700' },
  dishes: { gap: 2 },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dishIcon: { width: 22, height: 22 },
  dishName: { color: '#F3E6FA', fontSize: 11.5, fontWeight: '800', flexShrink: 1 },
  perk: { color: '#FFE27A', fontSize: 11, fontWeight: '800' },
  grow: { flex: 1 },
  current: { color: '#7EE08F', fontSize: 13, fontWeight: '900', textAlign: 'center', paddingVertical: 7 },
  pick: { height: 34, borderRadius: 17, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.45 },
  pickText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  hint: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
});
