// Checks the store texts (store/listing-*.md) fit the stores' limits: each "## Heading (up to N)"
// section's text (the `code` line when there is one, else everything under the heading) must be
// at most N characters. Run: npm run store:check
import { readdirSync, readFileSync } from 'node:fs';

let bad = 0;
for (const file of readdirSync('store').filter((f) => /^listing-.*\.md$/.test(f))) {
  const sections = readFileSync(`store/${file}`, 'utf8').split(/^## /m).slice(1);
  for (const section of sections) {
    const [heading, ...rest] = section.split('\n');
    const limit = Number(/(\d+)/.exec(heading.match(/\(([^)]*)\)/)?.[1] ?? '')?.[1]);
    if (!limit) continue;
    const body = rest.join('\n').trim();
    const code = /^`([^`]*)`$/m.exec(body);
    const text = code ? code[1] : body;
    const length = [...text].length;
    const ok = length <= limit;
    if (!ok) bad++;
    console.log(`${ok ? 'ok ' : 'TOO LONG'}  ${file}  ${heading.trim()}: ${length}/${limit}`);
  }
}
if (bad) process.exit(1);
