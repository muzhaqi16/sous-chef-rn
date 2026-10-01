/**
 * Scores the app's receipt parser on the corpus's stored text and on-device
 * labels, without the model: run it before and after a parser change and put
 * both in the PR (design.md § D8 of the `receipt-scanning` change).
 *
 *   node scripts/receipt-corpus/measure.mjs [corpus-dir]
 *
 * No receipt is hand-labelled, so a receipt "adds up" when its items, after
 * their discounts, come to the printed subtotal: the proxy for every item being
 * found and priced.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const UTILS = join(REPO, 'src/features/receipts/utils');
const corpus =
  process.argv[2] ?? join(REPO, '__tests__/fixtures/receipts/corpus');

const { isUsableReceipt, linesThroughTotal, structureReceipt } = await import(
  `${UTILS}/structureReceipt.ts`
);
const { receiptReviewLines } = await import(`${UTILS}/receiptReviewLines.ts`);
const { receiptTotalsGap } = await import(`${UTILS}/receiptTotalsGap.ts`);

const totals = { receipts: 0, usable: 0, addsUp: 0, items: 0, priced: 0 };

for (const file of readdirSync(corpus).filter(name => name.endsWith('.json'))) {
  const receipt = JSON.parse(readFileSync(join(corpus, file), 'utf8'));
  const name = receipt.id.slice(0, 44).padEnd(44);
  totals.receipts++;
  if (receipt.onDevice.error) {
    console.log(`${name}  ${receipt.onDevice.error}`);
    continue;
  }
  const lines = linesThroughTotal(
    receipt.pages.flatMap(page => page.split('\n')),
  );
  const parsed = structureReceipt(lines, receipt.onDevice);
  const review = receiptReviewLines(parsed);
  const priced = review.filter(line => line.price !== undefined).length;
  const gap = receiptTotalsGap(parsed);
  const printsTotal = parsed.lines.some(
    line =>
      (line.kind === 'subtotal' || line.kind === 'total') && line.lineTotal,
  );
  const usable = isUsableReceipt(parsed, receipt.onDevice);

  totals.usable += usable ? 1 : 0;
  totals.addsUp += usable && printsTotal && !gap ? 1 : 0;
  totals.items += review.length;
  totals.priced += priced;
  console.log(
    [
      name,
      usable ? 'usable  ' : 'dropped ',
      `items ${String(review.length).padStart(2)}`,
      `priced ${String(priced).padStart(2)}`,
      gap
        ? `counted ${gap.counted} vs ${gap.printed}`
        : printsTotal
        ? 'adds up'
        : 'no total read',
    ].join('  '),
  );
}

console.log(
  `\n${totals.receipts} receipts: ${totals.usable} usable, ${totals.addsUp} add up; ` +
    `${totals.priced} of ${totals.items} items priced`,
);
