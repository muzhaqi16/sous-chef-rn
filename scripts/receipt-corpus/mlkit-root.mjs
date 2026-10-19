/**
 * Lays out a `text-fidelity.mjs` root from ML Kit's recognised pages and the
 * API's receipt corpus, so Android's text is scored as Vision's is:
 *
 *   node --experimental-transform-types scripts/receipt-corpus/mlkit-root.mjs \
 *     <recognised.json> <api-corpus-dir> <root>
 *   node --experimental-transform-types scripts/receipt-corpus/text-fidelity.mjs <root> mlkit
 *
 * `recognised.json` is `{ results: [{ id, ms, pages }] }`, each `pages` what
 * `TextRecognitionModule.recognizeAndDelete` returned for one photo on a device.
 * The corpus is sous-chef-api's `tests/fixtures/receipts/corpus`. A photo is
 * matched to the corpus receipt whose device text it reads closest to, and the
 * match is printed so a wrong one shows. Writes <root>/gold/gold/<receipt>.json
 * (the receipt's expected items) and <root>/ocr-mlkit/<receipt>.json.
 *
 * The photos and what they read stay out of the repo: they are a household's
 * receipts.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const { receiptText } = await import(
  join(HERE, '../../src/features/receipts/utils/receiptText.ts')
);

const [recognisedPath, corpusDir, root] = process.argv.slice(2);
if (!recognisedPath || !corpusDir || !root) {
  console.error(
    'Usage: node --experimental-transform-types scripts/receipt-corpus/mlkit-root.mjs <recognised.json> <api-corpus-dir> <root>',
  );
  process.exit(1);
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// Shared letter pairs over all pairs: the receipts' headers tell them apart.
const HEAD = 600;
const pairsOf = text => {
  const counts = new Map();
  for (let at = 0; at < text.length - 1; at += 1) {
    const pair = text.slice(at, at + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
};
const likeness = (a, b) => {
  const left = pairsOf(a.slice(0, HEAD));
  const right = pairsOf(b.slice(0, HEAD));
  let shared = 0;
  for (const [pair, count] of left) {
    shared += Math.min(count, right.get(pair) ?? 0);
  }
  const total = [...left.values(), ...right.values()].reduce(
    (n, c) => n + c,
    0,
  );
  return total === 0 ? 0 : (2 * shared) / total;
};

const corpus = readdirSync(corpusDir)
  .filter(name => name.endsWith('.json'))
  .map(name => ({
    name: name.slice(0, -5),
    entry: readJson(join(corpusDir, name)),
  }))
  .flatMap(({ name, entry }) => {
    const device = entry.texts?.find(text => text.reader === 'device');
    return device ? [{ name, entry, text: device.pages.join('\n') }] : [];
  });

mkdirSync(join(root, 'gold/gold'), { recursive: true });
mkdirSync(join(root, 'ocr-mlkit'), { recursive: true });

for (const { id, pages } of readJson(recognisedPath).results) {
  const text = receiptText(pages).pages.join('\n');
  const [best] = corpus
    .map(receipt => ({ ...receipt, score: likeness(text, receipt.text) }))
    .sort((a, b) => b.score - a.score);
  if (!best) continue;
  const [page] = pages;
  // The answer key's own rows are not in the corpus: an item spans its row.
  const lines = (best.entry.expected?.lines ?? []).map(line => ({
    ...line,
    rows: [line.product ?? ''],
  }));
  writeFileSync(
    join(root, 'gold/gold', `${best.name}.json`),
    JSON.stringify({ id: best.name, lines }),
  );
  writeFileSync(
    join(root, 'ocr-mlkit', `${best.name}.json`),
    JSON.stringify(page),
  );
  console.log(`${id} -> ${best.name} (${best.score.toFixed(2)})`);
}
