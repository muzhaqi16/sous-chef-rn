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
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { parse, Kind, type SelectionSetNode, type DocumentNode } from 'graphql';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

const ROOT = resolve(__dirname, '..', '..');

const read = (p: string) => parse(readFileSync(resolve(ROOT, p), 'utf8'));

/**
 * Every fragment definition reachable from the shopping-list documents.
 *
 * Built once so {@link fieldPaths} can follow a spread. Without it the walk
 * skipped every non-FIELD selection, which made this gate blind through
 * `...SortableItem_item` and friends — it happened to be latent only because
 * the created-line fragment already carried the fields those spreads add.
 */
// Derived from the tree, not a list: a fragment moved or added must not make
// this gate quietly stop seeing through the spread that references it.
const DOCUMENTS: DocumentNode[] = (() => {
  const documents: DocumentNode[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.graphql')) {
        documents.push(parse(readFileSync(full, 'utf8')));
      }
    }
  };
  OPERATION_ROOT_DIRS.forEach(dir => walk(dir));
  return documents;
})();

const FRAGMENTS: Map<string, SelectionSetNode> = (() => {
  const map = new Map<string, SelectionSetNode>();
  for (const document of DOCUMENTS) {
    for (const def of document.definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        map.set(def.name.value, def.selectionSet);
      }
    }
  }
  return map;
})();

/**
 * Dotted field paths of a selection set, FOLLOWING fragment spreads.
 *
 * A spread this cannot resolve throws rather than being skipped: a structural
 * check that silently ignores a construct is blind wherever that construct is
 * used, and its coverage then depends on authors happening not to use it.
 */
function fieldPaths(set: SelectionSetNode, prefix = ''): string[] {
  const out: string[] = [];
  for (const sel of set.selections) {
    if (sel.kind === Kind.FRAGMENT_SPREAD) {
      const target = FRAGMENTS.get(sel.name.value);
      if (!target) {
        throw new Error(
          `fragment ${sel.name.value} is spread but not resolvable — ` +
            'add its file to FRAGMENTS so this gate can see through it',
        );
      }
      out.push(...fieldPaths(target, prefix));
      continue;
    }
    if (sel.kind === Kind.INLINE_FRAGMENT) {
      out.push(...fieldPaths(sel.selectionSet, prefix));
      continue;
    }
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

/** The selection under `name`, looking through inline fragments. */
function childSelection(
  set: SelectionSetNode,
  name: string,
): SelectionSetNode | undefined {
  for (const sel of set.selections) {
    if (sel.kind === Kind.INLINE_FRAGMENT) {
      const nested = childSelection(sel.selectionSet, name);
      if (nested) return nested;
    }
    if (sel.kind === Kind.FIELD && sel.name.value === name) {
      return sel.selectionSet;
    }
  }
  return undefined;
}

/**
 * Every authored mutation that adds lines to a list, with what it selects on
 * each line it adds. Every feature's add is a copy of the one batch add.
 */
function creatingWriters(): { operation: string; line: SelectionSetNode }[] {
  return DOCUMENTS.flatMap(document =>
    document.definitions.flatMap(def => {
      if (def.kind !== Kind.OPERATION_DEFINITION || !def.name) return [];
      const added = childSelection(def.selectionSet, 'addItemsToShoppingList');
      const results = added && childSelection(added, 'results');
      const line = results && childSelection(results, 'item');
      return line ? [{ operation: def.name.value, line }] : [];
    }),
  );
}

/**
 * The gate's own coverage, demonstrated rather than assumed.
 *
 * `fieldPaths` must not skip non-FIELD selections: a field reached through
 * `...SomeFragment` would count as absent on BOTH sides, the comparison would
 * agree for the wrong reason, and the gate would be blind wherever a spread is
 * used. These assert it sees through one, in each direction.
 */
describe('the coverage check sees through a fragment spread', () => {
  const parseSet = (source: string): SelectionSetNode => {
    const doc = parse(source);
    for (const def of doc.definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === 'Probe') {
        return def.selectionSet;
      }
    }
    throw new Error('Probe fragment not found');
  };

  it('counts a field a spread contributes', () => {
    // `AddedShoppingListItemFields` is a real fragment in the registry, so the
    // spread resolves and its fields must appear in the walk.
    const viaSpread = fieldPaths(
      parseSet(
        'fragment Probe on ShoppingListItem { ...AddedShoppingListItemFields }',
      ),
    );

    expect(viaSpread.length).toBeGreaterThan(10);
    expect(viaSpread).toContain('id');
  });

  it('refuses a spread it cannot resolve rather than skipping it silently', () => {
    expect(() =>
      fieldPaths(
        parseSet('fragment Probe on ShoppingListItem { ...NoSuchFragment }'),
      ),
    ).toThrow(/not resolvable/);
  });

  it('would fail a violation expressed only through a spread', () => {
    // The shape the gate exists to catch: the list needs a field, and the
    // creating side carries it only inside a spread. Skipping spreads made both
    // sides read as missing it, so the comparison passed.
    const needed = new Set(
      fieldPaths(
        parseSet('fragment Probe on ShoppingListItem { id itemName }'),
      ),
    );
    const carriedWithoutSpread = new Set(
      fieldPaths(parseSet('fragment Probe on ShoppingListItem { id }')),
    );
    const carriedWithSpread = new Set(
      fieldPaths(
        parseSet(
          'fragment Probe on ShoppingListItem { ...AddedShoppingListItemFields }',
        ),
      ),
    );

    expect([...needed].filter(f => !carriedWithoutSpread.has(f))).toEqual([
      'itemName',
    ]);
    expect([...needed].filter(f => !carriedWithSpread.has(f))).toEqual([]);
  });
});

describe('a created shopping-list line covers what the list reads', () => {
  const CREATED_FRAGMENT = 'AddedShoppingListItemFields';

  it('finds both selections it compares', () => {
    // A comparison that silently comes up empty would pass vacuously.
    expect(fieldPaths(listNodeSelection()).length).toBeGreaterThan(10);
    expect(
      fieldPaths(
        findFragment(
          read(
            'src/features/shoppingList/graphql/shoppingListFragments.graphql',
          ),
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
          read(
            'src/features/shoppingList/graphql/shoppingListFragments.graphql',
          ),
          CREATED_FRAGMENT,
        ),
      ),
    );

    const missing = [...needed].filter(f => !carried.has(f)).sort();
    expect(missing).toEqual([]);
  });

  it('is carried by every writer that adds a line, the recipe add among them', () => {
    const writers = creatingWriters();
    // A discovery that came up empty would pass the comparison vacuously.
    expect(writers.map(writer => writer.operation)).toContain(
      operationNameOf(AddItemsToShoppingListFromRecipeDocument),
    );

    const created = fieldPaths(
      findFragment(
        read('src/features/shoppingList/graphql/shoppingListFragments.graphql'),
        CREATED_FRAGMENT,
      ),
    );
    // Followed through each writer's own spreads, so a writer that lists
    // fields by hand is held to the same shape as one that spreads it.
    const short = writers.flatMap(({ operation, line }) => {
      const carried = new Set(fieldPaths(line));
      const missing = created.filter(field => !carried.has(field));
      return missing.length > 0 ? [`${operation}: ${missing.join(', ')}`] : [];
    });
    expect(short).toEqual([]);
  });
});
