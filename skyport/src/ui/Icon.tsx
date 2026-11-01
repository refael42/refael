import { memo } from 'react';
import { Image, View } from 'react-native';

import type { IconName } from '../render/art/icons';
import { getIconSheet } from './iconSheet';

/** Vector icon from the code-drawn icon sheet (no emoji, no image files). */
export const Icon = memo(function Icon({ name, size }: { name: IconName; size: number }) {
  const sheet = getIconSheet();
  if (!sheet) return <View style={{ width: size, height: size }} />;
  const i = sheet.index(name);
  const col = i % sheet.cols;
  const row = Math.floor(i / sheet.cols);
  const k = size / sheet.cell;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} pointerEvents="none">
      <Image
        source={{ uri: sheet.uri }}
        style={{ position: 'absolute', width: sheet.width * k, height: sheet.height * k, left: -col * sheet.cell * k, top: -row * sheet.cell * k }}
        fadeDuration={0}
      />
    </View>
  );
});
