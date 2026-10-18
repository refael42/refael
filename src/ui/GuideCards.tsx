import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { buzz } from '../audio/sound';
import { DISHES } from '../data/dishes';
import { GUIDE } from '../data/guide';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { DISH_ICONS } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { SUSPECT_RANK } from '../sim/game/guide';
import type { GameState } from '../sim/game/types';
import { GameIcon, IconText } from './GameIcon';
import { gold, textShadow } from './theme';

// The guide's moments on screen (owner: "improve the Michelin guide"): its mark drawn as red
// rosettes, the rumor of an inspector in town, the inspector's notebook when they say who they
// were, and the new edition as a little ceremony (the rosettes stamped in one by one).

const RED = '#C8102E';

/** The guide's mark: a red rosette per star, the plate for "recommended", a dash for nothing yet. */
export function GuideMark({ stars, plate, size, dim }: { stars: number; plate: boolean; size: number; dim?: boolean }) {
  if (stars <= 0 && !plate) return <Text style={[styles.dash, { fontSize: size * 0.8 }]}>{'—'}</Text>;
  return (
    <View style={[styles.markRow, dim && styles.dim]}>
      {stars > 0 ? Array.from({ length: stars }, (_, i) => <GameIcon key={i} name="iconRosette" size={size} />) : <GameIcon name="iconPlate" size={size} />}
    </View>
  );
}

const readRumor = (s: GameState) => {
  const g = s.guide;
  if (!g.rumor && g.attention < 0) return null;
  // After the inspector left, the hint goes (the reveal card says the rest).
  if (!g.rumor) return null;
  return { chosen: g.attention >= 0, suspects: s.customers.filter((c) => c.rank === SUSPECT_RANK).length };
};

/** An inspector is in town today: what to look for, and that one guest a day can get the head chef. */
export function RumorHint({ gameRef, style }: { gameRef: { current: GameState | null }; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readRumor, 2);
  const pop = useSharedValue(0);
  const on = !!d;
  useEffect(() => {
    // A little shake when it appears, so it is not missed.
    pop.value = on ? withSequence(withTiming(0, { duration: 1 }), withSpring(1, { damping: 7, stiffness: 160 })) : 0;
  }, [on, pop]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.7 + pop.value * 0.3 }] }));
  if (!d) return null;
  const line = d.chosen ? 'rumor.chosen' : d.suspects > 0 ? 'rumor.tap' : 'rumor.wait';
  return (
    <Animated.View style={[styles.rumor, anim, style]} pointerEvents="none">
      <GameIcon name={d.chosen ? 'iconChef' : 'iconMagnifier'} size={26} />
      <View style={styles.shrink}>
        <Text style={styles.rumorTitle}>{t('rumor.title')}</Text>
        <Text style={styles.rumorText}>{t(line).replace('{n}', String(d.suspects))}</Text>
      </View>
    </Animated.View>
  );
}

interface Reveal {
  id: number;
  score: number;
  verdict: string;
  dish: number;
  best: string;
  worst: string;
  spotted: boolean;
  walkedOut: boolean;
}

const readReveal = (s: GameState): Reveal | null => {
  for (let i = s.notices.length - 1; i >= 0; i--) {
    const n = s.notices[i]!;
    if (n.kind === 'inspector') return { id: n.id, score: n.score, verdict: n.verdict, dish: n.dish, best: n.best, worst: n.worst, spotted: n.spotted, walkedOut: n.walkedOut };
  }
  return null;
};

