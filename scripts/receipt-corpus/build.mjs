/**
 * Builds the receipt evaluation corpus (`__tests__/fixtures/receipts/corpus`):
 * each receipt photo is read, assembled, dated and redacted by the app's own
 * code, then labelled by Apple's on-device model, and only the redacted text is
 * kept. macOS 26+ with Apple Intelligence on.
 *
 *   node scripts/receipt-corpus/build.mjs [sources.json] [out-dir]
 *
 * The default sources are the Wikimedia Commons photos in `sources.json`,
 * downloaded and cached in the system temp dir. A private set (`"path"` in
 * place of `"file"`) builds the same way into an out-dir outside the repo.
 *
 * `ocr.swift` and `label.swift` copy the request settings, schema and prompt of
 * `ios/SousChef/TextRecognitionModule.swift` and `ReceiptStructuringModule.swift`;
 * change them together. `measure.mjs` scores the parser on what this writes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const UTILS = join(REPO, 'src/features/receipts/utils');
const sourcesPath = process.argv[2] ?? join(HERE, 'sources.json');
const outDir =
  process.argv[3] ?? join(REPO, '__tests__/fixtures/receipts/corpus');
const cache = join(tmpdir(), 'sous-chef-receipt-corpus');
for (const dir of ['images', 'ocr', 'pages', 'labels']) {
  mkdirSync(join(cache, dir), { recursive: true });
}
mkdirSync(outDir, { recursive: true });

const { assembleReceiptLines } = await import(
  `${UTILS}/assembleReceiptLines.ts`
);
const { readReceiptDate } = await import(`${UTILS}/receiptDate.ts`);
const { redactReceiptText } = await import(`${UTILS}/redactReceiptText.ts`);
const { linesThroughTotal } = await import(`${UTILS}/structureReceipt.ts`);

const run = (command, args) =>
  execFileSync(command, args, { stdio: 'inherit' });
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const sleep = ms => new Promise(done => setTimeout(done, ms));

const ocrBin = join(cache, 'ocr');
const labelBin = join(cache, 'label');
run('swiftc', ['-O', join(HERE, 'ocr.swift'), '-o', `${ocrBin}-bin`]);
run('swiftc', [
  '-O',
  '-parse-as-library',
  join(HERE, 'label.swift'),
  '-o',
  `${labelBin}-bin`,
]);

const sources = readJson(sourcesPath);
const imageOf = source => join(cache, 'images', `${source.id}.jpg`);

for (const source of sources) {
  const image = imageOf(source);
  if (source.path) {
    run('cp', [source.path, image]);
  } else if (!existsSync(image)) {
    const response = await download(source.file);
    writeFileSync(image, Buffer.from(await response.arrayBuffer()));
    // Two photos were taken sideways; the app's scanner straightens its pages.
    if (source.rotate) run('sips', ['-r', String(source.rotate), image]);
    await sleep(2000);
  }
}
run(`${ocrBin}-bin`, [join(cache, 'ocr'), ...sources.map(imageOf)]);

const pagesOf = new Map();
for (const source of sources) {
  const lines = assembleReceiptLines([
    readJson(join(cache, 'ocr', `${source.id}.json`)),
  ]);
  const pages = redactReceiptText(lines).map(page => page.join('\n'));
  pagesOf.set(source.id, {
    printedOn: printedOn(lines.map(page => page.join('\n'))),
    pages,
  });
  // What `parseReceiptOnDevice` sends the model.
  const sent = linesThroughTotal(pages.flatMap(page => page.split('\n')));
  writeFileSync(
    join(cache, 'pages', `${source.id}.json`),
    JSON.stringify({ id: source.id, pages: [sent.join('\n')] }),
  );
}
run(`${labelBin}-bin`, [
  join(cache, 'labels'),
  ...sources.map(source => join(cache, 'pages', `${source.id}.json`)),
]);

const os = execFileSync('sw_vers', ['-productVersion']).toString().trim();
const build = execFileSync('sw_vers', ['-buildVersion']).toString().trim();
const model = `Apple Foundation Models, macOS ${os} (${build}), greedy sampling`;

for (const source of sources) {
  const { printedOn: day, pages } = pagesOf.get(source.id);
  const labels = readJson(join(cache, 'labels', `${source.id}.json`));
  const onDevice = { model, seconds: Math.round(labels.seconds * 10) / 10 };
  if (labels.error) onDevice.error = labels.error;
  if (labels.storeName) onDevice.storeName = labels.storeName;
  onDevice.lines = (labels.lines ?? [])
    .sort((a, b) => a.line - b.line)
    .map(({ line, label, product }) =>
      product ? { line, label, product } : { line, label },
    );
  const entry = {
    id: source.id,
    group: source.group,
    source: source.file
      ? {
          page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
            source.file,
          )}`,
          license: source.license,
          author: source.author,
        }
      : { title: source.title, license: source.license },
    printedOn: day,
    pages,
    onDevice,
  };
  writeFileSync(
    join(outDir, `${source.id}.json`),
    `${JSON.stringify(entry, null, 2)}\n`,
  );

  console.log(
    `${source.id}: ${onDevice.error ?? `${onDevice.lines.length} labels`}`,
  );
}
console.log(
  'Measure the parser on it: node scripts/receipt-corpus/measure.mjs',
);

// Commons throttles a User-Agent without a contact link, and answers a burst
// with 429 and how long to wait.
async function download(file) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    file,
  )}`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'sous-chef-receipt-corpus/1.0 (https://github.com/muzhaqi16/sous-chef-rn)',
      },
    });
    if (response.ok) return response;
    if (response.status !== 429 || attempt === 5) {
      throw new Error(`${file}: HTTP ${response.status}`);
    }
    const wait = Number(response.headers.get('retry-after')) || attempt * 30;
    await sleep(wait * 1000);
  }
}

// The date reader keeps to the year before `today`, so an old photo is read
// against each year in turn; the first that finds a day is the receipt's.
function printedOn(pages) {
  for (let year = 1990; year <= new Date().getFullYear(); year++) {
    const day = readReceiptDate(pages, `${year}-12-31`);
    if (day) return day;
  }
  return null;
}
