import { NetworkStatus } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetShoppingListDetailsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListCollaboratorFragmentDoc,
  ShoppingListOwnershipFragmentDoc,
  type ShoppingListCollaboratorFragment,
  type ShoppingListOwnershipFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';

export function useShoppingListDetails(listId: string | undefined) {
  const client = useApolloClient();
  // Fetch policies per docs/apollo-client-patterns.md:
  // - cache-and-network: Shows cache immediately, fetches fresh in background
  // - nextFetchPolicy: cache-first prevents re-fetch on re-render/tab switch
  // - notifyOnNetworkStatusChange: lets Apollo emit a re-render when the
  //   network status transitions (used by RefreshControl in ShareList).
  const { data, loading, error, refetch, networkStatus } = useQuery(
    GetShoppingListDetailsDocument,
    {
      variables: { id: listId ?? '' },
      skip: !listId,
      errorPolicy: 'ignore',
      notifyOnNetworkStatusChange: true,
    },
  );

  // Real-time updates via subscription are now handled by SubscriptionProvider.
  // The ShoppingListUpdated subscription automatically updates the cache via
  // Apollo's normalization, eliminating the need for manual client.writeQuery.

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const shoppingList = usePreservedQueryData(data?.shoppingList, null);
  const isRefetching = networkStatus === NetworkStatus.refetch;

  // Materialize masked collaborator + ownership refs once so downstream
  // consumers (ownership helpers, ListSettings, ShareList) read fragment
  // fields directly without each call site re-doing the lookup.
  const isNonNull = <T>(v: T | null): v is T => v !== null;
  const collaborators: ShoppingListCollaboratorFragment[] =
    shoppingList?.collaboratorsConnection?.edges
      .map(edge =>
        client.cache.readFragment<ShoppingListCollaboratorFragment>({
          fragment: ShoppingListCollaboratorFragmentDoc,
          fragmentName: 'ShoppingListCollaboratorFragment',
          from: { __typename: 'ShoppingListCollaborator', id: edge.node.id },
        }),
      )
      .filter(isNonNull) ?? [];
  const ownerships: ShoppingListOwnershipFragment[] =
    shoppingList?.ownerships
      ?.map(o =>
        client.cache.readFragment<ShoppingListOwnershipFragment>({
          fragment: ShoppingListOwnershipFragmentDoc,
          fragmentName: 'ShoppingListOwnershipFragment',
          from: { __typename: 'ShoppingListOwnership', id: o.id },
        }),
      )
      .filter(isNonNull) ?? [];

  return {
    shoppingList,
    loading,
    isRefetching,
    error,
    refetch,
    // Convenience properties
    name: shoppingList?.name || '',
    isDefault: shoppingList?.isDefault || false,
    collaborators,
    ownerships,
    isShared: collaborators.length > 0,
  };
}
