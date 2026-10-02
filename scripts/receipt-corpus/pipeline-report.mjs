/**
 * The D8 metrics (design.md § D8 of the `receipt-scanning` change) from what
 * `pipeline.mjs` wrote and a hand judgement of each review line:
 *
 *   node scripts/receipt-corpus/pipeline-report.mjs <corpus-dir> <judgements.json>
 *
 * For a device run, pass the `--labels` dir: its receipts are split by the
 * parser that read them (design.md § D6 of `on-device-receipt-recognition`).
 *
 * `judgements.json` maps a receipt id to one entry per review line, in order:
 * `{ "product": false }` for a line that is not a bought product (a total,
 * a fee, a header), else `{ "product": true, "best": true | false }` — whether
 * the API's best match is the product the line names.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [corpus, judgementsPath] = process.argv.slice(2);
if (!corpus || !judgementsPath) {
  throw new Error(
    'usage: pipeline-report.mjs <corpus-dir | labels-dir> <judgements.json>',
  );
}
const judgements = JSON.parse(readFileSync(judgementsPath, 'utf8'));
const dir = join(corpus, 'pipeline');
const SURE = new Set(['HIGH', 'MEDIUM']);

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const pct = (part, whole) =>
  whole ? `${((100 * part) / whole).toFixed(1)}%` : 'n/a';

const t = {
  receipts: 0,
  parsed: 0,
  leaks: 0,
  products: 0,
  correctNoEdit: 0,
  wrongPreselect: 0,
  guessRight: 0,
  nonItemLines: 0,
  nonItemInReview: 0,
};
const resolveMs = [];
// D8 is about grocery chains; the Commons set also holds other shops.
const byGroup = {};
const byParser = {};

for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
  const result = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  t.receipts++;
  t.leaks += result.leaks.length;
  if (result.parse.status !== 'PARSED' || !result.items) {
    console.log(`${result.id.padEnd(44)}  ${result.parse.status}`);
    continue;
  }
  t.parsed++;
  resolveMs.push(result.resolveMs);

  const judged = judgements[result.id] ?? [];
  if (judged.length !== result.items.length) {
    throw new Error(
      `${result.id}: ${judged.length} judgements for ${result.items.length} lines`,
    );
  }
  let products = 0;
  let correct = 0;
  result.items.forEach((item, at) => {
    const judgement = judged[at];
    if (!judgement.product) {
      t.nonItemInReview++;
      return;
    }
    products++;
    const sure = SURE.has(item.confidence) && item.best;
    if (sure && judgement.best) correct++;
    else if (sure) t.wrongPreselect++;
    else if (item.best && judgement.best) t.guessRight++;
  });
  t.products += products;
  t.correctNoEdit += correct;
  const group = (byGroup[result.group] ??= { products: 0, correct: 0 });
  group.products += products;
  group.correct += correct;
  // A result from before `parse.by` was recorded is the server's.
  const parser = (byParser[result.parse.by ?? 'SERVER'] ??= {
    receipts: 0,
    products: 0,
    correct: 0,
    ms: [],
  });
  parser.receipts++;
  parser.products += products;
  parser.correct += correct;
  parser.ms.push(result.parse.ms);
  const kinds = result.parse.kinds ?? {};
  t.nonItemLines +=
    Object.entries(kinds)
      .filter(([kind]) => kind !== 'ITEM')
      .reduce((sum, [, count]) => sum + count, 0) +
    result.items.filter((_, at) => !judged[at].product).length;
  console.log(
    [
      result.id.slice(0, 44).padEnd(44),
      `products ${String(products).padStart(2)}`,
      `right ${String(correct).padStart(2)}`,
      `parse ${Math.round(result.parse.ms / 1000)}s`,
      (result.parse.by ?? 'SERVER').toLowerCase(),
    ].join('  '),
  );
}

console.log(`
${t.receipts} receipts, ${t.parsed} parsed
Item lines matched correctly with no edit: ${t.correctNoEdit}/${
  t.products
} (${pct(t.correctNoEdit, t.products)})
  preselected but wrong (needs an edit):  ${t.wrongPreselect}
  a guess that was right (one tap):        ${t.guessRight}
${Object.entries(byGroup)
  .map(
    ([group, { products, correct }]) =>
      `  ${group.padEnd(38)}  ${correct}/${products} (${pct(
        correct,
        products,
      )})`,
  )
  .join('\n')}
Non-item lines kept out of the review:     ${
  t.nonItemLines - t.nonItemInReview
}/${t.nonItemLines} (${pct(t.nonItemLines - t.nonItemInReview, t.nonItemLines)})
Payment fields leaked:                     ${t.leaks}
${Object.entries(byParser)
  .map(
    ([by, { receipts, products, correct, ms }]) =>
      `Parsed by ${by.padEnd(
        6,
      )}  ${receipts} receipts, ${correct}/${products} (${pct(
        correct,
        products,
      )}) right with no edit; median parse ${(median(ms) / 1000).toFixed(1)} s`,
  )
  .join('\n')}
Median match: ${(median(resolveMs) / 1000).toFixed(1)} s`);
