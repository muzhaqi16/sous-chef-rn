/**
 * Scores the phone's receipt text against the answer key, stage by stage
 * (design D6 of the `receipt-photo-first` change). For each answer-key ITEM it
 * asks whether the item is whole, meaning its name and then its printed amount
 * are on one line, at each stage:
 *   1. raw: what Vision returned, before assembly. Recognition returns columns
 *      apart, so this stage asks only whether the name and the amount were read
 *      at all;
 *   2. assembled: `assembleReceiptLines`;
 *   3. redacted: `redactReceiptText`;
 *   4. pages: the 10-page cap, which is what the app keeps and sends.
 * An item not whole in the pages is put down to the first stage that lost or
 * broke it. Figures split around their decimal point (`. 73`) or read with `+`
 * are counted, along with whether joining them would make the item whole.
 *
 *   node --experimental-transform-types scripts/receipt-corpus/text-fidelity.mjs \
 *     [corpus-root] [raw|squared|both] [--verbose]
 *
 * Reads <root>/gold/gold/*.json (the API's answer key) and <root>/ocr/ or
 * <root>/ocr-squared/ (ocr-variants.mjs). Writes <root>/text-fidelity/.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { register } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const UTILS = join(HERE, '../../src/features/receipts/utils');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const [rootArg, variantArg] = args.filter(arg => !arg.startsWith('--'));
const root = rootArg ?? join(homedir(), 'Desktop/muzhaqi16/receipt-corpus');
const variants =
  !variantArg || variantArg === 'both' ? ['raw', 'squared'] : [variantArg];
const outDir = join(root, 'text-fidelity');
mkdirSync(outDir, { recursive: true });

const { assembleReceiptLines } = await import(
  `${UTILS}/assembleReceiptLines.ts`
);
const { redactReceiptText } = await import(`${UTILS}/redactReceiptText.ts`);
const { capPages } = await import(`${UTILS}/capPages.ts`);
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// Letters OCR confuses, folded alike on both sides: digits read for letters,
// and Cyrillic or Greek letters read for Latin ones.
const LOOKALIKES = {
  0: 'o',
  1: 'l',
  5: 's',
  8: 'b',
  а: 'a',
  в: 'b',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  α: 'a',
  β: 'b',
  ε: 'e',
  κ: 'k',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ν: 'v',
};
const fold = text =>
  [...text.toLowerCase()]
    .map(c => LOOKALIKES[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]/g, '');

function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b && a !== '' ? 1 : 0;
  const grams = s => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i += 1)
      m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const A = grams(a);
  const B = grams(b);
  let both = 0;
  for (const [g, n] of A) both += Math.min(n, B.get(g) ?? 0);
  return (2 * both) / (a.length - 1 + b.length - 1);
}

// The bar a span must reach: short names must match nearly exactly.
const barFor = name => (name.length <= 2 ? 1 : name.length <= 5 ? 0.8 : 0.6);

/** Where the gold name sits in a line: the best token span, and the offset after it. */
function nameIn(line, name) {
  const want = fold(name);
  if (want === '') return null;
  const tokens = [...line.matchAll(/\S+/g)].map(m => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
  const most = name.split(/\s+/).length + 2;
  let best = null;
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i; j < Math.min(tokens.length, i + most); j += 1) {
      const span = fold(line.slice(tokens[i].start, tokens[j].end));
      const score = span === want ? 1 : dice(want, span);
      if (!best || score > best.score) best = { score, end: tokens[j].end };
    }
  }
  return best && best.score >= barFor(want) ? best : null;
}

const cents = value => Math.round(value * 100);
const valueOf = (whole, fraction) => Number(`${whole || '0'}.${fraction}`);
// A figure as printed: `4.94`, `.9999`, `$8,25`.
const CLEAN = /(?<![\d.,])\$?(\d{1,6})?[.,](\d{2,4})(?![\d])/g;
// The same figure broken after its decimal mark (`. 73`, `, 9999`), or with `+`
// read for it (`+44`). A space BEFORE the mark is two printed figures, not one:
// `1  . 9999` is a count and a price (99 Cents Only), `18  . 73` a size and a price.
const SPLIT = /(?<![\d.,])(\d{1,6})?[.,]\s+(\d{2,4})(?![\d])/g;
const PLUS = /(?<![\d])(\d{0,6})\+(\d{2})(?![\d])/g;

function figuresIn(line, from = 0) {
  const found = [];
  for (const [re, kind] of [
    [CLEAN, 'clean'],
    [SPLIT, 'split'],
    [PLUS, 'plus'],
  ]) {
    re.lastIndex = 0;
    for (const m of line.matchAll(re)) {
      if (m.index < from) continue;
      found.push({ kind, cents: cents(valueOf(m[1], m[2])), at: m.index });
    }
  }
  return found;
}

const hasAmount = (line, amount, from = 0, kinds = ['clean']) =>
  amount === null ||
  figuresIn(line, from).some(
    f => kinds.includes(f.kind) && f.cents === cents(amount),
  );

