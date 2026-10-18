import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { registerRootComponent } from 'expo';

// On web, Skia is CanvasKit (WASM, served from /public by the postinstall script). It must finish
// loading before any module that touches Skia is evaluated, so the app is imported dynamically.
// The opening animation's color while the WASM downloads, instead of a white page.
document.body.style.backgroundColor = '#2A1230';
LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(async () => {
  const { default: App } = await import('./src/App');
  registerRootComponent(App);
  // Browser only, never in the store build: the art review scripts render any sprite to a PNG
  // (`__spriteIcon('plateSalad2', 128)`), to look at every dish, prop and look side by side.
  const { STORE_BUILD } = await import('./src/config');
  if (!STORE_BUILD) {
    const { spriteIcon } = await import('./src/render/icons');
    const { spriteNames } = await import('./src/render/sprites');
    Object.assign(globalThis, { __spriteIcon: spriteIcon, __spriteNames: spriteNames });
  }
});
