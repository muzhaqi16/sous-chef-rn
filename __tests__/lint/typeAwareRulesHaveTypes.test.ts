/**
 * Every tier that should be type-aware actually has a program.
 *
 * A type-aware rule guards with `if (!services?.program) return {}`, so a file
 * the parser could not place reports nothing — which reads exactly like a clean
 * file. That is how `e2e/` was linted for a while: it sat in no project the
 * resolver could reach, and its type-aware rules were silently off.
 *
 * These assert the rules FIRE, one fixture per tier, and that none of the cases
 * failed to parse — a parse error would make every assertion below vacuous.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

type Case = { tier: string; filePath: string; code: string; rule: string };

const FLOATING =
  'declare const p: Promise<void>;\nexport function f() {\n  p;\n}\n';

const CASES: Case[] = [
  {
    tier: 'production source',
    filePath: 'src/features/pantry/hooks/buildOptimisticPantryItem.ts',
    code: 'export const f = (s: string) => (s !== undefined ? 1 : 2);\n',
    rule: '@typescript-eslint/no-unnecessary-condition',
  },
  {
    tier: 'production source, unsafe access',
    filePath: 'src/features/pantry/hooks/buildOptimisticPantryItem.ts',
    code: 'declare const x: any;\nexport const y = x.foo;\n',
    rule: '@typescript-eslint/no-unsafe-member-access',
  },
  {
    tier: 'a colocated test',
    filePath:
      'src/features/pantry/hooks/__tests__/usePantryItemActions.test.ts',
    code: FLOATING,
    rule: '@typescript-eslint/no-floating-promises',
  },
  {
    tier: 'the root test tree',
    filePath: '__tests__/lint/ruleCatalog.test.ts',
    code: FLOATING,
    rule: '@typescript-eslint/no-floating-promises',
  },
  {
    tier: 'e2e',
    filePath: 'e2e/helpers/actions.ts',
    code: FLOATING,
    rule: '@typescript-eslint/no-floating-promises',
  },
];

/** The composed config loads ESM-only dependencies Jest cannot transform. */
const lint = (cases: Case[]) => {
  const script = `
    const { ESLint } = require('eslint');
    const eslint = new ESLint();
    const cases = ${JSON.stringify(cases)};
    (async () => {
      const out = [];
      for (const c of cases) {
        const [result] = await eslint.lintText(c.code, { filePath: c.filePath });
        out.push({
          tier: c.tier,
          parseError: result.messages.some(m => !m.ruleId),
          fired: result.messages.some(m => m.ruleId === c.rule),
        });
      }
      process.stdout.write(JSON.stringify(out));
    })();
  `;
  return JSON.parse(
    execFileSync('node', ['-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    }),
  ) as Array<{ tier: string; parseError: boolean; fired: boolean }>;
};

describe('type-aware linting', () => {
  const results = lint(CASES);

  it('places every case in a project, so none passes vacuously', () => {
    expect(results.filter(r => r.parseError).map(r => r.tier)).toEqual([]);
  });

  it('fires a type-aware rule in every tier', () => {
    expect(results.map(r => ({ tier: r.tier, fired: r.fired }))).toEqual(
      CASES.map(c => ({ tier: c.tier, fired: true })),
    );
  });
});
