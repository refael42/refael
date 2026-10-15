import { useEffect } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { tapFeedback } from '../audio/sound';
import { HERO_BY_ID, HEROES, OFFER_TIMES, type HeroDef } from '../data/offers';
import { useT } from '../i18n';
import type { Purchases } from '../iap/usePurchases';
import { heroIcon, hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import type { Command, GameState } from '../sim/game/types';
import { hurry, offersAt, ownsHero, turnAt } from '../sim/offers';
import { countdown, shortTime } from './Festival';
import { Overlay } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { gold, panel, textShadow } from './theme';

// The paid offers (owner M34: "deals worth paying for that create FOMO, a rare character with
// gems"): a round button with the clock, and a page of up to three packs, each with its hero's
// portrait, what it brings, how much more it is worth than plain gems, and the real time left.
// Under them, the heroes' collection: the ones you have, and the ones still to come round.

/** How often the phone's clock is told to the sim (the starter's days, the turn's hero). */
const CLOCK_EVERY_MS = 10000;

/** Sends the phone's clock to the sim now and then (src/sim/offers.ts seeOffers). */
export function useOffersClock(onCommand: (cmd: Command) => void, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const tell = () => onCommand({ type: 'offers', now: Date.now() });
    tell();
    const timer = setInterval(tell, CLOCK_EVERY_MS);
    return () => clearInterval(timer);
  }, [onCommand, on]);
}

/** The packs now, flat (polled: plain values compare cheaply). */
const readOffers = (s: GameState) => {
  const now = Date.now();
  if (s.offers.starterSeen === 0) return null;
  const packs = offersAt(s, now).map((o) => ({
    id: o.offer.id,
    kind: o.offer.kind,
    hero: o.hero?.id ?? null,
    gems: o.offer.gems,
    warp: o.offer.warpHours,
    worth: Math.floor(o.worth),
    bought: o.bought,
    left: Math.ceil((o.ends - now) / 1000),
    hurry: hurry(o.ends, now),
  }));
  return { packs, owned: HEROES.filter((h) => ownsHero(s, h.id)).map((h) => h.id).join(','), turn: turnAt(now), shown: s.offers.shown, played: s.time };
};

/** The first pack still to take, for the button and the pop-up. */
const firstOpen = (d: NonNullable<ReturnType<typeof readOffers>>) => d.packs.find((p) => !p.bought) ?? null;

/** Should the big card open by itself now: once a hero turn, after a few minutes of play. */
export const readOfferPopup = (s: GameState): number | null => {
  const d = readOffers(s);
  if (!d || d.shown >= d.turn || d.played < OFFER_TIMES.popupAfterSeconds || !firstOpen(d)) return null;
  return d.turn;
};

/** The round button: a gift box with the clock of the soonest pack; red in its last hours. */
export function OfferChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readOffers, 1);
  const open = d ? firstOpen(d) : null;
  if (!open) return null;
  return <SideButton label="offers" icon={hudIcon('hudGift', Math.round(SIDE.icon * PixelRatio.get()))} caption={shortTime(open.left, t)} hurry={open.hurry} badge="%" ready onPress={onPress} style={style} />;
}

const portrait = (id: string, px: number) => heroIcon(id, Math.round(px * PixelRatio.get()));

/** The hero in a glowing frame, slowly bobbing. */
function HeroFrame({ hero, size }: { hero: HeroDef; size: number }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1);
  }, [glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.45, transform: [{ scale: 1 + glow.value * 0.08 }] }));
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -glow.value * 3 }] }));
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Animated.View style={[styles.halo, { backgroundColor: hero.color, borderRadius: size / 2 }, halo]} />
      <Animated.Image source={{ uri: portrait(hero.id, size) }} style={[{ width: size, height: size }, bob]} />
    </View>
  );
}

type Pack = NonNullable<ReturnType<typeof readOffers>>['packs'][number];

