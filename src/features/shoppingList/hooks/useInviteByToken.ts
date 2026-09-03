import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  AcceptInvite_ShoppingListInviteFragmentDoc,
  AcceptInvite_HomeInviteFragmentDoc,
  GetHomeInviteByTokenDocument,
  GetShoppingListInviteByTokenDocument,
  type AcceptInvite_ShoppingListInviteFragment,
  type AcceptInvite_HomeInviteFragment,
} from '#features/shoppingList/screens/AcceptInvite.generated';

export type InvitationType = 'shopping_list' | 'home' | 'unknown';

/**
 * Resolve an invite straight from a deep-link token, and accept or decline it.
 * The token is the credential because the invite may not be in the user's
 * cached pending list on a fresh device.
 */
export function useInviteByToken(token: string | undefined) {
  const { data: homeInviteData, loading: homeInviteLoading } = useQuery(
    GetHomeInviteByTokenDocument,
    { variables: { token: token ?? '' }, skip: !token },
  );
  const { data: listInviteData, loading: listInviteLoading } = useQuery(
    GetShoppingListInviteByTokenDocument,
    { variables: { token: token ?? '' }, skip: !token },
  );

  const [acceptShoppingListInvite] = useMutation(
    AcceptShoppingListInviteDocument,
  );
  const [declineShoppingListInvite] = useMutation(
    DeclineShoppingListInviteDocument,
  );
  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument);
  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument);

  const shoppingListInvite = listInviteData?.shoppingListInviteByToken ?? null;
  const homeInvite = homeInviteData?.homeInviteByToken ?? null;

  // Unmask display fields (pattern B — resilient fallback). The queries already
  // select these, so the cache has them without a spread.
  const listFragment = useFragment({
    fragment: AcceptInvite_ShoppingListInviteFragmentDoc,
    fragmentName: 'AcceptInvite_shoppingListInvite',
    from: shoppingListInvite ?? {
      __typename: 'ShoppingListCollaborator',
      id: '',
    },
  });
  const homeFragment = useFragment({
    fragment: AcceptInvite_HomeInviteFragmentDoc,
    fragmentName: 'AcceptInvite_homeInvite',
    from: homeInvite ?? { __typename: 'HomeInvite', id: '' },
  });

  const invitationType: InvitationType = shoppingListInvite
    ? 'shopping_list'
    : homeInvite
    ? 'home'
    : 'unknown';

  const accept = async (inviteToken: string) => {
    if (invitationType === 'shopping_list') {
      await acceptShoppingListInvite({
        variables: { input: { token: inviteToken } },
      });
    } else if (invitationType === 'home') {
      await acceptHomeInvite({ variables: { input: { token: inviteToken } } });
    }
  };

  const decline = async (inviteToken: string) => {
    if (invitationType === 'shopping_list') {
      await declineShoppingListInvite({
        variables: { input: { token: inviteToken } },
      });
    } else if (invitationType === 'home') {
      await declineHomeInvite({ variables: { input: { token: inviteToken } } });
    }
  };

  const shoppingListInviteDisplay: AcceptInvite_ShoppingListInviteFragment | null =
    shoppingListInvite && listFragment.complete ? listFragment.data : null;
  const homeInviteDisplay: AcceptInvite_HomeInviteFragment | null =
    homeInvite && homeFragment.complete ? homeFragment.data : null;

  return {
    invitationType,
    hasInvite: !!shoppingListInvite || !!homeInvite,
    inviteRole:
      (invitationType === 'home'
        ? homeInvite?.role
        : shoppingListInvite?.role) ?? '',
    shoppingListInviteDisplay,
    homeInviteDisplay,
    // Only when there is nothing to show: a warm cache renders the invite while
    // the accompanying network leg is still open.
    loading:
      (homeInviteLoading || listInviteLoading) &&
      !shoppingListInvite &&
      !homeInvite,
    accept,
    decline,
  };
}
