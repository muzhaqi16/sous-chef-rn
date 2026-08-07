/**
 * The `MealPlanEvents` MealPlan branch must stay a superset of
 * `MealPlanDisplay`.
 *
 * The branch spells its fields out instead of spreading the fragment, because
 * `MealPlan.servings` / `actualCost` are non-null where the item types hold
 * them nullable, and GraphQL rejects one response key resolving to both. The
 * aliases (`planServings`, `planCost`) are the sanctioned fix — Apollo
 * normalizes by field name, so they still write the real fields.
 *
 * The cost of spelling it out is drift: a field added to `MealPlanDisplay`
 * would not reach the pushed payload, the handler's read-back would miss, and
 * every remotely-created plan would silently cost a refetch instead of
 * applying. Worse, a future edit that skips the read-back would write a partial
 * plan into the overview connection and blank the list. This pins the two
 * together by field name, ignoring aliases — which is exactly what the cache
 * keys on.
 */
import type {
  DocumentNode,
  FieldNode,
  SelectionSetNode,
  FragmentDefinitionNode,
} from 'graphql';
import { MealPlanEventsDocument } from '#features/mealPlan/graphql/mealPlan.generated';
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

/** The `... on MealPlan` branch of the subscription's `node` union. */
function mealPlanBranch(document: DocumentNode): SelectionSetNode {
  // Stale or failed codegen leaves the export undefined while `tsc` still sees
  // the symbol. Say so, rather than dying on `.definitions` of undefined.
  if (!document) {
    throw new Error(
      'MealPlanEventsDocument is undefined — run `npm run codegen` (the generated document is stale)',
    );
  }

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
  it('pushes every field MealPlanDisplay reads', () => {
    // Built here, not at module scope: the generated documents import each
    // other, so a module-level array can capture a binding before it resolves.
    const fragments = collectFragments([
      MealPlanDisplayFragmentDoc,
      MealPlanEventsDocument,
    ]);
    const fragment = fragments.get('MealPlanDisplay');
    if (!fragment) throw new Error('MealPlanDisplay fragment not found');

    const required = fieldPaths(fragment.selectionSet, fragments);
    const pushed = new Set(
      fieldPaths(mealPlanBranch(MealPlanEventsDocument), fragments),
    );

    // Sanity: the walk found a real fragment, not an empty one. Guards against
    // a future refactor that hides every field behind an unresolved spread.
    expect(required.length).toBeGreaterThan(10);
    expect(required).toContain('home.myMembership.role');

    const missing = required.filter(path => !pushed.has(path));
    expect(missing).toEqual([]);
  });
});
