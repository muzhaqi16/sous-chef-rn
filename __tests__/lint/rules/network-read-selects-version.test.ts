/**
 * Runs through the config that ships, in a plain Node process: graphql-eslint's
 * parser loads ESM-only dependencies Jest cannot transform, and the schema
 * resolves relative to a real document's path.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const DOCUMENT = 'src/features/pantry/hooks/usePantryItemActions.graphql';
const RULE = 'sous-chef/network-read-selects-version';

const CASES = [
  {
    name: 'a versioned row read without version',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id name } }',
    reports: true,
  },
  {
    name: 'a versioned row read with version',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id version name } }',
    reports: false,
  },
  {
    name: 'version in an inline fragment',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id ... on ShoppingList { version } } }',
    reports: false,
  },
  {
    name: 'an aliased version',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id v: version } }',
    reports: true,
  },
  {
    name: 'a nested versioned row without version',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id version itemsConnection(first: 1) { edges { node { id } } } } }',
    reports: true,
  },
  {
    name: 'a type without version',
    code: 'query GetProbe { me { id email } }',
    reports: false,
  },
  {
    name: 'version through a spread',
    code: 'query GetProbe($id: ID!) { shoppingList(id: $id) { id ...ShoppingListReaders } }',
    reports: false,
  },
  {
    name: 'a fragment no operation spreads (a cache writer’s)',
    code: 'fragment ProbeWriter_list on ShoppingList { id name }',
    reports: false,
  },
  {
    name: 'the key of a row a removal returns',
    code: 'mutation Probe($input: DeleteShoppingListInput!) { deleteShoppingList(input: $input) { ... on DeleteShoppingListPayload { shoppingList { id } } } }',
    reports: false,
  },
  {
    name: 'a row a removal returns with more than its key',
    code: 'mutation Probe($input: DeleteShoppingListInput!) { deleteShoppingList(input: $input) { ... on DeleteShoppingListPayload { shoppingList { id name } } } }',
    reports: true,
  },
  {
    name: 'the key of a row a write returns',
    code: 'mutation Probe($input: CompleteShoppingListInput!) { completeShoppingList(input: $input) { ... on CompleteShoppingListPayload { shoppingList { id } } } }',
    reports: true,
  },
  {
    // Reachability is by name: operations on disk spread this one.
    name: 'a fragment an operation spreads, without version',
    code: 'fragment ShoppingListReaders on ShoppingList { id name }',
    reports: true,
  },
];

interface Outcome {
  reported: boolean[];
  fixed: string;
}

const lint = (): Outcome => {
  const script = `
    const { ESLint } = require('eslint');
    (async () => {
      const eslint = new ESLint();
      const reported = [];
      for (const code of ${JSON.stringify(CASES.map(c => c.code))}) {
        const [result] = await eslint.lintText(code, { filePath: ${JSON.stringify(
          DOCUMENT,
        )} });
        reported.push(result.messages.some(m => m.ruleId === ${JSON.stringify(
          RULE,
        )}));
      }
      const fixer = new ESLint({ fix: true, fixTypes: ['problem'] });
      const [fix] = await fixer.lintText(
        'query GetProbe($id: ID!) {\\n  shoppingList(id: $id) {\\n    id\\n    name\\n  }\\n}\\n',
        { filePath: ${JSON.stringify(DOCUMENT)} },
      );
      process.stdout.write(JSON.stringify({ reported, fixed: fix.output }));
    })();
  `;
  return JSON.parse(
    execFileSync('node', ['-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ) as Outcome;
};

describe('network-read-selects-version', () => {
  const outcome = lint();

  it.each(CASES.map((c, i) => [c.name, c.reports, i] as const))(
    '%s: reports %s',
    (_name, reports, index) => {
      expect(outcome.reported[index]).toBe(reports);
    },
  );

  it('adds version on its own line beside the first selection', () => {
    expect(outcome.fixed).toBe(
      'query GetProbe($id: ID!) {\n  shoppingList(id: $id) {\n    version\n    id\n    name\n  }\n}\n',
    );
  });
});
