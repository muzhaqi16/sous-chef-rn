/**
 * A per-feature COPY of a local-first mutation must not drift from its
 * canonical original.
 *
 * The Feature API Boundary Convention stops a feature importing another's
 * `graphql/`, so several mutations exist as near-identical copies — four of
 * `AddItemsToShoppingList`, two of `CreatePantryItem`. Every copy is registered
 * in a `*_SYNC_BUILDERS` table and replays through the SAME `Sync*` fragment,
 * so the queue treats them as one operation while their selection sets are
 * maintained by hand, separately, in different features.
 *
 * They had already drifted before this test existed, and nothing reported it:
 * the two pantry copies of `AddItemsToShoppingList` omit the parent-list
 * counters (`totalItems`, `completedItems`, `remainingItems`,
 * `completionRate`) that the canonical copy selects. That matters because the
 * shared updater deliberately does NOT adjust them —
 * `reconcileShoppingItemCreateUpdate` calls
 * `addNewItemToShoppingListCache(..., bumpTotalItems = false)` precisely
 * because the response is expected to carry them. A copy that omits them
 * leaves the list's counts stale after an add.
 *
 * The check is a SUPERSET, not equality: a copy may legitimately select more.
 * And divergence is allowed where it is deliberate — but only with a written
 * reason, which is the whole point. `BarcodeCreatePantryItem` is the worked
 * example: it selects almost nothing off the created item because its `update`
 * callback materializes the entity from the CACHE by id (the optimistic write
 * has already put it there complete) rather than from the response. That is a
 * different architecture, not drift, and the exemption below says so.
 *
 * The operation list is derived from the sync registries rather than hand-kept,
 * so a newly registered copy is covered by being registered.
 */
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import { PANTRY_SYNC_BUILDERS } from '#features/pantry/offline/syncBuilders';
import { SHOPPING_LIST_SYNC_BUILDERS } from '#features/shoppingList/offline/syncBuilders';
import {
  CreatePantryItemDocument,
  SyncPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  AddItemToShoppingListDocument,
  SyncShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  BarcodeCreatePantryItemDocument,
  BarcodeAddItemToShoppingListDocument,
} from '#features/barcode/components/SearchResults.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';

