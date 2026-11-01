import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { renderScene, type RenderRes } from './scene';

function emptyPicture(width: number, height: number) {
  'worklet';
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
  c.drawColor(Skia.Color('#7cc36b'));
  return rec.finishRecordingAsPicture();
}

/** The single Skia canvas. Draws only from the snapshot shared value. */
export function SceneCanvas({
  snap,
  res,
  width,
  height,
}: {
  snap: SharedValue<Float32Array>;
  res: SharedValue<RenderRes | null>;
  width: number;
  height: number;
}) {
  const picture = useDerivedValue(() => {
    const r = res.value;
    if (!r) return emptyPicture(width, height);
    return renderScene(snap.value, r, width, height);
  }, [width, height]);
  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