/** The inspector paid and said who they were: their notebook, for a few seconds (a tap closes it). */
export function InspectorCard({ gameRef, hidden }: { gameRef: { current: GameState | null }; hidden: boolean }) {
  const t = useT();
  const r = usePoll(gameRef, readReveal, 2);
  const [closed, setClosed] = useState(-1);
  const pop = useSharedValue(0);
  const id = r?.id ?? -1;
  const show = !!r && id !== closed && !hidden;
  useEffect(() => {
    if (!show) return;
    pop.value = withSequence(withTiming(0, { duration: 1 }), withSpring(1, { damping: 10, stiffness: 150 }));
    const timer = setTimeout(() => setClosed(id), 8000);
    return () => clearTimeout(timer);
  }, [show, id, pop]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.4), transform: [{ translateY: (1 - pop.value) * -30 }, { rotate: `${(1 - pop.value) * -4}deg` }] }));
  if (!show || !r) return null;
  const dish = DISHES[r.dish];
  const good = r.score >= GUIDE.starScore[0]!;
  return (
    <Pressable style={styles.revealWrap} onPress={() => setClosed(id)} accessibilityRole="button" accessibilityLabel="inspector notebook">
      <Animated.View style={[styles.reveal, anim]}>
        <View style={styles.spine} />
        <IconText icon="iconNotebook" size={20} textStyle={styles.revealKicker}>{t('guide.revealed')}</IconText>
        <Text style={[styles.verdict, !good && styles.verdictLow]}>{`"${t(r.verdict)}"`}</Text>
        {dish && !r.walkedOut && (
          <View style={styles.row}>
            <Image source={{ uri: spriteIcon(DISH_ICONS[r.dish]!, Math.round(26 * PixelRatio.get())) }} style={styles.dishIcon} />
            <Text style={styles.note}>{`${t('reveal.ate')} ${t(dish.nameKey)}`}</Text>
          </View>
        )}
        {r.walkedOut ? (
          <Text style={styles.noteBad}>{t('reveal.walkedOut')}</Text>
        ) : (
          <>
            {r.best !== '' && <Text style={styles.note}>{`${t('reveal.best')} ${t(`guide.part.${r.best}`)}`}</Text>}
            {r.worst !== '' && r.worst !== r.best && <Text style={styles.noteWeak}>{`${t('reveal.worst')} ${t(`guide.part.${r.worst}`)}`}</Text>}
          </>
        )}
        {r.spotted && <IconText icon="iconChef" size={18} textStyle={styles.spotted}>{t(r.walkedOut ? 'reveal.spottedLate' : 'reveal.spotted')}</IconText>}
      </Animated.View>
    </Pressable>
  );
}

