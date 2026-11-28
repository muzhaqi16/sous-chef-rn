/**
 * Every metric this app emits must have a documented contract, and every
 * documented contract must have an emitter.
 *
 * A metric's NAME is the only thing most readers ever see, and a name that
 * promises a narrower window than it measures sends optimisation work after
 * the wrong part of it. So the table is the contract, and this test makes it
 * impossible to add a metric without writing one, or to rename an emitter and
 * leave the documentation describing the old thing.
 *
 * The other direction matters too: a documented metric with no emitter is a
 * permanently-empty series, and an empty panel reads as "no problem" rather
 * than "not measured" — the same failure `noDevGatedMetrics.test.ts` guards
 * from the other side.
 */
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import {
  calleeName,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_DOC = path.join(ROOT, 'docs', 'telemetry-setup.md');

/** Every emitter a metric name passes through, by how it is called. */
const EMITTERS = new Set([
  'Telemetry.histogram',
  'Telemetry.increment',
  'Telemetry.gauge',
  'Telemetry.counter',
  'emitHistogram',
  'this.incrementCounter',
  'this.recordHistogram',
  'this.setGauge',
]);

/**
 * Documented with no emit call at all. Keep this list empty if you can: a
 * documented metric nothing writes is a permanently-empty series, and an empty
 * panel reads as "no problem" rather than "not measured".
 */
const DOCUMENTED_WITHOUT_EMITTER = new Set<string>([]);

/** The metric names a file emits: each emitter call's first argument. */
function emittedIn(file: string, text?: string): string[] {
  return nodesOf(parseSource(file, text))
    .filter(ts.isCallExpression)
    .filter(call => EMITTERS.has(calleeName(call) ?? ''))
    .map(call => call.arguments[0])
    .filter(
      (name): name is ts.StringLiteral => !!name && ts.isStringLiteral(name),
    )
    .map(name => name.text);
}

function emittedMetrics(): Set<string> {
  return new Set(productionSources().flatMap(file => emittedIn(file)));
}

/** Metric names in the `| \`name\` | labels | description |` contract tables. */
function documentedMetrics(): Set<string> {
  const doc = fs.readFileSync(CONTRACT_DOC, 'utf8');
  const names = new Set<string>();
  for (const match of doc.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)) {
    names.add(match[1]!);
  }
  return names;
}

describe('metric contracts', () => {
  const emitted = emittedMetrics();
  const documented = documentedMetrics();

  it('reads a metric name past a comment in the call', () => {
    expect(
      emittedIn(
        'planted.ts',
        `Telemetry.increment(\n  // a hit means the page came from the cache\n  'cache_hits',\n);`,
      ),
    ).toEqual(['cache_hits']);
  });

  it('finds the emitters and the contract tables', () => {
    expect(emitted.size).toBeGreaterThan(20);
    expect(documented.size).toBeGreaterThan(20);
  });

  it('documents every metric the app emits', () => {
    const undocumented = [...emitted].filter(n => !documented.has(n)).sort();
    expect(undocumented).toEqual([]);
  });

  it('emits every metric the contract table documents', () => {
    const orphaned = [...documented]
      .filter(n => !emitted.has(n) && !DOCUMENTED_WITHOUT_EMITTER.has(n))
      .sort();
    expect(orphaned).toEqual([]);
  });
});
