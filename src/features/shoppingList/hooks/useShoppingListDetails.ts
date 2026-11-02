import { skipToken, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { GetShoppingListDetailsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListCollaboratorFragmentDoc,
  ShoppingListOwnershipFragmentDoc,
  type ShoppingListCollaboratorFragment,
  type ShoppingListOwnershipFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';

export function useShoppingListDetails(listId: string | undefined) {
  const {
    data: result,
    variables,
    loading,
    error,
    refetch,
  } = useQuery(
    GetShoppingListDetailsDocument,
    listId ? { variables: { id: listId } } : skipToken,
  );
  useApolloErrorLogger(GetShoppingListDetailsDocument, error);
  // `skipToken` keeps the last run's variables AND data, so a result for a
  // previous list is dropped.
  const data = variables.id === listId ? result : undefined;

  // Real-time updates via subscription are now handled by CoreSubscriptionProvider.
  // The MyShoppingListsEvents subscription automatically updates the cache via
  // Apollo's normalization, eliminating the need for manual client.writeQuery.

  // A failed read answers `undefined`: keep the last answer.
  const shoppingList = usePreservedQueryData(
    data?.shoppingList,
    null,
    listId ?? '',
  );

  // Read live, once, so downstream consumers (ownership helpers, ListSettings,
  // ShareList) read fragment fields directly and follow a role or status edit,
  // which leaves the query result as it was.
  const collaboratorEntries = useFragmentList({
    fragment: ShoppingListCollaboratorFragmentDoc,
    fragmentName: 'ShoppingListCollaboratorFragment',
    from: shoppingList?.collaboratorsConnection.edges.map(e => e.node) ?? [],
  });
  const ownershipEntries = useFragmentList({
    fragment: ShoppingListOwnershipFragmentDoc,
    fragmentName: 'ShoppingListOwnershipFragment',
    from: shoppingList?.ownerships ?? [],
  });
  const collaborators = collaboratorEntries.filter(
    (c): c is ShoppingListCollaboratorFragment => c !== null,
  );
  const ownerships = ownershipEntries.filter(
    (o): o is ShoppingListOwnershipFragment => o !== null,
  );

  return {
    shoppingList,
    loading,
    // A missing list with nothing preserved is a read that failed.
    hasResult: shoppingList !== null,
    refetch: () => (listId ? refetch() : Promise.resolve()),
    name: shoppingList?.name ?? '',
    collaborators,
    ownerships,
    // Counted by entry, so a collaborator not fully cached still counts.
    isShared: collaboratorEntries.length > 0,
  };
}