function PackCard({ p, purchases }: { p: Pack; purchases: Purchases }) {
  const t = useT();
  const hero = p.hero ? HERO_BY_ID[p.hero] : null;
  const price = purchases.prices[p.id];
  const can = !p.bought && purchases.busy === null && !!price;
  return (
    <View style={[styles.pack, p.kind === 'mega' && styles.packMega, hero && { borderColor: hero.color }]}>
      <View style={[styles.ribbon, p.kind === 'starter' ? styles.ribbonStarter : p.kind === 'mega' ? styles.ribbonMega : null]}>
        <Text style={styles.ribbonText}>{t(`offer.${p.kind}`)}</Text>
      </View>
      <View style={styles.sticker}>
        <Text style={styles.stickerTop}>{t('offer.worth')}</Text>
        <Text style={styles.stickerBig}>{`x${p.worth}`}</Text>
      </View>
      {hero ? <HeroFrame hero={hero} size={74} /> : <Text style={styles.bigIcon}>{'💎'}</Text>}
      {hero && (
        <>
          <Text style={[styles.heroName, { color: hero.color }]}>{t(`hero.${hero.id}`)}</Text>
          <Text style={styles.heroRole}>{`👑 ${t('rarity.mythic')} · ${t(`role.${hero.role}`)}`}</Text>
          <Text style={styles.bonus}>{t(`heroBonus.${hero.bonus.stat}`).replace('{n}', String(Math.round((hero.bonus.mult - 1) * 100)))}</Text>
          <Text style={styles.small}>{t('offer.heroPerks')}</Text>
        </>
      )}
      <View style={styles.line}>
        <Image source={{ uri: hudIcon('hudGem', Math.round(18 * PixelRatio.get())) }} style={styles.gem} />
        <Text style={styles.gems}>{p.gems}</Text>
        {p.warp > 0 && <Text style={styles.warp}>{`⏩ ${t('offer.warp').replace('{n}', String(p.warp))}`}</Text>}
      </View>
      <View style={styles.grow} />
      {p.bought ? (
        <Text style={styles.owned}>{`✓ ${t('offer.bought')}`}</Text>
      ) : (
        <>
          <Text style={[styles.clock, p.hurry && styles.clockHurry]}>{`⏰ ${t(p.hurry ? 'offer.lastHours' : 'offer.endsIn')} ${countdown(p.left, t)}`}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!can}
            onPress={() => {
              tapFeedback();
              purchases.buy(p.id);
            }}
            style={[styles.buy, !can && styles.buyOff]}
          >
            <Text style={styles.buyText}>{purchases.busy === p.id ? '…' : price ?? '—'}</Text>
          </Pressable>
        </>
      )}
      {p.kind !== 'starter' && !p.bought && <Text style={styles.tiny}>{t(p.kind === 'hero' ? 'offer.comesBack' : 'offer.megaNote')}</Text>}
      {p.kind === 'starter' && !p.bought && <Text style={styles.tiny}>{t('offer.once')}</Text>}
    </View>
  );
}

interface Props {
  gameRef: { current: GameState | null };
  onClose: () => void;
  purchases: Purchases;
}

