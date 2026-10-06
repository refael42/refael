import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { NEWS } from '../data/news';
import { useT } from '../i18n';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

/** Once after an update: what is new in the restaurant, one line each. */
export function NewsCard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const close = () => {
    tapFeedback();
    onClose();
  };
  return (
    <Overlay onClose={close} card={styles.card}>
      <Text style={styles.title}>{`✨ ${t('news.title')}`}</Text>
      <ScrollView style={scrollFill} contentContainerStyle={styles.list}>
        {NEWS.items.map((key) => (
          <View key={key} style={styles.row}>
            <Text style={styles.item}>{t(key)}</Text>
          </View>
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={close} style={styles.ok}>
        <Text style={styles.okText}>{t('news.ok')}</Text>
      </Pressable>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 560, maxWidth: '94%', maxHeight: '92%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 14, gap: 8, alignItems: 'center' },
  title: { color: '#FFE9A8', fontSize: 21, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  list: { gap: 6 },
  row: { backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  item: { color: '#FFF4E3', fontSize: 13.5, fontWeight: '700' },
  ok: { height: 42, paddingHorizontal: 30, borderRadius: 16, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', justifyContent: 'center', boxShadow: '0px 3px 0px #17602A' },
  okText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
