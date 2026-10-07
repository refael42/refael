import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The simulation must run headless (tests, offline progress, balance bot), so sim and data
// may only import each other and pure libraries. This guards the architecture rule.
const PURE_DIRS = ['src/sim', 'src/data'];
const ALLOWED_PACKAGES = ['break_infinity.js'];

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

describe('architecture: pure simulation', () => {
  const files = PURE_DIRS.flatMap(filesIn).filter((f) => /\.tsx?$/.test(f));

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports nothing from UI/render layers', (file) => {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    for (const spec of imports) {
      if (spec.startsWith('.')) {
        expect(spec, `${file} -> ${spec}`).not.toMatch(/\/(render|ui|store|audio|i18n)(\/|$)/);
      } else {
        expect(ALLOWED_PACKAGES, `${file} imports package ${spec}`).toContain(spec);
      }
    }
  });
});
