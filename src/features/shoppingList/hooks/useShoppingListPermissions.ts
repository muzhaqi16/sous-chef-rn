import { useApolloClient } from '@apollo/client/react';
import {
  ShoppingListCollaboratorFragmentDoc,
  ShoppingListOwnershipFragmentDoc,
  type ShoppingListCollaboratorFragment,
  type ShoppingListOwnershipFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { getShoppingListPermissionsWithOwner } from '#features/shoppingList/utils/shoppingListPermissions';

/** What the caller may do to the list it is showing. */
export interface ShoppingListPermissions {
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  /**
   * False while the answer is unknown. Absence is not temporary — the detail
   * query can fail, or the list can come from a cache that never held it — so
   * the flags above stay false rather than falling back to allowed.
   */
  resolved: boolean;
}

const NOTHING_ALLOWED: ShoppingListPermissions = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
  resolved: false,
};

/** The membership shape the permission resolver accepts, without re-declaring it. */
type HomeMembership = Parameters<typeof getShoppingListPermissionsWithOwner>[2];

interface ListDetails {
  homeId?: string | null;
  collaboratorsConnection?: { edges: { node: { id: string } }[] } | null;
  ownerships?: readonly { id: string }[] | null;
  home?: { myMembership?: HomeMembership } | null;
}

/**
 * Materializes the collaborator and ownership fragments, then derives the
 * permissions from them. Reads by CACHE KEY (`{ __typename, id }`) — passing a
 * masked ref returns partial or null data under `dataMasking`, which drops an
 * owner of a personal list through to no permissions.
 */
export function useShoppingListPermissions(
  listDetails: ListDetails | null | undefined,
  userId: string | undefined,
): ShoppingListPermissions {
  const client = useApolloClient();
  if (!listDetails) return NOTHING_ALLOWED;

  const collaboratorNodes =
    listDetails.collaboratorsConnection?.edges.map(e =>
      client.cache.readFragment<ShoppingListCollaboratorFragment>({
        fragment: ShoppingListCollaboratorFragmentDoc,
        fragmentName: 'ShoppingListCollaboratorFragment',
        from: { __typename: 'ShoppingListCollaborator', id: e.node.id },
      }),
    ) ?? [];

  const ownershipRef = listDetails.ownerships?.[0];
  const ownershipNode = ownershipRef
    ? client.cache.readFragment<ShoppingListOwnershipFragment>({
        fragment: ShoppingListOwnershipFragmentDoc,
        fragmentName: 'ShoppingListOwnershipFragment',
        from: { __typename: 'ShoppingListOwnership', id: ownershipRef.id },
      })
    : null;

  const permissions = getShoppingListPermissionsWithOwner(
    {
      homeId: listDetails.homeId,
      collaboratorsConnection: {
        edges: collaboratorNodes.map(node => ({ node })),
      },
      ownership: ownershipNode,
    },
    userId,
    listDetails.home?.myMembership ?? null,
  );

  return { ...permissions, resolved: true };
}
