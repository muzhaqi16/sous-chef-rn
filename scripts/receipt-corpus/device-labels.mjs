/**
 * Labels a corpus `build.mjs` wrote with the app's own ReceiptStructuringModule
 * on a phone or simulator, for the on-device evaluation (design.md § D6 of the
 * `on-device-receipt-recognition` change). It serves the lines
 * `parseReceiptOnDevice` sends, prints a snippet to run in the app's JS runtime
 * (React Native DevTools console, or argent `debugger-evaluate`), and writes
 * each answer to `<out-dir>/<id>.json` in the corpus's `onDevice` shape:
 *
 *   node scripts/receipt-corpus/device-labels.mjs <corpus-dir> <out-dir> "<model, device>"
 *
 * The phone must reach this Mac on PORT: `adb reverse tcp:8790 tcp:8790` on
 * Android; on an iPhone, put the Mac's address in the snippet's `url`.
 * `pipeline.mjs --labels <out-dir>` then matches what it labelled.
 */
import { createServer } from 'node:http';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { join } from 'node:path';

register('./resolveAppAliases.mjs', import.meta.url);

const PORT = 8790;
const [corpus, outDir, model] = process.argv.slice(2);
if (!corpus || !outDir || !model) {
  throw new Error(
    'usage: device-labels.mjs <corpus-dir> <out-dir> "<model, device>"',
  );
}
mkdirSync(outDir, { recursive: true });

const { linesThroughTotal } = await import(
  '../../src/features/receipts/utils/structureReceipt.ts'
);

const inputs = readdirSync(corpus)
  .filter(name => name.endsWith('.json'))
  .sort()
  .map(name => {
    const { id, pages } = JSON.parse(readFileSync(join(corpus, name), 'utf8'));
    return {
      id,
      lines: linesThroughTotal(pages.flatMap(page => page.split('\n'))),
    };
  });

const LABELS = new Set([
  'item',
  'itemDetail',
  'discount',
  'tax',
  'subtotal',
  'total',
  'payment',
  'header',
  'other',
]);
const trimmed = value =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

// Read as `src/native/ReceiptStructuring.ts` reads the module's answer.
const onDeviceShape = ({ ms, raw, error }) => {
  const entry = { model, seconds: Math.round(ms / 100) / 10 };
  if (error) return { ...entry, error, lines: [] };
  const storeName = trimmed(raw?.storeName);
  if (storeName) entry.storeName = storeName;
  entry.lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .filter(line => Number.isInteger(line?.line) && LABELS.has(line.kind))
    .map(({ line, kind, product }) =>
      trimmed(product)
        ? { line, label: kind, product: trimmed(product) }
        : { line, label: kind },
    )
    .sort((a, b) => a.line - b.line);
  return entry;
};

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/inputs') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(inputs));
    return;
  }
  if (request.method === 'POST' && request.url === '/result') {
    let body = '';
    request.on('data', chunk => (body += chunk));
    request.on('end', () => {
      const answer = JSON.parse(body);
      const entry = onDeviceShape(answer);
      writeFileSync(
        join(outDir, `${answer.id}.json`),
        `${JSON.stringify(entry, null, 2)}\n`,
      );
      console.log(
        `${answer.id}: ${entry.error ?? `${entry.lines.length} labels`} in ${
          entry.seconds
        }s`,
      );
      response.writeHead(204);
      response.end();
    });
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(PORT, () => {
  console.log(`Serving ${inputs.length} receipts. Run this in the app:\n`);
  console.log(`(async () => {
  const url = 'http://localhost:${PORT}';
  const module = globalThis.nativeModuleProxy.ReceiptStructuringModule;
  for (const { id, lines } of await (await fetch(url + '/inputs')).json()) {
    const started = Date.now();
    let answer;
    try {
      const raw = await module.labelLines(lines);
      answer = { id, ms: Date.now() - started, raw };
    } catch (error) {
      answer = { id, ms: Date.now() - started, error: String(error?.message ?? error) };
    }
    await fetch(url + '/result', { method: 'POST', body: JSON.stringify(answer) });
  }
})();\n`);
});