// How many printed rows past its name an item's amount may sit: the key's own
// span (Walmart prints a weighed item's price on the weight row below it).
const spanOf = item => Math.max(0, item.rows.length - 1);

/** The first unused line holding the item whole; `kinds` the figure forms that count. */
function wholeAt(lines, item, used, kinds = ['clean']) {
  for (let at = 0; at < lines.length; at += 1) {
    if (used.has(at)) continue;
    const name = nameIn(lines[at], item.product);
    if (!name) continue;
    if (hasAmount(lines[at], item.amount, name.end, kinds)) return at;
    for (
      let next = 1;
      next <= spanOf(item) && at + next < lines.length;
      next += 1
    ) {
      if (hasAmount(lines[at + next], item.amount, 0, kinds)) return at;
    }
  }
  return -1;
}

const anyName = (lines, item) => lines.some(line => nameIn(line, item.product));

/**
 * Whether recognition read the item's amount near its name: within two line
 * heights of a recognised name (a tilted photo lifts the price column by up to
 * a row), and further down by the key's row span. A price printed elsewhere on
 * the receipt (`. 89` twice) does not count.
 */
function rawAmountNear(observations, item, kinds) {
  if (item.amount === null) return true;
  const centre = o => o.y + o.height / 2;
  return observations
    .filter(o => nameIn(o.text, item.product))
    .some(name => {
      const reach = name.height * (2 + 1.5 * spanOf(item));
      return observations.some(
        o =>
          Math.abs(centre(o) - centre(name)) <= reach &&
          hasAmount(
            o.text,
            item.amount,
            o === name ? nameIn(o.text, item.product)?.end ?? 0 : 0,
            kinds,
          ),
      );
    });
}

function defectsIn(lines) {
  const count = { split: 0, plus: 0, comma: 0 };
  for (const line of lines) {
    count.split += [...line.matchAll(SPLIT)].length;
    count.plus += [...line.matchAll(PLUS)].length;
    count.comma += [
      ...line.matchAll(/(?<![\d.,])\$?\d{0,6},\d{2}(?![\d])/g),
    ].length;
  }
  return count;
}

function scoreReceipt(gold, ocr) {
  const raw = ocr.lines.map(line => line.text);
  const assembled = assembleReceiptLines([ocr]);
  const redacted = redactReceiptText(assembled);
  const stages = {
    raw,
    assembled: assembled.flat(),
    redacted: redacted.flat(),
    pages: capPages(redacted.map(page => page.join('\n'))).flatMap(page =>
      page.split('\n'),
    ),
  };
  const items = gold.lines.filter(line => line.kind === 'ITEM' && line.product);
  const usedBy = {
    assembled: new Set(),
    redacted: new Set(),
    pages: new Set(),
    joined: new Set(),
  };
  const rows = [];
  let lastLine = -1;
  let reordered = 0;
  for (const item of items) {
    const result = {
      product: item.product,
      amount: item.amount,
      goldLost: item.rows.length === 0,
    };
    result.rawName = anyName(raw, item);
    result.rawAmount = rawAmountNear(ocr.lines, item, ['clean']);
    result.rawAmountSplit =
      !result.rawAmount && rawAmountNear(ocr.lines, item, ['split', 'plus']);
    result.recognised =
      result.rawName && (result.rawAmount || result.rawAmountSplit);
    for (const stage of ['assembled', 'redacted', 'pages']) {
      const at = wholeAt(stages[stage], item, usedBy[stage]);
      if (at >= 0) usedBy[stage].add(at);
      result[stage] = at >= 0;
      if (stage === 'pages' && at >= 0) {
        if (at < lastLine) reordered += 1;
        lastLine = at;
      }
    }
    const joinedAt = wholeAt(stages.pages, item, usedBy.joined, [
      'clean',
      'split',
      'plus',
    ]);
    if (joinedAt >= 0) usedBy.joined.add(joinedAt);
    result.wholeIfJoined = joinedAt >= 0;
    if (!result.pages) {
      if (!result.rawName)
        result.lostAt =
          result.rawAmount || result.rawAmountSplit
            ? 'recognition: name'
            : 'recognition: name and amount';
      else if (!result.rawAmount && !result.rawAmountSplit)
        result.lostAt = 'recognition: amount';
      else if (result.wholeIfJoined)
        result.lostAt = result.rawAmountSplit
          ? 'figure split in recognition'
          : 'figure split in assembly';
      else if (!result.assembled) {
        const nameRow = stages.assembled.some(line =>
          nameIn(line, item.product),
        );
        result.lostAt = nameRow
          ? "assembly: amount not on the name's row"
          : 'assembly: name lost';
      } else if (!result.redacted) result.lostAt = 'redaction';
      else result.lostAt = 'page cap';
    }
    rows.push(result);
  }
  return {
    id: gold.id,
    squared: ocr.squared ?? null,
    items: rows.length,
    recognised: rows.filter(r => r.recognised).length,
    assembled: rows.filter(r => r.assembled).length,
    redacted: rows.filter(r => r.redacted).length,
    pages: rows.filter(r => r.pages).length,
    wholeIfJoined: rows.filter(r => r.wholeIfJoined).length,
    goldLost: rows.filter(r => r.goldLost).length,
    reordered,
    defects: { raw: defectsIn(stages.raw), pages: defectsIn(stages.pages) },
    lost: rows
      .filter(r => !r.pages)
      .map(r => ({
        product: r.product,
        amount: r.amount,
        at: r.lostAt,
        goldLost: r.goldLost,
      })),
  };
}

