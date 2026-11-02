/**
 * `ShoppingList.priceReadiness` costs the API about ten reads per list, unbatched,
 * so only the shown list's read selects it. No write returns it, so a write
 * waiting offline cannot set off the price prompt: it asks on the list's next
 * read (`usePricePrompt`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Kind,
  parse,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

const graphqlFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return /^(generated|__tests__)$/.test(entry.name)
        ? []
        : graphqlFiles(full);
    }
    return entry.name.endsWith('.graphql') ? [full] : [];
  });

const fragments = new Map<string, FragmentDefinitionNode>();
const operations: OperationDefinitionNode[] = [];
for (const file of OPERATION_ROOT_DIRS.flatMap(graphqlFiles)) {
  for (const definition of parse(fs.readFileSync(file, 'utf8')).definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    } else if (definition.kind === Kind.OPERATION_DEFINITION) {
      operations.push(definition);
    }
  }
}

const selects = (
  field: string,
  selectionSet: SelectionSetNode,
  seen = new Set<string>(),
): boolean =>
  selectionSet.selections.some(selection => {
    switch (selection.kind) {
      case Kind.FIELD:
        return (
          selection.name.value === field ||
          (!!selection.selectionSet &&
            selects(field, selection.selectionSet, seen))
        );
      case Kind.INLINE_FRAGMENT:
        return selects(field, selection.selectionSet, seen);
      case Kind.FRAGMENT_SPREAD: {
        const name = selection.name.value;
        if (seen.has(name)) return false;
        seen.add(name);
        const fragment = fragments.get(name);
        return !!fragment && selects(field, fragment.selectionSet, seen);
      }
    }
  });

describe('ShoppingList.priceReadiness', () => {
  it('is selected by the shown list alone, never by a write', () => {
    const readers = operations
      .filter(operation => selects('priceReadiness', operation.selectionSet))
      .map(
        operation =>
          `${operation.operation} ${operation.name?.value ?? '(anonymous)'}`,
      );

    expect(readers).toEqual(['query GetShoppingListDetails']);
  });
});