/** One rosette (or the plate) stamped onto the page: big and turned, then down with a thump. */
function Stamp({ delay, plate, lost }: { delay: number; plate?: boolean; lost?: boolean }) {
  const v = useSharedValue(0);
  const gone = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, { damping: 13, stiffness: 190 }));
    const id = setTimeout(() => buzz('light'), delay + 120);
    // A star taken away: it greys and falls off after it lands.
    if (lost) gone.value = withDelay(delay + 900, withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) }));
    return () => clearTimeout(id);
  }, [v, gone, delay, lost]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 2) * (1 - gone.value),
    transform: [{ translateY: gone.value * 60 }, { scale: 2.4 - v.value * 1.4 }, { rotate: `${(1 - v.value) * -25 + gone.value * 40}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <GameIcon name={plate ? 'iconPlate' : 'iconRosette'} size={50} style={lost ? styles.dim : undefined} />
    </Animated.View>
  );
}

/** Rays of light turning slowly behind the mark. */
function Rays({ color }: { color: string }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View style={[styles.rays, style]} pointerEvents="none">
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={[styles.ray, { backgroundColor: color, transform: [{ rotate: `${i * 15}deg` }] }]} />
      ))}
    </Animated.View>
  );
}

/** A new edition is out: the stars won (or lost) stamped in, what they bring, the gems for a first. */
export function GuideEdition({ stars, change, plate, gems, onClose }: { stars: number; change: number; plate: boolean; gems: number; onClose: () => void }) {
  const t = useT();
  const pop = useSharedValue(0);
  const after = useSharedValue(0);
  // Once, when it appears: the screen behind redraws often, and restarting the pop and the
  // timer with every redraw made the card bounce and never close by itself (owner: "bugs in the
  // guide's pop-ups").
  const close = useRef(onClose);
  close.current = onClose;
  const marks = stars > 0 ? stars : plate ? 1 : 0;
  const lostOne = change < 0;
  const stampsEnd = 500 + (marks + (lostOne ? 1 : 0)) * 380;
  useEffect(() => {
    pop.value = withSequence(withTiming(0, { duration: 1 }), withSpring(1, { damping: 9, stiffness: 140 }));
    after.value = withDelay(stampsEnd, withTiming(1, { duration: 450 }));
    const id = setTimeout(() => close.current(), 7500 + stampsEnd);
    return () => clearTimeout(id);
  }, [pop, after, stampsEnd]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.4), transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  const late = useAnimatedStyle(() => ({ opacity: after.value, transform: [{ translateY: (1 - after.value) * 8 }] }));
  const title = change > 0 ? (stars === 1 ? 'guide.firstStar' : 'guide.moreStars') : change < 0 ? 'guide.lostStar' : plate && stars === 0 ? 'guide.plateIn' : 'guide.keptTitle';
  const price = Math.round(((GUIDE.price[stars] ?? 1) - 1) * 100);
  const guests = Math.round(((GUIDE.arrivals[stars] ?? 1) - 1) * 100);
  return (
    <Pressable style={styles.editionWrap} onPress={onClose}>
      <Animated.View style={[styles.edition, lostOne && styles.editionSad, style]}>
        <IconText icon="hudBook" size={18} textStyle={styles.editionKicker}>{t('guide.newEdition')}</IconText>
        <View style={styles.stage}>
          {!lostOne && marks > 0 && <Rays color={change > 0 ? 'rgba(255,200,40,0.32)' : 'rgba(200,16,46,0.12)'} />}
          <View style={styles.stamps}>
            {Array.from({ length: marks }, (_, i) => (
              <Stamp key={i} delay={500 + i * 380} plate={stars === 0} />
            ))}
            {lostOne && <Stamp delay={500 + marks * 380} lost />}
            {marks === 0 && !lostOne && <Text style={styles.dashBig}>{'—'}</Text>}
          </View>
        </View>
        <Animated.View style={[styles.after, late]}>
          <Text style={styles.editionTitle}>{t(title)}</Text>
          <Text style={styles.small}>{t(stars > 0 ? `guide.stars${stars}` : plate ? 'guide.plate' : 'guide.none')}</Text>
          {stars > 0 && <Text style={styles.perk}>{t('guide.perks').replace('{price}', String(price)).replace('{guests}', String(guests))}</Text>}
          {gems > 0 && (
            <View style={styles.gems}>
              <GameIcon name="hudGem" size={20} />
              <Text style={styles.gemsText}>{`+${gems} ${t('guide.firstGems')}`}</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dim: { opacity: 0.35 },
  dash: { color: '#C9B3D6', fontWeight: '900' },
  shrink: { flexShrink: 1 },
  rumor: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 300, backgroundColor: 'rgba(32,12,38,0.94)', borderRadius: 14, borderWidth: 2, borderColor: RED, paddingHorizontal: 10, paddingVertical: 6 },
  rumorTitle: { color: '#FFB3BE', fontSize: 13, fontWeight: '900', ...textShadow('#120818', 1, 0) },
  rumorText: { color: '#FFF4E3', fontSize: 12, fontWeight: '800' },
  revealWrap: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center' },
  reveal: { width: 360, maxWidth: '92%', gap: 4, backgroundColor: '#FFFDF4', borderRadius: 14, borderWidth: 3, borderColor: RED, paddingVertical: 10, paddingStart: 22, paddingEnd: 14, boxShadow: '0px 5px 0px #5A0A1A' },
  spine: { position: 'absolute', start: 0, top: 0, bottom: 0, width: 12, backgroundColor: RED, borderTopStartRadius: 10, borderBottomStartRadius: 10 },
  revealKicker: { color: RED, fontSize: 13, fontWeight: '900' },
  verdict: { color: '#2A1530', fontSize: 17, fontWeight: '900', fontStyle: 'italic' },
  verdictLow: { color: '#7A3B2E' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dishIcon: { width: 26, height: 26 },
  note: { color: '#3D6B2E', fontSize: 12.5, fontWeight: '800' },
  noteWeak: { color: '#A3541A', fontSize: 12.5, fontWeight: '800' },
  noteBad: { color: '#B3202E', fontSize: 12.5, fontWeight: '800' },
  spotted: { color: '#2A1530', fontSize: 12.5, fontWeight: '900' },
  editionWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,6,18,0.5)' },
  edition: { width: 360, maxWidth: '92%', alignItems: 'center', gap: 6, backgroundColor: '#FFF8EC', borderRadius: 22, borderWidth: 4, borderColor: RED, paddingVertical: 16, paddingHorizontal: 18, boxShadow: '0px 6px 0px #5A0A1A', overflow: 'hidden' },
  editionSad: { borderColor: '#7E8A98' },
  editionKicker: { color: RED, fontSize: 14, fontWeight: '900' },
  stage: { height: 86, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stamps: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rays: { position: 'absolute', width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 12, height: 150, borderRadius: 6 },
  dashBig: { color: '#7E8A98', fontSize: 40, fontWeight: '900' },
  after: { alignItems: 'center', gap: 4 },
  editionTitle: { color: '#2A1530', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  small: { color: '#5E4A66', fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  perk: { color: '#3D6B2E', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  gems: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2A1530', borderRadius: 14, borderWidth: 2, borderColor: gold, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  gemsText: { color: '#FFE9A8', fontSize: 14, fontWeight: '900' },
});
