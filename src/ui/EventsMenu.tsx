import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { stepsReached } from '../sim/festival';
import { useT } from '../i18n';
import { hudIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import type { GameState } from '../sim/game/types';
import { dealAt } from '../sim/shop';
import { CityChip } from './Branch';
import { FestivalChip, shortTime } from './Festival';
import { GuideChip } from './Guide';
import { OfferChip, openOffer } from './Offers';
import { ReviewsChip } from './Reviews';
import { DealChip } from './Shop';
import { SeasonChip, seasonWaiting } from './Season';
import { AlbumChip, albumWaiting } from './Album';
import { SIDE, SideButton } from './SideButton';

// One "events" button instead of a row of six round ones under the rating (owner M40: "a less
// crowded screen"). Its badge counts what waits (reviews to take, festival prizes, a pack or a
// deal on), it glows when there is something to take, and while a pack is on it shows that
// pack's clock. Tapped, the same round buttons slide out in a row to its left (a column ran off
// the bottom of a landscape screen); picking one closes the row.

/** The list closes by itself after this long untouched (ms). */
const AUTO_CLOSE_MS = 8000;

const readAttention = (s: GameState) => {
  const offer = openOffer(s);
  const prizes = s.festival.id >= 0 ? Math.max(0, stepsReached(s.festival) - s.festival.claimed) : 0;
  const reviews = s.reviews.filter((r) => !r.claimed).length;
  const deal = dealAt(s, Date.now());
  const dealOn = !!deal && !deal.bought;
  const season = seasonWaiting(s);
  const album = albumWaiting(s);
  return { count: prizes + reviews + season + album + (offer ? 1 : 0) + (dealOn ? 1 : 0), ready: prizes > 0 || reviews > 0 || season > 0 || album > 0, hurry: offer?.hurry ?? false, offerLeft: offer?.left ?? null };
};

interface Props {
  gameRef: { current: GameState | null };
  /** The festival, the packs and the deal come after the tutorial. */
  full: boolean;
  onOffers: () => void;
  onFestival: () => void;
  onSeason: () => void;
  onAlbum: () => void;
  onShop: () => void;
  onReviews: () => void;
  onGuide: () => void;
  style: StyleProp<ViewStyle>;
}

export function EventsMenu({ gameRef, full, onOffers, onFestival, onSeason, onAlbum, onShop, onReviews, onGuide, style }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const a = usePoll(gameRef, readAttention, 1);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [open]);
  const pick = (go: () => void) => () => {
    setOpen(false);
    go();
  };
  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <SideButton
        label="events"
        icon={hudIcon('hudGift', Math.round(SIDE.icon * PixelRatio.get()))}
        caption={a?.offerLeft != null ? shortTime(a.offerLeft, t) : t('events.title')}
        hurry={a?.hurry}
        badge={a && a.count > 0 ? a.count : undefined}
        ready={a?.ready}
        onPress={() => setOpen((o) => !o)}
      />
      {open && (
        <View style={styles.list} pointerEvents="box-none">
          {full && <OfferChip gameRef={gameRef} onPress={pick(onOffers)} style={styles.item} />}
          {full && <SeasonChip gameRef={gameRef} onPress={pick(onSeason)} style={styles.item} />}
          {full && <FestivalChip gameRef={gameRef} onPress={pick(onFestival)} style={styles.item} />}
          {full && <DealChip gameRef={gameRef} onPress={pick(onShop)} style={styles.item} />}
          <ReviewsChip gameRef={gameRef} onPress={pick(onReviews)} style={styles.item} />
          <AlbumChip gameRef={gameRef} onPress={pick(onAlbum)} style={styles.item} />
          <GuideChip gameRef={gameRef} onPress={pick(onGuide)} style={styles.item} />
          <CityChip gameRef={gameRef} style={styles.item} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center' },
  // Right to left from the button, whatever the language (the order is the same as before M40).
  list: { position: 'absolute', top: -2, right: SIDE.size + 8, flexDirection: 'row-reverse', direction: 'ltr', alignItems: 'flex-start', gap: 2, backgroundColor: 'rgba(32,12,38,0.8)', borderRadius: 16, paddingVertical: 2, paddingHorizontal: 4 },
  item: { position: 'relative' },
});
