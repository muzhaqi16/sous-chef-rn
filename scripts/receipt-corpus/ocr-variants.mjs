/**
 * Recognises the corpus photos twice, as taken and squared to the receipt (the
 * document scanner's crop), and builds each receipt's pages from both the way
 * the app does (`receiptText`: assembled, redacted, capped).
 * `text-fidelity.mjs` scores both against the answer key.
 *
 *   node --experimental-transform-types scripts/receipt-corpus/ocr-variants.mjs <corpus-root>
 *
 * Writes <root>/ocr/, <root>/ocr-squared/, <root>/pages-raw/ and
 * <root>/pages-squared/. The root holds images/<id>.jpg, as build.mjs caches
 * them (sideways photos already turned). macOS only: recognition is Vision's.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const UTILS = join(HERE, '../../src/features/receipts/utils');
const root = process.argv[2];
if (!root) {
  console.error(
    'Usage: node scripts/receipt-corpus/ocr-variants.mjs <corpus-root>',
  );
  process.exit(1);
}

const { receiptText } = await import(`${UTILS}/receiptText.ts`);

const bin = join(tmpdir(), 'sous-chef-receipt-ocr-bin');
execFileSync('swiftc', ['-O', join(HERE, 'ocr.swift'), '-o', bin], {
  stdio: ['ignore', 'ignore', 'inherit'],
});

const images = readdirSync(join(root, 'images'))
  .filter(name => name.endsWith('.jpg'))
  .sort()
  .map(name => join(root, 'images', name));

for (const [variant, flags] of [
  ['raw', []],
  ['squared', ['--square']],
]) {
  const ocrDir = join(root, variant === 'raw' ? 'ocr' : 'ocr-squared');
  const pagesDir = join(root, `pages-${variant}`);
  mkdirSync(ocrDir, { recursive: true });
  mkdirSync(pagesDir, { recursive: true });
  // One process per photo when squaring: Vision's document segmentation runs
  // out of compute resources after a dozen photos in one process (e5rtError 13).
  const batches = flags.length > 0 ? images.map(image => [image]) : [images];
  for (const batch of batches) {
    execFileSync(bin, [...flags, ocrDir, ...batch], { stdio: 'inherit' });
  }
  for (const name of readdirSync(ocrDir).filter(n => n.endsWith('.json'))) {
    const page = JSON.parse(readFileSync(join(ocrDir, name), 'utf8'));
    const { pages } = receiptText([page]);
    writeFileSync(
      join(pagesDir, name),
      `${JSON.stringify({ pages, squared: page.squared ?? null }, null, 2)}\n`,
    );
  }
}
