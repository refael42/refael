import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { LoadingScreen } from '../ui/LoadingScreen';

/** Web: load CanvasKit (wasm) before any module that touches Skia. */
export default function Root() {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import('../ui/App')}
      fallback={<LoadingScreen progress={0.15} />}
    />
  );
}
