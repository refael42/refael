// Copies the CanvasKit wasm binary (used by Skia on web) into public/,
// so `expo export --platform web` serves it next to the bundle.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
let src;
try {
  src = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
} catch {
  console.warn('[copy-canvaskit] canvaskit-wasm not found, skipping');
  process.exit(0);
}
const outDir = join(root, 'public');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'canvaskit.wasm'));
console.log('[copy-canvaskit] public/canvaskit.wasm ready');
