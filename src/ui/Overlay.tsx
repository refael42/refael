import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// A dimmed backdrop that closes on tap, with a card on top of it. The card is a plain View
// beside the backdrop, not a button inside it: a button around a list takes the finger on
// phones, and the list inside never scrolls (owner report: "can't scroll down in the shop").

export function Overlay({ onClose, card, children, dim = 'rgba(14,6,18,0.6)' }: { onClose: () => void; card: StyleProp<ViewStyle>; children: ReactNode; dim?: string }) {
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel="close" onPress={onClose} style={[styles.backdrop, { backgroundColor: dim }]} />
      <View style={card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

/** A list inside an Overlay card: shrinks to the space left and scrolls. */
export const scrollFill: ViewStyle = { flexShrink: 1, flexGrow: 0 };
