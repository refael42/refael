import type { ReactNode } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { HudIcon } from '../render/art/hudArt';
import { hudIcon } from '../render/icons';

// The game's own drawn icons in place of emojis (owner M41: emojis looked cheap and differ on
// every phone). Rendered once per size to a PNG (src/render/icons.ts), so they cost nothing to show.

export function GameIcon({ name, size, style }: { name: HudIcon; size: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={{ uri: hudIcon(name, Math.round(size * PixelRatio.get())) }} style={[{ width: size, height: size }, style]} />;
}

/** An icon then its words on one line (the icon first in reading order, as the emoji was). */
export function IconText({ icon, size, children, style, textStyle }: { icon: HudIcon; size: number; children: ReactNode; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <GameIcon name={icon} size={size} />
      <Text style={textStyle}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
