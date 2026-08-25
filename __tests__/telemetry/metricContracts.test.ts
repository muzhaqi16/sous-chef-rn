/**
 * Every metric this app emits must have a documented contract, and every
 * documented contract must have an emitter.
 *
 * A metric's NAME is the only thing most readers ever see, and a wrong name is
 * not a cosmetic problem — it redirects work. `app_zustand_hydration_ms`
 * measured JS-bundle entry to the store's rehydrate callback, a window
 * dominated by module evaluation; the blob read + `JSON.parse` + rehydrate is
 * ~5 ms of it. On the strength of the name alone, a whole optimisation pass
 * went after that 5 ms (2026-08-25). The table row said "Zustand store
 * hydration time", which agreed with the name and confirmed the mistake.
 *
 * So the table is the contract, and this test makes it impossible to add a
 * metric without writing one, or to rename an emitter and leave the
 * documentation describing the old thing.
 *
 * The other direction matters too: a documented metric with no emitter is a
 * permanently-empty series, and an empty panel reads as "no problem" rather
 * than "not measured" — the same failure `noDevGatedMetrics.test.ts` guards
 * from the other side.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const CONTRACT_DOC = path.join(ROOT, 'docs', 'telemetry-setup.md');

/**
 * The three emit surfaces, all of which take the name as a string literal:
 *   - `Telemetry.*` — the app-facing façade;
 *   - `emitHistogram` — the fire-and-forget wrapper in `src/apollo/client.ts`,
 *     which takes the name as a parameter, so the `Telemetry.*` call inside it
 *     cannot be matched;
 *   - `this.incrementCounter` / `this.recordHistogram` — `TelemetryService`
 *     emitting its own metrics (`app_starts_total`, `screen_views_total`, …),
 *     which never go through the façade.
 */
const METRIC_CALL =
  /(?:Telemetry\.(?:histogram|increment|gauge|counter)|emitHistogram|this\.(?:incrementCounter|recordHistogram|setGauge))\(\s*\n?\s*['"]([a-z0-9_]+)['"]/g;

/**
 * Documented with no emit call at all. Keep this list empty if you can: a
 * documented metric nothing writes is a permanently-empty series, and an empty
 * panel reads as "no problem" rather than "not measured".
 */
const DOCUMENTED_WITHOUT_EMITTER = new Set<string>([]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function emittedMetrics(): Set<string> {
  const names = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const match of src.matchAll(METRIC_CALL)) names.add(match[1]);
  }
  return names;
}

/** Metric names in the `| \`name\` | labels | description |` contract tables. */
function documentedMetrics(): Set<string> {
  const doc = fs.readFileSync(CONTRACT_DOC, 'utf8');
  const names = new Set<string>();
  for (const match of doc.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)) {
    names.add(match[1]);
  }
  return names;
}

describe('metric contracts', () => {
  const emitted = emittedMetrics();
  const documented = documentedMetrics();

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
