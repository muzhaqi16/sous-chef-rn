import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { invitationRefusalCopy } from '#/domain/invitationRefusal';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
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

/** False when the write failed; the failure is already alerted. */
const settleInvite = async (
  run: () => Promise<{ data?: unknown; error?: unknown }>,
  document: DocumentNode,
  fallback: string,
): Promise<boolean> => {
  const settled = await settleMutation(run, {
    document,
    fallback,
    copy: invitationRefusalCopy(),
  });
  return settled.status !== 'failed';
};

/**
 * Resolve an invite straight from a deep-link token, and accept or decline it.
 * The token is the credential because the invite may not be in the user's
 * cached pending list on a fresh device.
 */
export function useInviteByToken(token: string | undefined) {
  const { t } = useTranslation();
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

  // An unresolved invite has nothing to send; the screen explains it first.
  const accept = async (inviteToken: string): Promise<boolean> => {
    if (invitationType === 'unknown') return false;
    const variables = { input: { token: inviteToken } };
    const fallback = t('invitationAcceptance.acceptFailed');
    if (invitationType === 'home') {
      return settleInvite(
        () => acceptHomeInvite({ variables }),
        AcceptHomeInviteDocument,
        fallback,
      );
    }
    return settleInvite(
      () => acceptShoppingListInvite({ variables }),
      AcceptShoppingListInviteDocument,
      fallback,
    );
  };

  const decline = async (inviteToken: string): Promise<boolean> => {
    if (invitationType === 'unknown') return false;
    const variables = { input: { token: inviteToken } };
    const fallback = t('invitationAcceptance.declineFailed');
    if (invitationType === 'home') {
      return settleInvite(
        () => declineHomeInvite({ variables }),
        DeclineHomeInviteDocument,
        fallback,
      );
    }
    return settleInvite(
      () => declineShoppingListInvite({ variables }),
      DeclineShoppingListInviteDocument,
      fallback,
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
