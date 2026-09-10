#!/usr/bin/env node
/**
 * Fails when a new LOAD-TIME import cycle appears.
 *
 * ## What a cycle costs
 *
 * In a cycle, one module runs while another is half-initialized: its exports
 * are `undefined` at that moment. The symptom is not a build error but a
 * `undefined is not a function` at startup, on one platform, dependent on which
 * file the bundler happened to enter first — so it survives review and appears
 * after an unrelated import is added somewhere else.
 *
 * ## What counts
 *
 * Only edges that run at LOAD time:
 *
 *   - `import type` is skipped — TypeScript erases it, so no module is fetched.
 *     Writing a type-only import as a value import is what put 40 of the
 *     original 48 cycles here; `import type` is the fix and states the intent.
 *   - `await import(...)` is skipped — it runs after both modules are
 *     initialized, which is why `resetManager` already uses one to reach the
 *     Apollo client.
 *
 * ## The baseline
 *
 * NOT zero. The eight recorded cycles are the auth/link/store core: every link
 * that reads session state imports the store singleton, and the store's reset
 * path imports the links it has to stop. Breaking them means inverting that
 * dependency behind a registration seam — the one `store/sessionTeardown.ts`
 * already models — which is its own change against the app's most delicate
 * subsystem. The list may only shrink.
 *
 *   node scripts/check-import-cycles.mjs           # check
 *   node scripts/check-import-cycles.mjs --list    # print every cycle
 *   node scripts/check-import-cycles.mjs --update  # re-baseline
 *   node scripts/check-import-cycles.mjs --self-test
 */
import madge from 'madge';

import {
  baselineFile,
  diffSets,
  fromRoot,
  parseFlags,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-import-cycles.baseline.json'),
);

const MADGE_OPTIONS = {
  fileExtensions: ['ts', 'tsx'],
  tsConfig: 'tsconfig.json',
  detectiveOptions: {
    ts: { skipTypeImports: true, skipAsyncImports: true },
    tsx: { skipTypeImports: true, skipAsyncImports: true },
  },
};

/** `a > b > c` — the cycle's own order, which madge already normalizes. */
const render = cycle => cycle.join(' > ');

if (process.argv.includes('--self-test')) {
  // The scan is the thing worth proving: a misconfigured `detectiveOptions`
  // silently reports zero, which would pass forever.
  const graph = await madge('src', MADGE_OPTIONS);
  const modules = Object.keys(graph.obj());
  if (modules.length < 500) {
    console.error(
      `✗ Self-test failed: madge graphed only ${modules.length} modules; ` +
        'the scan is not reaching src/.',
    );
    process.exit(2);
  }
  const cyclic = graph.circular();
  if (!Array.isArray(cyclic)) {
    console.error('✗ Self-test failed: madge returned no cycle list.');
    process.exit(2);
  }
  console.log(
    `✓ Self-test passed: ${modules.length} modules graphed, cycle detection ` +
      `returned ${cyclic.length} entr(ies).`,
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const graph = await madge('src', MADGE_OPTIONS);

requireNonEmptyScan({
  count: Object.keys(graph.obj()).length,
  what: 'modules',
  check: 'check-import-cycles',
  hint: 'src/ moved, or madge resolved nothing',
  minimum: 500,
});

const current = graph.circular().map(render).sort();

if (flags.list) {
  for (const cycle of current) console.log(`  ${cycle}`);
  console.log(`\n${current.length} load-time cycle(s).`);
  process.exit(0);
}

if (flags.update) {
  BASELINE.write({ cycles: current });
  console.log(`Recorded ${current.length} load-time cycle(s).`);
  process.exit(0);
}

const baseline = BASELINE.require('check-import-cycles');
const { added, removed } = diffSets(current, baseline.cycles ?? []);

if (added.length) {
  console.error(
    `\n✗ check-import-cycles: ${added.length} new load-time cycle(s).\n`,
  );
  for (const cycle of added) console.error(`    ${cycle}`);
  console.error(
    `\n  In a cycle one module runs while another is half-initialized, so an\n` +
      `  export reads as undefined at startup — on one platform, depending on\n` +
      `  which file the bundler entered first.\n\n` +
      `  If the import is only a type, write \`import type\` and the edge is\n` +
      `  gone. If it is needed after both modules load, \`await import(...)\`.\n` +
      `  Otherwise invert the dependency behind a registration seam, as\n` +
      `  src/store/sessionTeardown.ts does.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-import-cycles: ${removed.length} baselined cycle(s) are gone.\n`,
  );
  for (const cycle of removed) console.error(`    ${cycle}`);
  console.error(
    `\n  Good — record it: node scripts/check-import-cycles.mjs --update\n`,
  );
  process.exit(1);
}

console.log(
  `check-import-cycles: ${current.length} load-time cycle(s), baseline ` +
    `${baseline.cycles?.length ?? 0}.`,
);
