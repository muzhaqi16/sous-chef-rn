import { useFragment } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import {
  ShoppingListCollaboratorFragmentDoc,
  ShoppingListOwnershipFragmentDoc,
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
 * Reads the collaborator and ownership fragments live, then derives the
 * permissions from them: a role change edits only those entities. Reads by
 * CACHE KEY (`{ __typename, id }`), since `listDetails` may be a plain object.
 */
export function useShoppingListPermissions(
  listDetails: ListDetails | null | undefined,
  userId: string | undefined,
): ShoppingListPermissions {
  const collaboratorNodes = useFragmentList({
    fragment: ShoppingListCollaboratorFragmentDoc,
    fragmentName: 'ShoppingListCollaboratorFragment',
    from:
      listDetails?.collaboratorsConnection?.edges.map(e => ({
        __typename: 'ShoppingListCollaborator',
        id: e.node.id,
      })) ?? [],
  });

  const ownershipRef = listDetails?.ownerships?.[0];
  const ownership = useFragment({
    fragment: ShoppingListOwnershipFragmentDoc,
    fragmentName: 'ShoppingListOwnershipFragment',
    from: ownershipRef
      ? { __typename: 'ShoppingListOwnership', id: ownershipRef.id }
      : null,
  });

  if (!listDetails) return NOTHING_ALLOWED;

  const permissions = getShoppingListPermissionsWithOwner(
    {
      homeId: listDetails.homeId,
      collaboratorsConnection: {
        edges: collaboratorNodes.map(node => ({ node })),
      },
      ownership: ownership.complete ? ownership.data : null,
    },
    userId,
    listDetails.home?.myMembership ?? null,
  );

  return { ...permissions, resolved: true };
}
