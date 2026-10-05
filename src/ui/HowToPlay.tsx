import { useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { hudIcon, spriteIcon } from '../render/icons';
import { gold, panel } from './theme';

// Three cards on how the game works: seat, serve, grow. Part of the first run, and in the
// settings any time after.

const ICON = 64;
const px = Math.round(ICON * PixelRatio.get());
const CARDS = [
  { title: 'how.seatTitle', body: 'how.seatBody', icon: () => spriteIcon('seat', px) },
  { title: 'how.serveTitle', body: 'how.serveBody', icon: () => hudIcon('hudCoin', px) },
  { title: 'how.growTitle', body: 'how.growBody', icon: () => spriteIcon('arrowUp', px) },
] as const;

/** The cards with dots and Back / Next; the last Next says `doneLabel`. */
export function HowToPlayCards({ doneLabel, onDone }: { doneLabel: string; onDone: () => void }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const card = CARDS[page]!;
  const last = page === CARDS.length - 1;
  return (
    <View style={styles.cards}>
      <Text style={styles.heading}>{t('how.title')}</Text>
      <Image source={{ uri: card.icon() }} style={styles.icon} />
      <Text style={styles.title}>{t(card.title)}</Text>
      <Text style={styles.body}>{t(card.body)}</Text>
      <View style={styles.dots}>
        {CARDS.map((c, i) => (
          <View key={c.title} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.buttons}>
        {page > 0 && (
          <Pressable accessibilityRole="button" onPress={() => setPage(page - 1)} style={[styles.button, styles.back]}>
            <Text style={styles.backText}>{t('welcome.back')}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => (last ? onDone() : setPage(page + 1))} style={[styles.button, styles.next]}>
          <Text style={styles.nextText}>{last ? doneLabel : t('welcome.next')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The cards on their own, over the game (from the settings). */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={() => undefined}>
        <HowToPlayCards doneLabel={t('ui.done')} onDone={onClose} />
      </Pressable>
    </Pressable>
  );
}

export const cardStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.62)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 440,
    maxWidth: '92%',
    maxHeight: '94%',
    backgroundColor: panel.bg,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: gold,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: '0px 6px 0px #120818',
  },
  button: { minWidth: 110, height: 44, borderRadius: 22, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, boxShadow: '0px 3px 0px #120818' },
  next: { backgroundColor: '#35B957', borderColor: '#FFE08A' },
  nextText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  back: { backgroundColor: '#4A2A56', borderColor: '#8A6A9A' },
  backText: { color: '#E8D7F0', fontWeight: '800', fontSize: 15 },
});

const styles = StyleSheet.create({
  ...cardStyles,
  cards: { alignItems: 'center', gap: 4, width: '100%' },
  heading: { color: '#C9B3D6', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  icon: { width: ICON, height: ICON, marginVertical: 2 },
  title: { color: '#FFE9A8', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  body: { color: '#F3E6FA', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21, minHeight: 63 },
  dots: { flexDirection: 'row', gap: 7, marginVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#5A3A6A' },
  dotOn: { backgroundColor: gold, width: 22 },
  buttons: { flexDirection: 'row', gap: 10 },
});
