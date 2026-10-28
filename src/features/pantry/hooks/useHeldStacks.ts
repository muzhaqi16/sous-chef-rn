import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import {
  HeldStacksDocument,
  UseHeldStacks_PantryFragmentDoc,
  UseHeldStacks_PantryItemFragmentDoc,
  type UseHeldStacks_PantryItemFragment,
} from './useHeldStacks.generated';

/** A held stack's amount as its row reads it: what `formatHeldAmount` takes. */
export type HeldStack = UseHeldStacks_PantryItemFragment;

// More stacks of one item than any pantry holds.
const STACKS_PAGE_SIZE = 20;

const byAge = (a: HeldStack, b: HeldStack) =>
  a.createdAt.localeCompare(b.createdAt);

/**
 * The pantry's stacks of `itemId`, live, and the two a scan's add names: the
 * one whose unit the amount starts in, and the one an add joins. Client mode
 * holds every row in the cache; server mode asks for the item's stacks.
 */
export function useHeldStacks(
  pantryId: string | null | undefined,
  itemId: string,
) {
  const rows = useFragment({
    fragment: UseHeldStacks_PantryFragmentDoc,
    fragmentName: 'useHeldStacks_pantry',
    from: pantryId ? { __typename: 'Pantry', id: pantryId } : null,
    variables: {
      itemsFirst: undefined,
      itemsCursor: undefined,
      itemsFilter: undefined,
      itemsOrderBy: undefined,
    },
  });
  const listedIds = rows.complete
    ? rows.data.itemsConnection.edges.flatMap(({ node }) =>
        node.item.id === itemId ? [node.id] : [],
      )
    : null;

  const asked = useQuery(
    HeldStacksDocument,
    pantryId && !listedIds
      ? {
          variables: { pantryId, itemId, stacksFirst: STACKS_PAGE_SIZE },
          fetchPolicy: 'cache-first',
        }
      : skipToken,
  );
  // `skipToken` keeps the last run's answer, which may be another item's.
  const askedFor =
    asked.variables.pantryId === pantryId && asked.variables.itemId === itemId;
  const askedIds =
    askedFor && asked.data?.pantry
      ? asked.data.pantry.itemsConnection.edges.map(({ node }) => node.id)
      : null;

  const ids = listedIds ?? askedIds ?? [];
  // A writer can list another item's row under the filtered connection.
  const stacks = useFragmentList({
    fragment: UseHeldStacks_PantryItemFragmentDoc,
    fragmentName: 'useHeldStacks_pantryItem',
    from: ids.map(id => ({ __typename: 'PantryItem', id })),
  }).filter((stack): stack is HeldStack => !!stack && stack.item.id === itemId);
  const oldestFirst = [...stacks].sort(byAge);
  // An item can be held both by the carton and in mL: the count leads.
  const seed =
    stacks.find(stack => stack.unit.type === UnitType.Count) ?? stacks[0];

  return {
    /** The unit the amount starts in; null while the pantry holds none known. */
    seedUnit: seed ? { id: seed.unit.id, type: seed.unit.type } : null,
    /**
     * The stack an add counted in `unitId` joins, as the API picks it: the
     * oldest in that unit, else the oldest held.
     */
    joinedIn: (unitId: string | null | undefined) =>
      oldestFirst.find(stack => stack.unit.id === unitId) ??
      oldestFirst[0] ??
      null,
  };
}