export function OffersPanel({ gameRef, onClose, purchases }: Props) {
  const t = useT();
  const d = usePoll(gameRef, readOffers, 1);
  if (!d) return null;
  const owned = d.owned ? d.owned.split(',') : [];
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`🔥 ${t('offer.title')}`}</Text>
        {purchases.note ? (
          <Pressable onPress={purchases.clearNote}>
            <Text style={styles.demo}>{purchases.note.kind === 'paid' ? `💎 +${purchases.note.gems} ${t('shop.paid')}` : t(`shop.${purchases.note.kind}`)}</Text>
          </Pressable>
        ) : (
          purchases.mode === 'demo' && <Text style={styles.demo}>{t('shop.demo')}</Text>
        )}
        <View style={styles.grow} />
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal style={styles.packsScroll} contentContainerStyle={styles.packs} showsHorizontalScrollIndicator={false}>
        {d.packs.map((p) => (
          <PackCard key={p.id} p={p} purchases={purchases} />
        ))}
      </ScrollView>
      <View style={styles.collection}>
        <Text style={styles.collectionTitle}>{`${t('offer.collection')} ${owned.length}/${HEROES.length}`}</Text>
        {HEROES.map((h) => {
          const have = owned.includes(h.id);
          return (
            <View key={h.id} style={[styles.slot, have && { borderColor: h.color }]}>
              <Image source={{ uri: portrait(h.id, 30) }} style={[styles.slotImage, !have && styles.slotLocked]} />
              {!have && <Text style={styles.lock}>{'🔒'}</Text>}
            </View>
          );
        })}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 760,
    maxWidth: '97%',
    maxHeight: '96%',
    backgroundColor: panel.bg,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#FF4FD8',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    boxShadow: '0px 6px 0px #120818',
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 19, fontWeight: '900', ...textShadow('#000', 1, 2) },
  demo: { color: '#9CF5A8', fontSize: 11, fontWeight: '800' },
  grow: { flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 15, fontWeight: '900' },
  packsScroll: { flexGrow: 0, flexShrink: 1, marginTop: 6 },
  packs: { gap: 8, paddingVertical: 4, flexGrow: 1, justifyContent: 'center' },
  pack: { width: 226, backgroundColor: panel.row, borderRadius: 16, borderWidth: 2, borderColor: gold, paddingHorizontal: 8, paddingTop: 22, paddingBottom: 8, alignItems: 'center', gap: 2 },
  packMega: { backgroundColor: '#2E1A4A' },
  ribbon: { position: 'absolute', top: 0, left: 0, right: 0, height: 20, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: '#B45CFF', alignItems: 'center', justifyContent: 'center' },
  ribbonStarter: { backgroundColor: '#E8A21A' },
  ribbonMega: { backgroundColor: '#E5483B' },
  ribbonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', ...textShadow('#000', 1, 1) },
  sticker: { position: 'absolute', top: 24, end: 6, width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5483B', borderWidth: 2, borderColor: '#FFE07A', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }], zIndex: 2 },
  stickerTop: { color: '#FFE9A8', fontSize: 8.5, fontWeight: '900' },
  stickerBig: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: -2 },
  frame: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6 },
  bigIcon: { fontSize: 46, height: 74, lineHeight: 74 },
  heroName: { fontSize: 16, fontWeight: '900', ...textShadow('#000', 1, 2) },
  heroRole: { color: '#FFD9F5', fontSize: 11, fontWeight: '800' },
  bonus: { color: '#9CF5A8', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  small: { color: '#C9B3D6', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  gem: { width: 18, height: 18 },
  gems: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  warp: { color: '#FFE07A', fontSize: 11.5, fontWeight: '800', marginStart: 4 },
  clock: { color: '#FFE9A8', fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  clockHurry: { color: '#FF6A5E' },
  buy: { marginTop: 4, alignSelf: 'stretch', height: 34, borderRadius: 12, backgroundColor: '#3FB25A', borderBottomWidth: 3, borderBottomColor: '#24723A', alignItems: 'center', justifyContent: 'center' },
  buyOff: { opacity: 0.45 },
  buyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', ...textShadow('#000', 1, 1) },
  owned: { color: '#9CF5A8', fontSize: 14, fontWeight: '900', marginVertical: 8 },
  tiny: { color: '#A890B5', fontSize: 9.5, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  collection: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, justifyContent: 'center' },
  collectionTitle: { color: '#FFE9A8', fontSize: 12, fontWeight: '900', marginEnd: 4 },
  slot: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E0E24', borderWidth: 2, borderColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  slotImage: { width: 30, height: 30 },
  slotLocked: { opacity: 0.25 },
  lock: { position: 'absolute', fontSize: 11 },
});
