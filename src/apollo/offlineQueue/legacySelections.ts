import {
  Kind,
  visit,
  type ASTNode,
  type DefinitionNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
} from 'graphql';
import { isOwnKey } from '#/utils/isOwnKey';

/**
 * Removed fields an earlier build's queued write still selects, by the type
 * that dropped them (another type may still offer the name). One unknown field
 * fails the whole document, so the queue drops them on load.
 */
const REMOVED_FIELDS = {
  // The previous build's readers fragments selected these on every write that
  // returned the entity; a connection or the settings row holds each now.
  ShoppingListItemSource: new Set(['isAutoAdded', 'autoAddReason']),
  MealPlan: new Set(['mealPlanItems', 'generatedShoppingLists']),
  MealTemplate: new Set(['items']),
  User: new Set(['timezone', 'preferredCurrency']),
  UserProfile: new Set(['showEmail', 'showPhone']),
  MovePurchasedItemsToPantryPayload: new Set(['movedItems', 'failedItems']),
  BatchAddShoppingListItemResult: new Set([
    'quantityIncremented',
    'code',
    'error',
    'errorId',
  ]),
  BatchUpsertItemResult: new Set(['code', 'error', 'errorId']),
};

/** The line type of a batch payload's `results`, which no type condition names. */
const RESULTS_LINE = {
  AddItemsToShoppingListPayload: 'BatchAddShoppingListItemResult',
  BulkUpsertItemsByExternalSourcePayload: 'BatchUpsertItemResult',
};

/**
 * The type a FIELD reads as, where a type above is reached by field, not type
 * condition (`source { isAutoAdded }` under a shopping line). Keyed by field
 * alone: no queued selection uses these names for another type.
 */
const FIELD_TYPE = {
  source: 'ShoppingListItemSource',
  mealPlan: 'MealPlan',
  mealTemplate: 'MealTemplate',
  user: 'User',
  profile: 'UserProfile',
  userProfile: 'UserProfile',
};

type Ancestors = readonly (ASTNode | readonly ASTNode[])[];

/**
 * The type a selection is read on, where the document names it: the nearest
 * type condition, a {@link FIELD_TYPE} field, or a batch payload's `results`
 * line. Undefined under any other field, whose type only the schema knows.
 */
function enclosingType(ancestors: Ancestors): string | undefined {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const node = ancestors[index];
    if (!node || !('kind' in node)) continue;
    if (node.kind === Kind.FRAGMENT_DEFINITION) {
      return node.typeCondition.name.value;
    }
    if (node.kind === Kind.INLINE_FRAGMENT && node.typeCondition) {
      return node.typeCondition.name.value;
    }
    if (node.kind === Kind.FIELD) {
      const field = node.name.value;
      if (isOwnKey(FIELD_TYPE, field)) return FIELD_TYPE[field];
      if (field !== 'results') return undefined;
      const payload = enclosingType(ancestors.slice(0, index));
      return payload !== undefined && isOwnKey(RESULTS_LINE, payload)
        ? RESULTS_LINE[payload]
        : undefined;
    }
  }
  return undefined;
}

const isRemoved = (field: FieldNode, ancestors: Ancestors) => {
  const type = enclosingType(ancestors);
  return (
    type !== undefined &&
    isOwnKey(REMOVED_FIELDS, type) &&
    REMOVED_FIELDS[type].has(field.name.value)
  );
};

/** A selection left empty still has to select something to validate. */
const TYPENAME: FieldNode = {
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: '__typename' },
};

/** The stored document without the removed fields; itself when it has none. */
export function withoutRemovedFields(document: DocumentNode): DocumentNode {
  const stripped = stripRemoved(document);
  return stripped === document ? document : withoutUnusedFragments(stripped);
}

function stripRemoved(document: DocumentNode): DocumentNode {
  return visit(document, {
    Field: (node, _key, _parent, _path, ancestors) =>
      isRemoved(node, ancestors) ? null : undefined,
    SelectionSet: {
      leave: node =>
        node.selections.length > 0
          ? undefined
          : { ...node, selections: [TYPENAME] },
    },
  });
}

/** A fragment only a removed field spread is now unused, which fails validation. */
function withoutUnusedFragments(document: DocumentNode): DocumentNode {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }
  const used = new Set<string>();
  const collect = (node: DefinitionNode) => {
    visit(node, {
      FragmentSpread: spread => {
        const fragment = fragments.get(spread.name.value);
        if (fragment && !used.has(spread.name.value)) {
          used.add(spread.name.value);
          collect(fragment);
        }
      },
    });
  };
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) collect(definition);
  }
  return {
    ...document,
    definitions: document.definitions.filter(
      definition =>
        definition.kind !== Kind.FRAGMENT_DEFINITION ||
        used.has(definition.name.value),
    ),
  };
}
