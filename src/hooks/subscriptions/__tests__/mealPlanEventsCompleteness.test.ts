/**
 * The plan read-back must stay a superset of `MealPlanDisplay`.
 *
 * `MealPlanEvents` carries only the changed plan's id — a subscription document
 * is capped at depth 5, which no fragment spread fits under — so the handler
 * reads the plan through `MealPlanForEvent` before joining it to the overview
 * connection. If that query stopped covering `MealPlanDisplay`, the overview's
 * read would go incomplete and blank the list.
 *
 * Paths are compared by field NAME, ignoring aliases — which is what the cache
 * keys on.
 */
import type {
  DocumentNode,
  FieldNode,
  SelectionSetNode,
  FragmentDefinitionNode,
} from 'graphql';
import {
  MealPlanEventsDocument,
  MealPlanForEventDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { MealPlanDisplayFragmentDoc } from '#features/mealPlan/graphql/mealPlanFragments.generated';

/**
 * Every field path in a selection set, by field NAME — aliases ignored.
 *
 * Spreads are resolved, not skipped. Factoring part of `MealPlanDisplay` into
 * its own fragment is an ordinary refactor, and a walk that ignored spreads
 * would quietly drop those fields from the requirement — leaving this test
 * green while the guarantee it exists for was gone.
 */
function fieldPaths(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  prefix = '',
): string[] {
  const paths: string[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'FragmentSpread') {
      const spread = fragments.get(selection.name.value);
      if (!spread) {
        throw new Error(
          `Cannot resolve ...${selection.name.value} — add its document to FRAGMENT_SOURCES`,
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

/** Fragment definitions reachable from either document, by name. */
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

/** The `mealPlan` field's selection set on the read-back query. */
function readBackSelection(document: DocumentNode): SelectionSetNode {
  // Stale or failed codegen leaves the export undefined while `tsc` still sees
  // the symbol. Say so, rather than dying on `.definitions` of undefined.
  if (!document) {
    throw new Error(
      'MealPlanForEventDocument is undefined — run `npm run codegen` (the generated document is stale)',
    );
  }

  const operation = document.definitions.find(
    def => def.kind === 'OperationDefinition',
  );
  if (operation?.kind !== 'OperationDefinition') {
    throw new Error('MealPlanForEvent operation not found');
  }

  const planField = operation.selectionSet.selections.find(
    (s): s is FieldNode => s.kind === 'Field' && s.name.value === 'mealPlan',
  );
  if (!planField?.selectionSet) {
    throw new Error('mealPlan field not found on MealPlanForEvent');
  }
  return planField.selectionSet;
}

/** The `... on MealPlan` branch of the subscription's `node` union. */
function subscriptionPlanBranch(document: DocumentNode): SelectionSetNode {
  const operation = document.definitions.find(
    def => def.kind === 'OperationDefinition',
  );
  if (operation?.kind !== 'OperationDefinition') {
    throw new Error('MealPlanEvents operation not found');
  }

  const eventsField = operation.selectionSet.selections.find(
    (s): s is FieldNode =>
      s.kind === 'Field' && s.name.value === 'mealPlanEvents',
  );
  const nodeField = eventsField?.selectionSet?.selections.find(
    (s): s is FieldNode => s.kind === 'Field' && s.name.value === 'node',
  );

  for (const selection of nodeField?.selectionSet?.selections ?? []) {
    if (
      selection.kind === 'InlineFragment' &&
      selection.typeCondition?.name.value === 'MealPlan'
    ) {
      return selection.selectionSet;
    }
  }

  throw new Error('MealPlan branch not found on mealPlanEvents.node');
}

describe('MealPlanEvents completeness', () => {
  it('reads back every field MealPlanDisplay needs', () => {
    // Built here, not at module scope: the generated documents import each
    // other, so a module-level array can capture a binding before it resolves.
    const fragments = collectFragments([
      MealPlanDisplayFragmentDoc,
      MealPlanForEventDocument,
    ]);
    const fragment = fragments.get('MealPlanDisplay');
    if (!fragment) throw new Error('MealPlanDisplay fragment not found');

    const required = fieldPaths(fragment.selectionSet, fragments);
    const fetched = new Set(
      fieldPaths(readBackSelection(MealPlanForEventDocument), fragments),
    );

    // Sanity: the walk found a real fragment, not an empty one. Guards against
    // a future refactor that hides every field behind an unresolved spread.
    expect(required.length).toBeGreaterThan(10);
    expect(required).toContain('home.myMembership.role');

    const missing = required.filter(path => !fetched.has(path));
    expect(missing).toEqual([]);
  });

  it('keeps the subscription branch to identity only', () => {
    // Anything more re-fattens the document past the depth-5 subscription
    // bound; `__tests__/graphql/documentLimits.test.ts` enforces the bound
    // itself, this pins the shape that keeps it there.
    const fragments = collectFragments([MealPlanEventsDocument]);
    expect(
      fieldPaths(subscriptionPlanBranch(MealPlanEventsDocument), fragments),
    ).toEqual(['id']);
  });
});