/** Every field path in a selection set, by field NAME — aliases ignored. */
function fieldPaths(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  prefix = '',
): string[] {
  const paths: string[] = [];
  for (const selection of selectionSet.selections) {
    if (selection.kind === 'FragmentSpread') {
      const spread = fragments.get(selection.name.value);
      // A spread we cannot resolve would silently shrink the requirement and
      // leave this test green while the guarantee was gone.
      if (!spread) {
        throw new Error(
          `Cannot resolve ...${selection.name.value} — its document is not imported here`,
        );
      }
      paths.push(...fieldPaths(spread.selectionSet, fragments, prefix));
      continue;
    }
    if (selection.kind === 'InlineFragment') {
      paths.push(...fieldPaths(selection.selectionSet, fragments, prefix));
      continue;
    }
    const field = selection as FieldNode;
    if (field.name.value === '__typename') continue;
    const path = prefix ? `${prefix}.${field.name.value}` : field.name.value;
    if (field.selectionSet) {
      paths.push(...fieldPaths(field.selectionSet, fragments, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

function collectFragments(
  documents: DocumentNode[],
): Map<string, FragmentDefinitionNode> {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const document of documents) {
    for (const definition of document.definitions) {
      if (definition.kind === 'FragmentDefinition') {
        fragments.set(definition.name.value, definition);
      }
    }
  }
  return fragments;
}

/** The whole payload selection of a mutation, unions included. */
function payloadSelection(document: DocumentNode): SelectionSetNode {
  const operation = document.definitions.find(
    def => def.kind === 'OperationDefinition',
  );
  if (operation?.kind !== 'OperationDefinition') {
    throw new Error('operation not found — run `npm run codegen`');
  }
  const rootField = operation.selectionSet.selections.find(
    (s): s is FieldNode => s.kind === 'Field',
  );
  if (!rootField?.selectionSet) throw new Error('root field has no selection');
  return rootField.selectionSet;
}

/**
 * Paths every copy is allowed to omit, with the reason. An entry here is a
 * decision, not a silencer — it says the copy's write path does not read that
 * field from the response.
 */
const ALLOWED_OMISSIONS: Record<string, { reason: string; paths: RegExp }> = {
  BarcodeCreatePantryItem: {
    reason:
      "materializes the entity from the CACHE by id (SearchResults' update " +
      'callback reads SearchResults_pantryItem, which is `{ id }`), so the ' +
      'response only has to identify the row — the optimistic write already ' +
      'put it in the cache complete',
    paths: /^pantryItem\./,
  },
};

interface Copy {
  name: string;
  document: DocumentNode;
}

interface Family {
  entity: string;
  canonical: Copy;
  /** Registered in a sync table, so the queue replays it as the canonical op. */
  copies: Copy[];
  /** Imported so `fieldPaths` can resolve spreads reachable from either side. */
  fragmentSources: DocumentNode[];
}

const FAMILIES: Family[] = [
  {
    entity: 'PantryItem',
    canonical: { name: 'CreatePantryItem', document: CreatePantryItemDocument },
    copies: [
      {
        name: 'BarcodeCreatePantryItem',
        document: BarcodeCreatePantryItemDocument,
      },
    ],
    fragmentSources: [
      CreatePantryItemDocument,
      BarcodeCreatePantryItemDocument,
      SyncPantryItemDocument,
    ],
  },
  {
    entity: 'ShoppingListItem',
    canonical: {
      name: 'AddItemToShoppingList',
      document: AddItemToShoppingListDocument,
    },
    copies: [
      {
        name: 'BarcodeAddItemToShoppingList',
        document: BarcodeAddItemToShoppingListDocument,
      },
      {
        name: 'AddItemToShoppingListFromFilteredPantry',
        document: AddItemToShoppingListFromFilteredPantryDocument,
      },
      {
        name: 'AddItemToShoppingListFromPantryItem',
        document: AddItemToShoppingListFromPantryItemDocument,
      },
    ],
    fragmentSources: [
      AddItemToShoppingListDocument,
      BarcodeAddItemToShoppingListDocument,
      AddItemToShoppingListFromFilteredPantryDocument,
      AddItemToShoppingListFromPantryItemDocument,
      SyncShoppingListItemDocument,
    ],
  },
];

const REGISTERED = new Set([
  ...Object.keys(PANTRY_SYNC_BUILDERS),
  ...Object.keys(SHOPPING_LIST_SYNC_BUILDERS),
]);

describe('local-first copy drift', () => {
  it('covers every copy the sync registries actually replay', () => {
    // Derived, not hand-kept: a copy registered for replay but absent from
    // FAMILIES would go unchecked, which is exactly how the current drift got
    // in. This fails when someone registers a new copy without listing it.
    const covered = new Set(
      FAMILIES.flatMap(f => [f.canonical.name, ...f.copies.map(c => c.name)]),
    );
    const registeredCreates = [...REGISTERED].filter(
      op => op.startsWith('Create') || op.startsWith('AddItem') || op.includes('Barcode'),
    );
    const uncovered = registeredCreates.filter(op => !covered.has(op));
    expect(uncovered).toEqual([]);
  });

  describe.each(FAMILIES)('$entity', family => {
    const fragments = collectFragments(family.fragmentSources);
    const canonicalPaths = fieldPaths(
      payloadSelection(family.canonical.document),
      fragments,
    );

    it('finds a real canonical selection, so the checks are not vacuous', () => {
      expect(canonicalPaths.length).toBeGreaterThan(5);
    });

    it.each(family.copies)('$name matches the canonical selection', copy => {
      const copyPaths = new Set(
        fieldPaths(payloadSelection(copy.document), fragments),
      );
      const exemption = ALLOWED_OMISSIONS[copy.name];
      const missing = canonicalPaths.filter(
        path =>
          !copyPaths.has(path) && !(exemption && exemption.paths.test(path)),
      );
      expect(missing).toEqual([]);
    });
  });
});
