import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT } from '../../i18n';
import { formatBig, formatDuration, type OfflineResult } from '../../sim';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';

export function WelcomeBack({ r, onClose }: { r: OfflineResult; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.glow}>
          <Icon name="coin" size={64} />
        </View>
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.sub}>{t('welcome.away', { t: formatDuration(r.seconds) })}</Text>
        <Text style={styles.label}>{t('welcome.earned')}</Text>
        <View style={[styles.amountRow, { flexDirection: dir.row }]}>
          <Icon name="coin" size={30} />
          <Text style={styles.amount}>{formatBig(r.amount)}</Text>
        </View>
        {r.capped ? <Text style={styles.note}>{t('welcome.capped')}</Text> : null}
        <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={styles.btnText}>{t('welcome.collect')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 28, padding: 22, alignItems: 'center', gap: 6, ...SHADOW },
  glow: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { color: C.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  label: { color: C.textDim, fontSize: 13, marginTop: 10, fontWeight: '700' },
  amountRow: { alignItems: 'center', gap: 8 },
  amount: { color: C.text, fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  note: { color: C.amber, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  btn: { marginTop: 12, alignSelf: 'stretch', backgroundColor: C.green, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
