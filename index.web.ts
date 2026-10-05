import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { registerRootComponent } from 'expo';

// On web, Skia is CanvasKit (WASM, served from /public by the postinstall script). It must finish
// loading before any module that touches Skia is evaluated, so the app is imported dynamically.
LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(async () => {
  const { default: App } = await import('./src/App');
  registerRootComponent(App);
});
