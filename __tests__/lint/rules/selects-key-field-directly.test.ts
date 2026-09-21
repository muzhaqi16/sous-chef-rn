/**
 * Runs through the config that ships, in a plain Node process: graphql-eslint's
 * parser loads ESM-only dependencies Jest cannot transform, and the schema
 * resolves relative to a real document's path.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const DOCUMENT = 'src/features/pantry/hooks/usePantryItemActions.graphql';
const RULE = 'sous-chef/selects-key-field-directly';
const FRAGMENT = 'fragment Probe_user on User { email }';

const CASES = [
  { code: 'query GetProbe { me { id ...Probe_user } }', reports: false },
  { code: 'query GetProbe { me { key: id ...Probe_user } }', reports: true },
  { code: 'query GetProbe { me { id: email ...Probe_user } }', reports: true },
  {
    code: 'query GetProbe { me { ... on User { id } ...Probe_user } }',
    reports: false,
  },
  { code: 'query GetProbe { me { email } }', reports: false },
  { code: 'query GetProbe { me { ...Probe_user } }', reports: true },
  {
    code: 'fragment Parent_user on User { email ...Probe_user }',
    reports: true,
  },
];

const reported = (): boolean[] => {
  const script = `
    const { ESLint } = require('eslint');
    const eslint = new ESLint();
    (async () => {
      const out = [];
      for (const code of ${JSON.stringify(
        CASES.map(c => `${c.code}\n${FRAGMENT}`),
      )}) {
        const [result] = await eslint.lintText(code, { filePath: ${JSON.stringify(
          DOCUMENT,
        )} });
        out.push(result.messages.some(m => m.ruleId === ${JSON.stringify(
          RULE,
        )}));
      }
      process.stdout.write(JSON.stringify(out));
    })();
  `;
  return JSON.parse(
    execFileSync('node', ['-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ) as boolean[];
};

describe('selects-key-field-directly', () => {
  it('reports an id that arrives only through a spread', () => {
    expect(reported()).toEqual(CASES.map(c => c.reports));
  });
});
