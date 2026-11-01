import { useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { dishDef } from '../data/dishes';
import { LAB, PLATES, SAUCES, TOPPINGS } from '../data/lab';
import { isRTL, useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { DISH_ICONS } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { formatBig, formatDuration } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { labOpen, labSlots, taste, testCost, type Creation } from '../sim/lab';
import { useSettings } from '../store/settings';
import { IconText } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// The recipe lab (owner's idea 2): pick a dish from the menu, a sauce, a topping and a plate,
// name it, and send it to the test kitchen. The notebook keeps the creations with their stars and
// the tasting notes (what is missing, what clashes); the good ones go on the menu as signature dishes.

const labIcon = (px: number) => spriteIcon('labIcon', Math.round(px * PixelRatio.get()));
const dishIcon = (dish: number, px: number) => spriteIcon(DISH_ICONS[dish]!, Math.round(px * PixelRatio.get()));

const readChip = (s: GameState) => ({ open: labOpen(s), busy: s.lab.test !== null, done: s.lab.test ? Math.max(0, Math.ceil(s.lab.test.ends - s.time)) : -1 });

export function LabChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  if (!d || !d.open) return null;
  return <SideButton label="lab" icon={labIcon(SIDE.icon)} caption={d.busy ? formatDuration(d.done) : t('lab.button')} onPress={onPress} style={style} />;
}

interface LabView {
  open: boolean;
  served: number;
  menu: { dish: number; cost: string; ok: boolean }[];
  test: { c: Creation; left: number } | null;
  book: Creation[];
  slots: number;
  used: number;
}

const readPanel = (s: GameState): string => {
  const menu = Object.keys(s.mods.menu)
    .map(Number)
    .filter((d) => s.mods.menu[d])
    .sort((a, b) => dishDef(a).price - dishDef(b).price)
    .map((dish) => {
      const cost = testCost(s, dish);
      return { dish, cost: formatBig(cost), ok: s.coins.gte(cost) };
    });
  const view: LabView = {
    open: labOpen(s),
    served: s.stats.served,
    menu,
    test: s.lab.test ? { c: s.lab.test, left: Math.max(0, Math.ceil(s.lab.test.ends - s.time)) } : null,
    book: s.lab.book,
    slots: labSlots(s),
    used: s.lab.book.filter((c) => c.on).length,
  };
  return JSON.stringify(view);
};

/** The plate as the guest sees it: the rim's color, the sauce under the dish, the topping sprinkled on. */
export function Plate({ c, size }: { c: Pick<Creation, 'base' | 'sauce' | 'topping' | 'plate'>; size: number }) {
  const sauce = SAUCES[c.sauce]!.color;
  const top = TOPPINGS[c.topping]!.color;
  const dots = [[-0.22, -0.12], [0.2, -0.16], [0.05, 0.2], [-0.12, 0.16], [0.24, 0.08], [-0.26, 0.04]];
  return (
    <View style={[styles.plate, { width: size, height: size, borderRadius: size / 2, borderColor: PLATES[c.plate], borderWidth: size * 0.09 }]}>
      <View style={{ position: 'absolute', width: size * 0.62, height: size * 0.42, borderRadius: size * 0.3, backgroundColor: sauce, opacity: 0.85, top: size * 0.3 }} />
      <Image source={{ uri: dishIcon(c.base, size * 0.62) }} style={{ width: size * 0.62, height: size * 0.62 }} />
      {dots.map(([x, y], i) => (
        <View key={i} style={{ position: 'absolute', width: size * 0.08, height: size * 0.08, borderRadius: size * 0.04, backgroundColor: top, borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)', left: size * (0.46 + x!), top: size * (0.46 + y!) }} />
      ))}
    </View>
  );
}

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <Text style={[styles.stars, { fontSize: size }]}>
    {'★'.repeat(n)}
    <Text style={styles.starsOff}>{'★'.repeat(5 - n)}</Text>
  </Text>
);

/** The tasting notes for a combination, in words. */
function notes(c: Pick<Creation, 'base' | 'sauce' | 'topping'>, t: (k: string) => string): string[] {
  const r = taste(c.base, c.sauce, c.topping);
  if (r.stars === 5) return [t('lab.note.perfect')];
  const out = r.missing.map((f) => t(`lab.need.${f}`));
  if (r.clash) out.push(t(`lab.clash.${r.clash}`));
  if (r.lopsided) out.push(t('lab.note.lopsided'));
  return out;
}

export function LabPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const chef = useSettings((s) => s.profile?.manager) || t('welcome.defaultManager');
  const raw = usePoll(gameRef, readPanel, 2);
  const [pickBase, setBase] = useState<number | null>(null);
  const [sauce, setSauce] = useState(0);
  const [topping, setTopping] = useState(0);
  const [plate, setPlate] = useState(2);
  const [name, setName] = useState('');
  if (raw === null) return null;
  const d = JSON.parse(raw) as LabView;
  // Until one is picked: the dearest dish the till can test now (or the cheapest).
  const base = pickBase !== null && d.menu.some((m) => m.dish === pickBase) ? pickBase : ([...d.menu].reverse().find((m) => m.ok) ?? d.menu[0])?.dish ?? 0;
  const row = d.menu.find((m) => m.dish === base);
  const fallback = t('lab.defaultName').replace('{dish}', t(dishDef(base).nameKey)).replace('{chef}', chef).slice(0, LAB.nameMax);
  const send = () => {
    tapFeedback();
    onCommand({ type: 'labTest', base, sauce, topping, plate, name: name.trim() || fallback });
    setName('');
  };
  const chip = (on: boolean) => [styles.chip, on && styles.chipOn];
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: labIcon(40) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('lab.title')}</Text>
          <Text style={styles.sub}>{t('lab.sub')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      {!d.open ? (
        <Text style={styles.locked}>{t('lab.locked').replace('{n}', String(LAB.minServed - d.served))}</Text>
      ) : (
        <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
          {/* The test kitchen: what is cooking, or the new idea with its plate, name and price. */}
          <View style={styles.bench}>
            <Plate c={d.test ? d.test.c : { base, sauce, topping, plate }} size={92} />
            <View style={styles.benchText}>
              {d.test ? (
                <>
                  <Text style={styles.benchName}>{d.test.c.name}</Text>
                  <Text style={styles.testing}>{t('lab.testing').replace('{t}', formatDuration(d.test.left))}</Text>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${Math.round((1 - d.test.left / LAB.testSeconds) * 100)}%` }]} />
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    maxLength={LAB.nameMax}
                    placeholder={fallback}
                    placeholderTextColor="#8A6A9A"
                    style={[styles.input, { textAlign: isRTL(lang) ? 'right' : 'left' }]}
                    returnKeyType="done"
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="lab-test" disabled={!row?.ok} onPress={send} style={[styles.go, !row?.ok && styles.goOff]}>
                    <Text style={styles.goText}>{t('lab.test')}</Text>
                    <IconText icon="hudCoin" size={14} textStyle={styles.goCost}>{row?.cost ?? ''}</IconText>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          {!d.test && (
            <>
              <Text style={styles.label}>{t('lab.step.dish')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {d.menu.map((m) => (
                  <Pressable key={m.dish} accessibilityRole="button" onPress={() => setBase(m.dish)} style={chip(m.dish === base)}>
                    <Image source={{ uri: dishIcon(m.dish, 26) }} style={styles.chipIcon} />
                    <Text style={styles.chipText}>{t(dishDef(m.dish).nameKey)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>{t('lab.step.sauce')}</Text>
              <View style={styles.wrap}>
                {SAUCES.map((x, i) => (
                  <Pressable key={x.id} accessibilityRole="button" onPress={() => setSauce(i)} style={chip(i === sauce)}>
                    <View style={[styles.dot, { backgroundColor: x.color }]} />
                    <View>
                      <Text style={styles.chipText}>{t(`lab.sauce.${x.id}`)}</Text>
                      <Text style={styles.flavor}>{x.flavors.map((f) => t(`lab.flavor.${f}`)).join(' · ')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>{t('lab.step.topping')}</Text>
              <View style={styles.wrap}>
                {TOPPINGS.map((x, i) => (
                  <Pressable key={x.id} accessibilityRole="button" onPress={() => setTopping(i)} style={chip(i === topping)}>
                    <View style={[styles.dot, { backgroundColor: x.color }]} />
                    <View>
                      <Text style={styles.chipText}>{t(`lab.topping.${x.id}`)}</Text>
                      <Text style={styles.flavor}>{x.flavors.map((f) => t(`lab.flavor.${f}`)).join(' · ')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>{t('lab.step.plate')}</Text>
              <View style={styles.wrap}>
                {PLATES.map((col, i) => (
                  <Pressable key={col} accessibilityRole="button" accessibilityLabel={`plate-${i}`} onPress={() => setPlate(i)} style={[styles.swatch, { borderColor: col }, i === plate && styles.swatchOn]} />
                ))}
              </View>
              <Text style={styles.hint}>{t('lab.hint')}</Text>
            </>
          )}
          {/* The notebook. */}
          <View style={styles.bookHead}>
            <Text style={styles.label}>{t('lab.notebook')}</Text>
            <Text style={styles.slots}>{t('lab.slots').replace('{n}', String(d.used)).replace('{m}', String(d.slots))}</Text>
          </View>
          {d.book.length === 0 && <Text style={styles.empty}>{t('lab.empty')}</Text>}
          {d.book.map((c, i) => {
            const full = !c.on && d.used >= d.slots && !d.book.some((o) => o.on && o.base === c.base);
            return (
              <View key={`${i}-${c.name}`} style={[styles.entry, c.on && styles.entryOn]}>
                <Plate c={c} size={52} />
                <View style={styles.entryText}>
                  <Text style={styles.entryName} numberOfLines={1}>{c.name}</Text>
                  <View style={styles.entryLine}>
                    <Stars n={c.stars} />
                    <Text style={styles.entryDish}>{t(dishDef(c.base).nameKey)}</Text>
                  </View>
                  {notes(c, t).map((n) => (
                    <Text key={n} style={[styles.note, c.stars === 5 && styles.notePerfect]}>{n}</Text>
                  ))}
                  {c.on && <Text style={styles.perk}>{t('lab.perk').replace('{p}', String(Math.round(LAB.pricePerStar * (c.stars - 1) * 100)))}</Text>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`lab-serve-${i}`}
                  disabled={full}
                  onPress={() => {
                    tapFeedback();
                    onCommand({ type: 'labServe', index: i, on: !c.on });
                  }}
                  style={[styles.serve, c.on && styles.serveOff, full && styles.goOff]}
                >
                  <Text style={styles.serveText}>{c.on ? t('lab.off') : t('lab.serve')}</Text>
                </Pressable>
              </View>
            );
          })}
          {d.used >= d.slots && d.book.some((c) => !c.on) && <Text style={styles.hint}>{t('lab.full')}</Text>}
        </ScrollView>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 640, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: '#5CC25A', overflow: 'hidden', paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#2C6A3A' },
  headerIcon: { width: 40, height: 40 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#10301A', 2, 2) },
  sub: { color: '#E6FFE0', fontSize: 12, fontWeight: '700' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,40,22,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#E6FFE0', fontSize: 16, fontWeight: '900' },
  locked: { color: '#C9B3D6', fontSize: 15, fontWeight: '800', textAlign: 'center', padding: 24 },
  body: { padding: 10, gap: 6 },
  bench: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: panel.row, borderRadius: 14, padding: 10 },
  benchText: { flex: 1, gap: 8 },
  benchName: { color: '#FFF4E3', fontSize: 16, fontWeight: '900' },
  testing: { color: '#B9F5A8', fontSize: 13, fontWeight: '800' },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#24142A', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#5CC25A' },
  input: { height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: '#5A3A64', backgroundColor: '#24122A', color: '#FFF4E3', fontSize: 15, fontWeight: '800', paddingHorizontal: 10 },
  go: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 40, borderRadius: 20, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8' },
  goOff: { opacity: 0.45 },
  goText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  goCost: { color: '#FFF4E3', fontSize: 13, fontWeight: '900' },
  label: { color: '#FFE9A8', fontSize: 13, fontWeight: '900', marginTop: 4 },
  chips: { gap: 6, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#24122A', borderWidth: 1.5, borderColor: '#5A3A64' },
  chipOn: { borderColor: '#5CC25A', backgroundColor: '#1F3A24' },
  chipIcon: { width: 26, height: 26 },
  chipText: { color: '#F3E6FA', fontSize: 12.5, fontWeight: '800' },
  flavor: { color: '#9A86A8', fontSize: 10.5, fontWeight: '700' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.35)' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 6, backgroundColor: '#FFFFFF' },
  swatchOn: { transform: [{ scale: 1.15 }], shadowColor: '#5CC25A', shadowOpacity: 1, shadowRadius: 6 },
  hint: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  plate: { backgroundColor: '#FFFDF6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bookHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  slots: { color: '#C9B3D6', fontSize: 12, fontWeight: '800' },
  empty: { color: '#9A86A8', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 12, padding: 8 },
  entryOn: { borderWidth: 1.5, borderColor: '#E5A800' },
  entryText: { flex: 1, gap: 1 },
  entryName: { color: '#FFF4E3', fontSize: 14.5, fontWeight: '900' },
  entryLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryDish: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700' },
  stars: { color: '#FFC93C', fontWeight: '900' },
  starsOff: { color: '#4A3A54' },
  note: { color: '#E8B7A8', fontSize: 11.5, fontWeight: '700' },
  notePerfect: { color: '#7EE08F' },
  perk: { color: '#FFE27A', fontSize: 11.5, fontWeight: '800' },
  serve: { minWidth: 92, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: '#E5A800', borderWidth: 1.5, borderColor: '#FFE9A8', alignItems: 'center', justifyContent: 'center' },
  serveOff: { backgroundColor: '#5A3A64', borderColor: '#8A6A9A' },
  serveText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
});