const sum = (list, key) => list.reduce((total, r) => total + r[key], 0);
const pct = (a, b) => `${a}/${b} (${b ? Math.round((100 * a) / b) : 0}%)`;
const results = {};
for (const variant of variants) {
  const ocrDir = join(root, variant === 'raw' ? 'ocr' : 'ocr-squared');
  const receipts = [];
  for (const file of readdirSync(join(root, 'gold/gold'))
    .filter(f => f.endsWith('.json'))
    .sort()) {
    if (!existsSync(join(ocrDir, file))) continue;
    receipts.push(
      scoreReceipt(
        readJson(join(root, 'gold/gold', file)),
        readJson(join(ocrDir, file)),
      ),
    );
  }
  const byStage = {};
  for (const r of receipts)
    for (const l of r.lost) byStage[l.at] = (byStage[l.at] ?? 0) + 1;
  const defects = {
    raw: { split: 0, plus: 0, comma: 0 },
    pages: { split: 0, plus: 0, comma: 0 },
  };
  for (const r of receipts)
    for (const s of ['raw', 'pages'])
      for (const k of Object.keys(defects[s])) defects[s][k] += r.defects[s][k];
  const totals = {
    receipts: receipts.length,
    items: sum(receipts, 'items'),
    recognised: sum(receipts, 'recognised'),
    assembled: sum(receipts, 'assembled'),
    redacted: sum(receipts, 'redacted'),
    pages: sum(receipts, 'pages'),
    wholeIfJoined: sum(receipts, 'wholeIfJoined'),
    reordered: sum(receipts, 'reordered'),
    lostByStage: byStage,
    defects,
  };
  results[variant] = { totals, receipts };
  writeFileSync(
    join(outDir, `${variant}.json`),
    `${JSON.stringify(results[variant], null, 2)}\n`,
  );

  const md = [
    `# Text fidelity: ${variant} (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Items: ${totals.items} answer-key ITEMs across ${totals.receipts} receipts.`,
    '',
    '| Stage | Items whole |',
    '| --- | --- |',
    `| 1. recognised (name and amount read) | ${pct(
      totals.recognised,
      totals.items,
    )} |`,
    `| 2. assembled | ${pct(totals.assembled, totals.items)} |`,
    `| 3. redacted | ${pct(totals.redacted, totals.items)} |`,
    `| 4. pages (sent) | ${pct(totals.pages, totals.items)} |`,
    `| 4 with split figures joined | ${pct(
      totals.wholeIfJoined,
      totals.items,
    )} |`,
    '',
    `Rows out of printed order in the pages: ${totals.reordered}.`,
    '',
    '| Lost or broken at | Items |',
    '| --- | --- |',
    ...Object.entries(byStage)
      .sort((a, b) => b[1] - a[1])
      .map(([at, n]) => `| ${at} | ${n} |`),
    '',
    `Figure defects (raw → pages): split ${defects.raw.split} → ${defects.pages.split}, \`+\` ${defects.raw.plus} → ${defects.pages.plus}, comma decimal ${defects.raw.comma} → ${defects.pages.comma}.`,
    '',
    '| Receipt | Items | Recognised | Assembled | Redacted | Pages | Joined | Lost (top stage) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...receipts.map(r => {
      const top = {};
      for (const l of r.lost) top[l.at] = (top[l.at] ?? 0) + 1;
      const where = Object.entries(top)
        .sort((a, b) => b[1] - a[1])
        .map(([at, n]) => `${at} ${n}`)
        .join('; ');
      return `| ${r.id} | ${r.items} | ${r.recognised} | ${r.assembled} | ${r.redacted} | ${r.pages} | ${r.wholeIfJoined} | ${where} |`;
    }),
  ];
  if (VERBOSE) {
    md.push('', '## Lost items', '');
    for (const r of receipts)
      for (const l of r.lost)
        md.push(
          `- ${r.id}: ${l.product} ${l.amount ?? ''} — ${l.at}${
            l.goldLost ? ' (key: OCR lost it)' : ''
          }`,
        );
  }
  writeFileSync(join(outDir, `${variant}.md`), `${md.join('\n')}\n`);
  console.log(
    `${variant}: recognised ${pct(
      totals.recognised,
      totals.items,
    )}, assembled ${pct(totals.assembled, totals.items)}, redacted ${pct(
      totals.redacted,
      totals.items,
    )}, pages ${pct(totals.pages, totals.items)}, joined ${pct(
      totals.wholeIfJoined,
      totals.items,
    )}`,
  );
}
