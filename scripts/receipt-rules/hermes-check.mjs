/**
 * Runs the installed `@muzhaqi16/receipt-rules` corpus in the app's own Hermes,
 * before its version is pinned:
 *
 *   node scripts/receipt-rules/hermes-check.mjs [--port 8081] [--app dev.souschef.app] [--device <name>] [--corpus <dir>]
 *
 * The dev app must be connected to Metro with the receipt scan screen open:
 * the receipts feature's lazy bundle is what loads the package. Every text of
 * every corpus receipt is read in the app and in Node. It fails when a reading
 * under Hermes differs from Node's, or an accepted one departs from the
 * receipt as printed (`readingProblems`). `--corpus` reads another copy of
 * the corpus, to show an edited expectation fails it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readCorpusText, readingProblems } from '@muzhaqi16/receipt-rules';

const { values: args } = parseArgs({
  options: {
    port: { type: 'string', default: '8081' },
    app: { type: 'string', default: 'dev.souschef.app' },
    // Part of the device's name, when more than one is on Metro.
    device: { type: 'string' },
    corpus: { type: 'string' },
  },
});

const packageDir = join(
  dirname(fileURLToPath(import.meta.resolve('@muzhaqi16/receipt-rules'))),
  '..',
);
const { version } = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8'),
);
const corpusDir = args.corpus ?? join(packageDir, 'corpus');
const receipts = readdirSync(corpusDir)
  .filter(name => name.endsWith('.json'))
  .sort()
  .map(name => ({
    name: name.slice(0, -'.json'.length),
    receipt: JSON.parse(readFileSync(join(corpusDir, name), 'utf8')),
  }));
const texts = receipts.flatMap(({ name, receipt }) =>
  receipt.texts.map((text, at) => ({ name, reader: text.reader, receipt, at })),
);

const read = rules =>
  texts.map(({ receipt, at }) => {
    const reading = rules.readCorpusText(receipt, receipt.texts[at].pages);
    return {
      reading,
      problems: rules.readingProblems(reading, receipt.expected),
    };
  });

// Run in the app as source: it finds the package among the modules Metro has
// loaded, which only a dev bundle names.
const inApp = `(() => {
  const read = ${read.toString()};
  const texts = ${JSON.stringify(texts)};
  let rules = null;
  for (const [id, mod] of __r.getModules()) {
    if (mod.verboseName?.endsWith('@muzhaqi16/receipt-rules/build/index.js')) {
      rules = __r(id);
      break;
    }
  }
  if (!rules) return JSON.stringify({ missing: true });
  const engine = typeof HermesInternal === 'object'
    ? 'Hermes ' + (HermesInternal.getRuntimeProperties?.()['OSS Release Version'] ?? '')
    : 'not Hermes';
  return JSON.stringify({ engine, results: read(rules) });
})()`;

const target = async () => {
  const list = await fetch(`http://localhost:${args.port}/json/list`).then(
    response => response.json(),
  );
  const pages = list.filter(
    page =>
      page.webSocketDebuggerUrl &&
      page.appId === args.app &&
      (!args.device || (page.deviceName ?? '').includes(args.device)),
  );
  const page = pages.at(-1);
  if (!page) {
    throw new Error(
      `No ${args.app} on Metro at :${args.port}; it lists ${
        list.map(each => each.appId).join(', ') || 'nothing'
      }`,
    );
  }
  return page;
};

const evaluate = (url, expression) =>
  new Promise((resolve, reject) => {
    // Metro admits a debugger only from its own origin; undici's WebSocket
    // takes the header as an extension.
    const socket = new WebSocket(url, {
      headers: { Origin: `http://localhost:${args.port}` },
    });
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('The app did not answer within 60 s'));
    }, 60_000);
    socket.addEventListener('open', () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true },
        }),
      ),
    );
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      const { result, exceptionDetails } = message.result ?? {};
      if (exceptionDetails || message.error) {
        reject(new Error(JSON.stringify(exceptionDetails ?? message.error)));
      } else {
        resolve(result.value);
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error(`Could not connect to ${url}`));
    });
  });

// Key order aside, so only a difference in what was read counts.
const canonical = value =>
  JSON.stringify(value, (_key, held) =>
    held && typeof held === 'object' && !Array.isArray(held)
      ? Object.fromEntries(
          Object.entries(held).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : held,
  );

const page = await target();
console.log(
  `@muzhaqi16/receipt-rules ${version}: ${texts.length} texts of ${
    receipts.length
  } receipts, on ${page.deviceName ?? page.title}`,
);
const answer = JSON.parse(await evaluate(page.webSocketDebuggerUrl, inApp));
if (answer.missing) {
  console.error(
    'The package is not loaded in the app: open the receipt scan screen, then run this again.',
  );
  process.exit(1);
}
console.log(`In ${answer.engine}`);

const inNode = read({ readCorpusText, readingProblems });
const accepted = {};
const failures = [];
texts.forEach(({ name, reader }, at) => {
  const hermes = answer.results[at];
  const node = inNode[at];
  const label = `${name} (${reader})`;
  accepted[reader] ??= { accepted: 0, of: 0 };
  accepted[reader].of += 1;
  if (hermes.reading.accepted) accepted[reader].accepted += 1;
  if (canonical(hermes.reading) !== canonical(node.reading)) {
    failures.push(`${label}: Hermes reads it differently from Node`);
  }
  for (const problem of hermes.problems) failures.push(`${label}: ${problem}`);
});

for (const [reader, { accepted: count, of }] of Object.entries(accepted)) {
  console.log(`  ${reader}: ${count} of ${of} accepted`);
}
if (failures.length > 0) {
  console.error(`\nNot adoptable, ${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  '\nEvery reading under Hermes matches Node, and no accepted reading departs from its receipt.',
);
