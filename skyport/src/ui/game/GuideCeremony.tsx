import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT } from '../../i18n';
import { Big, formatBig } from '../../sim';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';

export interface GuideNews {
  edition: number;
  stars: number;
  prev: number;
  coins: number;
  gems: number;
}

/** One star of the ceremony: pops in after the ones before it. */
function PopStar({ on, delay }: { on: boolean; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={{ opacity: on ? 1 : 0.18, transform: [{ scale: on ? v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) : 1 }] }}>
      <Icon name="star" size={52} />
    </Animated.View>
  );
}

/** The new edition of the Aviation Guide: the stars, what changed and the rewards. */
export function GuideCeremony({ news, onClose, onSee }: { news: GuideNews; onClose: () => void; onSee: () => void }) {
  const t = useT();
  const dir = useDir();
  const headline = news.stars > news.prev ? t('guide.ceremony.up') : news.stars < news.prev ? t('guide.ceremony.down') : news.stars === 0 ? t('guide.ceremony.none') : t('guide.ceremony.same');
  return (
    <View style={styles.backdrop} testID="guide-ceremony">
      <View style={styles.card}>
        <View style={[styles.top, { flexDirection: dir.row }]}>
          <Icon name="guide" size={30} />
          <View>
            <Text style={styles.kicker}>{t('guide.ceremony.title')}</Text>
            <Text style={styles.edition}>{t('guide.ceremony.edition', { n: news.edition })}</Text>
          </View>
        </View>
        <View style={[styles.stars, { flexDirection: dir.row }]}>
          {[0, 1, 2].map((k) => (
            <PopStar key={k} on={k < news.stars} delay={250 + k * 260} />
          ))}
        </View>
        <Text style={[styles.headline, news.stars < news.prev && { color: C.red }]}>{headline}</Text>
        {news.coins > 0 || news.gems > 0 ? (
          <View style={[styles.rewards, { flexDirection: dir.row }]}>
            {news.coins > 0 ? (
              <View style={[styles.reward, { flexDirection: dir.row }]}>
                <Icon name="coin" size={20} />
                <Text style={styles.rewardText}>{t('guide.ceremony.coins', { n: formatBig(Big.fromNumber(news.coins)) })}</Text>
              </View>
            ) : null}
            {news.gems > 0 ? (
              <View style={[styles.reward, { flexDirection: dir.row }]}>
                <Icon name="diamond" size={20} />
                <Text style={styles.rewardText}>{t('guide.ceremony.gems', { n: news.gems })}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.buttons, { flexDirection: dir.row }]}>
          <Pressable onPress={onSee} style={({ pressed }) => [styles.btn, styles.btnSoft, pressed && { opacity: 0.85 }]} accessibilityRole="button" testID="guide-ceremony-see">
            <Text style={[styles.btnText, { color: C.text }]}>{t('guide.ceremony.see')}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button" testID="guide-ceremony-ok">
            <Text style={styles.btnText}>{t('guide.ceremony.ok')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#ffffff', borderRadius: 26, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', gap: 8, ...SHADOW, borderWidth: 3, borderColor: '#f5b301' },
  top: { alignItems: 'center', gap: 10 },
  kicker: { color: '#b91c1c', fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  edition: { color: C.text, fontSize: 20, fontWeight: '900' },
  stars: { gap: 6, marginVertical: 2 },
  headline: { color: C.text, fontSize: 20, fontWeight: '900' },
  rewards: { gap: 10 },
  reward: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fef3c7' },
  rewardText: { color: C.text, fontSize: 15, fontWeight: '800' },
  buttons: { alignSelf: 'stretch', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: C.green, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  btnSoft: { backgroundColor: 'rgba(15,23,42,0.07)' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
