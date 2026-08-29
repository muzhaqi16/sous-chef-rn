/**
 * A per-feature COPY of a local-first mutation must not drift from its
 * canonical original.
 *
 * The Feature API Boundary Convention stops a feature importing another's
 * `graphql/`, so several mutations exist as near-identical copies — four of
 * `AddItemsToShoppingList`, two of `CreatePantryItem`. Every copy is registered
 * replays through the queue, and each now replays AS ITSELF — so a copy with a
 * thinner selection set writes that thinner set back into the cache on replay.
 * This mattered before, when every copy replayed through one shared `Sync*`
 * fragment that masked the difference; it matters more now that the fragment is
 * gone and each copy's own selection is what lands.
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
 * The copy list is DERIVED, from the documents themselves: two client
 * operations selecting the same server mutation field are copies of each other,
 * by definition. That replaced a derivation from the sync registries, which no
 * longer exist — and is the better source anyway, because it cannot go stale
 * through someone forgetting to register something.
 */
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import { parse } from 'graphql';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  AddItemToShoppingListDocument,
  AddItemsToShoppingListDocument,
  CreateShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  AddItemsToShoppingListFromRecipeDocument,
  CreateShoppingListForRecipeDocument,
} from '#features/recipes/hooks/useRecipeDetail.generated';
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
      // Surfaced by deriving the family from the documents rather than from
      // the sync registry — neither was ever checked, because neither was
      // registered for replay.
      {
        name: 'AddItemsToShoppingList',
        document: AddItemsToShoppingListDocument,
      },
      {
        name: 'AddItemsToShoppingListFromRecipe',
        document: AddItemsToShoppingListFromRecipeDocument,
      },
    ],
    fragmentSources: [
      AddItemToShoppingListDocument,
      BarcodeAddItemToShoppingListDocument,
      AddItemToShoppingListFromFilteredPantryDocument,
      AddItemToShoppingListFromPantryItemDocument,
      AddItemsToShoppingListDocument,
      AddItemsToShoppingListFromRecipeDocument,
    ],
  },
  {
    entity: 'ShoppingList',
    canonical: {
      name: 'CreateShoppingList',
      document: CreateShoppingListDocument,
    },
    copies: [
      {
        name: 'CreateShoppingListForRecipe',
        document: CreateShoppingListForRecipeDocument,
      },
    ],
    fragmentSources: [
      CreateShoppingListDocument,
      CreateShoppingListForRecipeDocument,
    ],
  },
];

/**
 * Client operations grouped by the SERVER mutation they select.
 *
 * Two operations hitting the same root field are copies of one another —
 * that is what makes them a family, and it is readable off the documents
 * rather than off a list someone has to maintain.
 */
function copyFamiliesFromSource(): Map<string, string[]> {
  const byRootField = new Map<string, string[]>();
  for (const file of globSync('src/**/*.graphql', { absolute: true })) {
    const document = parse(readFileSync(file, 'utf8'));
    for (const definition of document.definitions) {
      if (
        definition.kind !== 'OperationDefinition' ||
        definition.operation !== 'mutation' ||
        !definition.name
      ) {
        continue;
      }
      const rootField = definition.selectionSet.selections.find(
        (s): s is FieldNode => s.kind === 'Field',
      );
      if (!rootField) continue;
      const key = rootField.name.value;
      byRootField.set(key, [
        ...(byRootField.get(key) ?? []),
        definition.name.value,
      ]);
    }
  }
  return new Map([...byRootField].filter(([, ops]) => ops.length > 1));
}

describe('local-first copy drift', () => {
  it('covers every create/add family that exists in the source', () => {
    // Derived from the documents, not hand-kept: a new copy of a create is
    // covered by existing, which is how the original drift got in unnoticed.
    const covered = new Set(
      FAMILIES.flatMap(f => [f.canonical.name, ...f.copies.map(c => c.name)]),
    );
    const uncovered = [...copyFamiliesFromSource()]
      .filter(([rootField]) => /^(create|addItems?)/i.test(rootField))
      .flatMap(([, ops]) => ops)
      .filter(op => !covered.has(op));

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
