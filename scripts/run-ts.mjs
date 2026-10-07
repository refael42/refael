// Runs a TypeScript script that exports `main(args)` straight from the game's sources, through
// Vite's SSR loader (already installed for the tests): no build step and no extra dependency.
// Usage: node scripts/run-ts.mjs scripts/balance.ts [args...]
import { createServer } from 'vite';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node scripts/run-ts.mjs <script.ts> [args...]');
  process.exit(1);
}

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const mod = await server.ssrLoadModule(`/${entry.replace(/\\/g, '/')}`);
  await mod.main(args);
} finally {
  await server.close();
}
