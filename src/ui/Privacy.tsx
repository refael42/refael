import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The privacy policy inside the app (both stores want it reachable from the app, not only from
// the store page). The same text lives in docs/store/privacy-policy.md for the web link.

const PARAGRAPHS = ['privacy.p1', 'privacy.p2', 'privacy.p3', 'privacy.p4', 'privacy.p5', 'privacy.p6'] as const;

export function PrivacyPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`🔒 ${t('set.privacy')}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
        {PARAGRAPHS.map((k) => (
          <Text key={k} style={styles.text}>
            {t(k)}
          </Text>
        ))}
        <Text style={styles.small}>{t('privacy.updated')}</Text>
      </ScrollView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 620, maxWidth: '96%', maxHeight: '92%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#FFE9A8', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { gap: 8, paddingBottom: 4 },
  text: { color: '#F2E6F7', fontSize: 14, fontWeight: '700', lineHeight: 20, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  small: { color: '#C9B3D6', fontSize: 12, fontWeight: '800' },
});
