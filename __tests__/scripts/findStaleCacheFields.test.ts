import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The stale-cache check can actually fail. CI only ever runs it over the app's
 * own documents, which proves the passing case; a regression that let every
 * gap through would read exactly like a clean tree. Each case here plants one
 * gap in a small documents tree, checked against the app's real schema.
 */

const ROOT = path.join(__dirname, '..', '..');
const CHECK = path.join(ROOT, 'scripts', 'find-stale-cache-fields.mjs');

/** What a screen reads: a list's name and total, and each line's name and amount. */
const LIST_SCREEN = `
  query FixtureList($id: ID!) {
    shoppingList(id: $id) {
      id
      name
      totalItems
      itemsConnection(first: 5) {
        edges {
          node {
            id
            itemName
            quantity
          }
        }
      }
    }
  }
`;

const toggle = (selection: string) => `
  mutation FixtureToggle($input: ToggleShoppingListItemPurchasedInput!) {
    toggleShoppingListItemPurchased(input: $input) {
      __typename
      ... on ToggleShoppingListItemPurchasedPayload {
        ${selection}
      }
    }
  }
`;

const remove = (selection: string) => `
  mutation FixtureRemove($input: RemoveItemFromShoppingListInput!) {
    removeItemFromShoppingList(input: $input) {
      __typename
      ... on RemoveItemFromShoppingListPayload {
        ${selection}
      }
    }
  }
`;

const LINE = 'shoppingListItem { id itemName quantity }';
const LIST = 'shoppingList { id name totalItems }';

/** Runs the check over a tree holding the screen and `mutation`. */
function check(mutation: string): { code: number; output: string } {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-cache-fields-'));
  try {
    fs.writeFileSync(path.join(src, 'screen.graphql'), LIST_SCREEN);
    fs.writeFileSync(path.join(src, 'write.graphql'), mutation);
    try {
      const output = execFileSync('node', [CHECK, '--src', src], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, output };
    } catch (error) {
      const failure = error as {
        status?: number;
        stdout?: string;
        stderr?: string;
      };
      return {
        code: failure.status ?? 1,
        output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
      };
    }
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
  }
}

describe('find-stale-cache-fields', () => {
  it('passes a write that returns what the screen reads, and says what it examined', () => {
    const { code, output } = check(toggle(`${LINE} ${LIST}`));

    expect(code).toBe(0);
    expect(output).toContain('Examined 2 operations · 0 gap(s)');
  });

  it('names the write and the field when a field the screen reads is not returned', () => {
    const { code, output } = check(
      toggle(`shoppingListItem { id itemName } ${LIST}`),
    );

    expect(code).toBe(1);
    expect(output).toMatch(/FixtureToggle → ShoppingListItem\n\s+quantity/);
  });

  it('fails a member change that leaves its collection out', () => {
    const { code, output } = check(toggle(LINE));

    expect(code).toBe(1);
    expect(output).toContain(
      'FixtureToggle → ShoppingList (on the payload, not selected)',
    );
    expect(output).toContain(
      'FixtureToggle → ShoppingList (parent of ShoppingListItem, not returned)',
    );
  });

  it('asks a removal for the key and the collection it left, nothing more', () => {
    expect(check(remove(`shoppingListItem { id } ${LIST}`)).code).toBe(0);

    const returnsMore = check(
      remove(`shoppingListItem { id itemName } ${LIST}`),
    );
    expect(returnsMore.code).toBe(1);
    expect(returnsMore.output).toMatch(
      /FixtureRemove → ShoppingListItem \(removal; returns more than the key\)\n\s+itemName/,
    );

    const leavesListOut = check(remove('shoppingListItem { id }'));
    expect(leavesListOut.code).toBe(1);
    expect(leavesListOut.output).toContain('FixtureRemove → ShoppingList');
  });
});
