import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BULK_STEPS, type BulkStep } from '../data/works';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { gold } from './theme';

// Bulk buying (owner request): one tap buys one level, ten, a hundred, or as many as the coins
// pay for. The choice is shared by the upgrade lists and staff training.

export const bulkLabel = (step: BulkStep, max: string) => (step === 'max' ? max : `x${step}`);

export function BulkToggle() {
  const t = useT();
  const { bulk, setBulk } = useSettings();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {BULK_STEPS.map((step) => (
        <Pressable
          key={String(step)}
          accessibilityRole="radio"
          accessibilityState={{ selected: step === bulk }}
          onPress={() => setBulk(step)}
          hitSlop={4}
          style={[styles.chip, step === bulk && styles.chipOn]}
        >
          <Text style={[styles.text, step === bulk && styles.textOn]}>{bulkLabel(step, t('ui.max'))}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: '#1E0E24', borderRadius: 14, padding: 2, gap: 2, borderWidth: 1.5, borderColor: '#5A3A64' },
  chip: { minWidth: 34, height: 26, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: gold },
  text: { color: '#E8D7F0', fontWeight: '900', fontSize: 12 },
  textOn: { color: '#2A1530' },
});
