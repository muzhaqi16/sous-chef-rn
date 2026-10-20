/**
 * Scores the app's receipt parser on a corpus `build.mjs` wrote (its default
 * out-dir unless given): the stored text and on-device
 * labels, without the model: run it before and after a parser change and put
 * both in the PR (design.md § D8 of the `receipt-scanning` change).
 *
 *   node scripts/receipt-corpus/measure.mjs [corpus-dir]
 *
 * No receipt is hand-labelled, so a reading counts when the rules' check
 * accepts it (`checkOnPhone`, the app's own): its lines, as printed, meet a
 * subtotal or total the receipt prints.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const UTILS = join(REPO, 'src/features/receipts/utils');
const corpus =
  process.argv[2] ?? join(tmpdir(), 'sous-chef-receipt-corpus', 'corpus');

const { linesThroughTotal, structureReceipt } = await import(
  `${UTILS}/structureReceipt.ts`
);
const { receiptReviewLines } = await import(`${UTILS}/receiptReviewLines.ts`);
const { checkOnPhone } = await import(`${UTILS}/phoneReading.ts`);

const totals = { receipts: 0, accepted: 0, items: 0, priced: 0 };

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
  const checked = checkOnPhone(parsed, receipt.pages);
  const gap = checked?.totalsGap;

  totals.accepted += checked?.accepted ? 1 : 0;
  totals.items += review.length;
  totals.priced += priced;
  console.log(
    [
      name,
      checked?.accepted ? 'accepted' : 'refused ',
      `items ${String(review.length).padStart(2)}`,
      `priced ${String(priced).padStart(2)}`,
      gap ? `counted ${gap.counted} vs ${gap.printed}` : '',
    ].join('  '),
  );
}

console.log(
  `\n${totals.receipts} receipts: ${totals.accepted} accepted; ` +
    `${totals.priced} of ${totals.items} items priced`,
);
