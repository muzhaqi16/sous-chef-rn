import {
  Kind,
  visit,
  type DefinitionNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionNode,
} from 'graphql';

/**
 * Fields the API removed with the mutation-payload cutover that a write queued
 * by an earlier build still selects. One unknown field fails the whole
 * document, and the write with it, so the queue drops them when it loads.
 */
const REMOVED_FIELDS: ReadonlySet<string> = new Set([
  'quantityIncremented',
  'movedItems',
  'failedItems',
  'addedItems',
  'updatedItems',
  'skippedItems',
  'totalAdded',
  'totalUpdated',
  'totalSkipped',
]);

/** A batch element's own failure fields; an error member's `code` stays. */
const REMOVED_RESULT_FIELDS: ReadonlySet<string> = new Set([
  'code',
  'error',
  'errorId',
]);

const TYPENAME: FieldNode = {
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: '__typename' },
};

/** A selection left empty still has to select something to validate. */
const nonEmpty = (selections: readonly SelectionNode[]) =>
  selections.length > 0 ? selections : [TYPENAME];

/** The stored document without the removed fields; itself when it has none. */
export function withoutRemovedFields(document: DocumentNode): DocumentNode {
  const stripped = stripRemoved(document);
  return stripped === document ? document : withoutUnusedFragments(stripped);
}

function stripRemoved(document: DocumentNode): DocumentNode {
  return visit(document, {
    Field: {
      enter: node => (REMOVED_FIELDS.has(node.name.value) ? null : undefined),
      leave: node => {
        if (node.name.value !== 'results' || !node.selectionSet)
          return undefined;
        const kept = node.selectionSet.selections.filter(
          selection =>
            selection.kind !== Kind.FIELD ||
            !REMOVED_RESULT_FIELDS.has(selection.name.value),
        );
        return kept.length === node.selectionSet.selections.length
          ? undefined
          : {
              ...node,
              selectionSet: {
                ...node.selectionSet,
                selections: nonEmpty(kept),
              },
            };
      },
    },
    SelectionSet: {
      leave: node =>
        node.selections.length > 0
          ? undefined
          : { ...node, selections: nonEmpty(node.selections) },
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
