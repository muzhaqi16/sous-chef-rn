/**
 * A writer that CREATES a shopping-list line must carry what the list reads.
 *
 * The list query's node selection is the shape a row needs. A mutation whose
 * response is normalized into that same entity — and then inserted into the
 * list's connection — produces an entity with exactly what IT selected. Any
 * field the list selects and the writer omits does not read as blank: the whole
 * list read goes incomplete, `useQuery` returns nothing, and the screen empties.
 *
 * The per-path test in `optimisticEntityCompleteness` catches this for one
 * writer. This catches it for the shape ALL of them share, which is what stopped
 * a creating writer sitting eleven fields short without any gate noticing:
 * `optimisticEntityCompleteness` covered the feature's own optimistic builder,
 * and nothing covered another feature's mutation.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse, Kind, type SelectionSetNode, type DocumentNode } from 'graphql';

const ROOT = resolve(__dirname, '..', '..');

const read = (p: string) => parse(readFileSync(resolve(ROOT, p), 'utf8'));

/** Dotted field paths of a selection set, ignoring fragment spreads. */
function fieldPaths(set: SelectionSetNode, prefix = ''): string[] {
  const out: string[] = [];
  for (const sel of set.selections) {
    if (sel.kind !== Kind.FIELD) continue;
    const path = prefix ? `${prefix}.${sel.name.value}` : sel.name.value;
    if (sel.selectionSet) out.push(...fieldPaths(sel.selectionSet, path));
    else out.push(path);
  }
  return out;
}

function findFragment(doc: DocumentNode, name: string): SelectionSetNode {
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === name) {
      return def.selectionSet;
    }
  }
  throw new Error(`fragment ${name} not found`);
}

/** The `node { … }` selection inside GetShoppingListItemsFiltered. */
function listNodeSelection(): SelectionSetNode {
  const doc = read('src/features/shoppingList/graphql/shoppingList.graphql');
  let found: SelectionSetNode | undefined;

  const walk = (set: SelectionSetNode, inFiltered: boolean) => {
    for (const sel of set.selections) {
      if (sel.kind !== Kind.FIELD || !sel.selectionSet) continue;
      if (sel.name.value === 'node' && inFiltered && !found) {
        found = sel.selectionSet;
        return;
      }
      walk(sel.selectionSet, inFiltered);
    }
  };

  for (const def of doc.definitions) {
    if (
      def.kind === Kind.OPERATION_DEFINITION &&
      def.name?.value === 'GetShoppingListItemsFiltered'
    ) {
      walk(def.selectionSet, true);
    }
  }
  if (!found) throw new Error('GetShoppingListItemsFiltered node not found');
  return found;
}

describe('a created shopping-list line covers what the list reads', () => {
  const CREATED_FRAGMENT = 'AddedShoppingListItemFields';

  it('finds both selections it compares', () => {
    // A comparison that silently comes up empty would pass vacuously.
    expect(fieldPaths(listNodeSelection()).length).toBeGreaterThan(10);
    expect(
      fieldPaths(
        findFragment(
          read('src/features/shoppingList/graphql/shoppingListFragments.graphql'),
          CREATED_FRAGMENT,
        ),
      ).length,
    ).toBeGreaterThan(10);
  });

  it('carries every field the list query selects on a row', () => {
    const needed = new Set(fieldPaths(listNodeSelection()));
    const carried = new Set(
      fieldPaths(
        findFragment(
          read('src/features/shoppingList/graphql/shoppingListFragments.graphql'),
          CREATED_FRAGMENT,
        ),
      ),
    );

    const missing = [...needed].filter(f => !carried.has(f)).sort();
    expect(missing).toEqual([]);
  });

  it('is the shape every creating writer spreads', () => {
    // Named so a new creating writer is a deliberate addition here rather than
    // a fourth hand-listed selection that drifts.
    const spreaders = [
      'src/features/recipes/graphql/recipe.graphql',
      'src/features/recipes/hooks/useRecipeShoppingList.graphql',
    ];
    for (const file of spreaders) {
      const src = readFileSync(resolve(ROOT, file), 'utf8');
      expect(src).toContain(`...${CREATED_FRAGMENT}`);
    }
  });
});
