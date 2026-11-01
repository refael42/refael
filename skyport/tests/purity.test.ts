import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const PURE_DIRS = ['src/sim', 'src/data'];
const FORBIDDEN_IMPORT = /from\s+['"](react|react-native|@shopify|expo|react-native-[\w-]+|zustand|@react-native[\w-/]*|\.\.\/\.\.\/render|\.\.\/render|\.\.\/ui|\.\.\/\.\.\/ui|\.\.\/i18n|\.\.\/\.\.\/i18n)[^'"]*['"]/;
const FORBIDDEN_CALLS = [/Date\.now\s*\(/, /Math\.random\s*\(/, /performance\.now\s*\(/, /new Date\s*\(/, /setTimeout\s*\(/, /setInterval\s*\(/, /requestAnimationFrame\s*\(/];

describe('simulation purity', () => {
  const files = PURE_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('finds the sim files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const f of files) {
    const rel = relative(ROOT, f);
    it(`${rel} imports no UI and uses no clocks or Math.random`, () => {
      const src = readFileSync(f, 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(FORBIDDEN_IMPORT);
      for (const re of FORBIDDEN_CALLS) expect(code, `${rel} uses ${re}`).not.toMatch(re);
      expect(rel.endsWith('.tsx'), 'no JSX in the simulation').toBe(false);
    });
  }
});
