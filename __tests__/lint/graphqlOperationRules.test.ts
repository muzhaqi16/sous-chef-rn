/**
 * The GraphQL operation rules, exercised through the config that ships.
 *
 * A misconfigured `graphQLConfig` makes graphql-eslint report nothing rather
 * than fail, which reads exactly like a clean document set — so these assert
 * what the rules CATCH. Each case lints synthetic text at a real document's
 * path, because the parser resolves the schema relative to it.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const DOCUMENT = 'src/features/pantry/hooks/usePantryItemActions.graphql';

type Case = { label: string; code: string; rule: string | null };

const CASES: Case[] = [
  {
    label: 'a field the schema does not have',
    code: 'query GetProbe { me { notAField } }',
    rule: '@graphql-eslint/fields-on-correct-type',
  },
  {
    label: 'a variable nothing declares',
    code: 'query GetProbe { pantryItem(id: $missing) { id } }',
    rule: '@graphql-eslint/no-undefined-variables',
  },
  {
    label: 'an anonymous operation',
    code: 'query { me { id } }',
    rule: '@graphql-eslint/no-anonymous-operations',
  },
  {
    label: 'the same field selected twice',
    code: 'query GetProbe { me { id id } }',
    rule: '@graphql-eslint/no-duplicate-fields',
  },
  {
    label: 'a required argument left out',
    code: 'query GetProbe { pantryItem { id } }',
    rule: '@graphql-eslint/provided-required-arguments',
  },
  {
    label: 'a declared variable nothing uses',
    code: 'query GetProbe($unused: ID!) { me { id } }',
    rule: '@graphql-eslint/no-unused-variables',
  },
  {
    // The preset forbids it; this repo's operations are named that way.
    label: 'an operation named with the Get prefix',
    code: 'query GetProbe { me { id } }',
    rule: null,
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
        const [result] = await eslint.lintText(c.code, { filePath: ${JSON.stringify(
          DOCUMENT,
        )} });
        out.push({ label: c.label, ruleIds: result.messages.map(m => m.ruleId) });
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
  ) as Array<{ label: string; ruleIds: Array<string | null> }>;
};

describe('graphql operation rules', () => {
  const results = lint(CASES);

  it('catches what each rule names', () => {
    const actual = results.map(r => {
      const expected = CASES.find(c => c.label === r.label)?.rule ?? null;
      return {
        label: r.label,
        caught: expected
          ? r.ruleIds.includes(expected)
          : r.ruleIds.length === 0,
      };
    });

    expect(actual).toEqual(CASES.map(c => ({ label: c.label, caught: true })));
  });
});
