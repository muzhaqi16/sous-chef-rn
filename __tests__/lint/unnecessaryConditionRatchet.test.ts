import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

/**
 * `.eslintrc.js` turns `no-unnecessary-condition` OFF for the files in the
 * exclusion list, so lint cannot see one of them getting worse. This lints
 * them with the rule forced on and holds each at its recorded count: a file
 * that gains a finding fails here, and one that loses a finding must record
 * it, so the list only shrinks. A file at zero leaves both lists.
 */
const ROOT = path.join(__dirname, '..', '..');
const RULE = '@typescript-eslint/no-unnecessary-condition';

const exclusions = require('../../scripts/no-unnecessary-condition.exclusions.json') as string[];
const baseline = require('../../scripts/no-unnecessary-condition.baseline.json') as Record<
  string,
  number
>;

jest.setTimeout(180_000);

interface LintResult {
  filePath: string;
  messages: Array<{ ruleId: string | null }>;
}

/** Per-file finding counts, from the CLI so ESLint never loads in-process. */
function lintCounts(): Record<string, number> {
  const args = [
    '--max-old-space-size=6144',
    'node_modules/eslint/bin/eslint.js',
    '--no-eslintrc',
    '-c',
    '.eslintrc.js',
    '--rule',
    `${RULE}: error`,
    '-f',
    'json',
    ...exclusions,
  ];
  let stdout = '';
  try {
    stdout = execFileSync('node', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // ESLint exits 1 when it reports anything, which is the normal case here.
    stdout = (error as { stdout?: string }).stdout ?? '';
  }
  const counts: Record<string, number> = {};
  for (const result of JSON.parse(stdout) as LintResult[]) {
    const rel = path.relative(ROOT, result.filePath);
    const n = result.messages.filter(m => m.ruleId === RULE).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('no-unnecessary-condition exclusions only shrink', () => {
  it('records every excluded file, and nothing else', () => {
    expect([...exclusions].sort()).toEqual(Object.keys(baseline).sort());
  });

  it('holds each excluded file at its recorded count', () => {
    const counts = lintCounts();
    expect(Object.keys(counts).length).toBeGreaterThan(100);

    const regressed = exclusions
      .filter(file => (counts[file] ?? 0) > baseline[file]!)
      .map(file => `${file}: ${baseline[file]} → ${counts[file]}`);
    const improved = exclusions
      .filter(file => (counts[file] ?? 0) < baseline[file]!)
      .map(file => `${file}: ${baseline[file]} → ${counts[file] ?? 0}`);

    expect(
      regressed.length === 0
        ? true
        : `Excluded files gained a finding — fix it, or widen the over-promising type where it is declared; never delete a guard:\n  ${regressed.join('\n  ')}`,
    ).toBe(true);
    expect(
      improved.length === 0
        ? true
        : `Record the improvement in scripts/no-unnecessary-condition.baseline.json (a file at 0 leaves the exclusion list too):\n  ${improved.join('\n  ')}`,
    ).toBe(true);
  });
});
