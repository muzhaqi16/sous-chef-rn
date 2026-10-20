import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import {
  useInvitationActions,
  type InvitationWriteResult,
} from '#features/notifications/hooks/useInvitationActions';
import { useUserId } from '#store/useAppStore';
import { presentFailure } from '#/utils/errors/presentFailure';
import {
  AcceptInvite_ShoppingListInviteFragmentDoc,
  AcceptInvite_HomeInviteFragmentDoc,
  GetHomeInviteByTokenDocument,
  GetShoppingListInviteByTokenDocument,
  type AcceptInvite_ShoppingListInviteFragment,
  type AcceptInvite_HomeInviteFragment,
} from '#features/shoppingList/screens/AcceptInvite.generated';

import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';

export type InvitationType = 'shopping_list' | 'home' | 'unknown';

/** False when the write failed, after alerting why. */
const answered = (result: InvitationWriteResult): boolean => {
  if (result.status === 'done') return true;
  presentFailure(result.failure);
  return false;
};

/**
 * Resolve an invite straight from a deep-link token, and accept or decline it.
 * The token is the credential because the invite may not be in the user's
 * cached pending list on a fresh device.
 */
export function useInviteByToken(token: string | undefined) {
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  // No notification behind a link: the invite is named by its token alone.
  const { acceptHome, acceptList, declineHome, declineList } =
    useInvitationActions(null, useUserId() ?? null);
  const { data: homeInviteData, loading: homeInviteLoading } = useQuery(
    GetHomeInviteByTokenDocument,
    token ? { variables: { token } } : skipToken,
  );
  const { data: listInviteData, loading: listInviteLoading } = useQuery(
    GetShoppingListInviteByTokenDocument,
    token ? { variables: { token } } : skipToken,
  );

  const shoppingListInvite = listInviteData?.shoppingListInviteByToken ?? null;
  const homeInvite = homeInviteData?.homeInviteByToken ?? null;

  // Unmask display fields (pattern B — resilient fallback). The queries already
  // select these, so the cache has them without a spread.
  const listFragment = useFragment({
    fragment: AcceptInvite_ShoppingListInviteFragmentDoc,
    fragmentName: 'AcceptInvite_shoppingListInvite',
    from: shoppingListInvite ?? null,
  });
  const homeFragment = useFragment({
    fragment: AcceptInvite_HomeInviteFragmentDoc,
    fragmentName: 'AcceptInvite_homeInvite',
    from: homeInvite ?? null,
  });

  const invitationType: InvitationType = shoppingListInvite
    ? 'shopping_list'
    : homeInvite
    ? 'home'
    : 'unknown';

  // An unresolved invite has nothing to send; the screen explains it first.
  const accept = async (inviteToken: string): Promise<boolean> => {
    if (invitationType === 'unknown') return false;
    // The API refuses an accept from an unverified email; the gate says so and
    // offers the way to verify, with the invite still pending afterwards.
    if (!requireVerifiedEmail()) return false;
    return answered(
      invitationType === 'home'
        ? await acceptHome(inviteToken)
        : await acceptList(inviteToken),
    );
  };

  const decline = async (inviteToken: string): Promise<boolean> => {
    if (invitationType === 'unknown') return false;
    return answered(
      invitationType === 'home'
        ? await declineHome(inviteToken)
        : await declineList(inviteToken),
    );
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
