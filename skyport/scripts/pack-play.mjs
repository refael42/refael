// Packs the web export (dist/) into a folder that runs from any sub-path
// (a hosted preview): absolute "/..." asset paths become relative "./...".
// Usage: node scripts/pack-play.mjs [outDir]   (after `npm run export:web`)
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'dist');
const out = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, 'artifacts', 'play');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

rmSync(out, { recursive: true, force: true });
for (const file of walk(src)) {
  const rel = relative(src, file);
  if (rel === 'metadata.json') continue;
  // bundles go to js/ (some hosts reserve names that start with "_")
  const dest = join(out, rel.replace(/^_expo[\\/]static[\\/]js[\\/]web[\\/]/, 'js/'));
  mkdirSync(dirname(dest), { recursive: true });
  if (/\.(html|js)$/.test(file)) {
    const text = readFileSync(file, 'utf8')
      .replaceAll('"/_expo/static/js/web/', '"./js/')
      .replaceAll('"/favicon.ico"', '"./favicon.ico"');
    writeFileSync(dest, text);
  } else copyFileSync(file, dest);
}
// the same game as a page fragment for a hosted preview that wraps the page in its own document
// (it supplies the doctype, charset and viewport): our title, a full-height root and the bundle
const html = readFileSync(join(out, 'index.html'), 'utf8');
const script = html.match(/<script src="([^"]+)"/)?.[1];
if (!script) throw new Error('no bundle script in index.html');
writeFileSync(
  join(out, 'page.html'),
  `<title>Skyport Tycoon</title>
<meta name="description" content="An isometric airport tycoon game">
<style>
  /* the game draws its own world: one dark backdrop behind the canvas, in any theme */
  :root { color-scheme: dark; background: #0f172a; }
  html, body { height: 100%; }
  body { margin: 0; overflow: hidden; background: #0f172a; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script src="${script}" defer></script>
`,
);
console.log('packed', walk(out).map((f) => relative(out, f)).join(', '));
