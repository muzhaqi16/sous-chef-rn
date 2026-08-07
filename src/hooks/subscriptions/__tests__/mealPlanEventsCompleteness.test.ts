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

/** Every field path in a selection set, by field NAME — aliases ignored. */
function fieldPaths(selectionSet: SelectionSetNode, prefix = ''): string[] {
  const paths: string[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind !== 'Field') continue;
    const field = selection as FieldNode;
    if (field.name.value === '__typename') continue;

    const path = prefix ? `${prefix}.${field.name.value}` : field.name.value;
    if (field.selectionSet) {
      paths.push(...fieldPaths(field.selectionSet, path));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

/** The `... on MealPlan` branch of the subscription's `node` union. */
function mealPlanBranch(document: DocumentNode): SelectionSetNode {
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
    const fragment = MealPlanDisplayFragmentDoc.definitions.find(
      (def): def is FragmentDefinitionNode =>
        def.kind === 'FragmentDefinition' &&
        def.name.value === 'MealPlanDisplay',
    );
    if (!fragment) throw new Error('MealPlanDisplay fragment not found');

    const required = fieldPaths(fragment.selectionSet);
    const pushed = new Set(fieldPaths(mealPlanBranch(MealPlanEventsDocument)));

    // Sanity: the walk found a real fragment, not an empty one.
    expect(required.length).toBeGreaterThan(10);

    const missing = required.filter(path => !pushed.has(path));
    expect(missing).toEqual([]);
  });
});
