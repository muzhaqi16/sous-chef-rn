#!/usr/bin/env node
/**
 * Merges the coverage CI's test jobs wrote, one `coverage-final.json` each
 * (the unit shards and the whole-tree suites), and holds the merge to
 * `jest.config.js`'s global `coverageThreshold`, as one unsharded run did.
 * Writes the merged lcov Codecov reads.
 *
 *   node scripts/merge-coverage.mjs <dir of coverage-final.json files> [out dir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const require = createRequire(import.meta.url);
const { coverageThreshold } = require('../jest.config.js');

const [partsDir, outDir = 'coverage'] = process.argv.slice(2);
if (!partsDir) {
  console.error('Usage: merge-coverage.mjs <parts dir> [out dir]');
  process.exit(2);
}

/** Every coverage-final.json under the folder, as an artifact download nests them. */
function findParts(dir) {
  return readdirSync(dir).flatMap(name => {
    const entry = path.join(dir, name);
    if (statSync(entry).isDirectory()) return findParts(entry);
    return name === 'coverage-final.json' ? [entry] : [];
  });
}

const parts = findParts(partsDir);
if (parts.length === 0) {
  console.error(`No coverage-final.json under ${partsDir}.`);
  process.exit(1);
}

const copies = new Map();
for (const part of parts) {
  for (const [file, coverage] of Object.entries(
    JSON.parse(readFileSync(part, 'utf8')),
  )) {
    copies.set(file, [...(copies.get(file) ?? []), coverage]);
  }
}

// Merging two copies of a file folds entries at one location into one, while
// Jest adds a file no test loaded as it is. So only the copies a test ran are
// merged, else one unrun copy is taken whole: the totals one run would count.
const ran = coverage => Object.values(coverage.s).some(hits => hits > 0);
const map = libCoverage.createCoverageMap({});
for (const versions of copies.values()) {
  const run = versions.filter(ran);
  for (const coverage of run.length > 0 ? run : versions.slice(0, 1)) {
    map.addFileCoverage(coverage);
  }
}

const context = libReport.createContext({ dir: outDir, coverageMap: map });
reports.create('lcovonly').execute(context);
reports.create('text-summary').execute(context);

// Jest's meaning: a positive threshold is a minimum percentage, a negative one
// the most entries left uncovered.
const summary = map.getCoverageSummary();
const failures = Object.entries(coverageThreshold.global).flatMap(
  ([metric, threshold]) => {
    const { pct, total, covered } = summary[metric];
    if (threshold >= 0 && pct < threshold) {
      return [`${metric}: ${pct}% is below the ${threshold}% minimum`];
    }
    if (threshold < 0 && total - covered > -threshold) {
      return [`${metric}: ${total - covered} uncovered, ${-threshold} allowed`];
    }
    return [];
  },
);

console.log(`Merged ${parts.length} coverage reports from ${partsDir}.`);
if (failures.length > 0) {
  console.error(
    `Global coverage threshold not met:\n  ${failures.join('\n  ')}`,
  );
  process.exit(1);
}
