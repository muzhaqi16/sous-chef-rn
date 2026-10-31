import { useApolloClient } from '@apollo/client/react';
import { buildJoinHomeUrl } from '#/utils/deepLinkUrls';
import { useHomeMembership } from '#features/home/hooks/useHomeMembership';
import { UseHouseholdInvite_HomeFragmentDoc } from './useHouseholdInvite.generated';

/** A link that joins the user's home, for the people they cook for. */
export function useHouseholdInvite(homeId: string) {
  const client = useApolloClient();
  const { enableJoinLink } = useHomeMembership(homeId);

  /**
   * The home's join link, minting one first. Null when none could be made:
   * a refusal has been alerted, and a queued mint has no code yet.
   */
  const inviteLink = async (): Promise<string | null> => {
    if (!(await enableJoinLink())) return null;
    // Read after the write lands, in a handler: never while rendering.
    const home = client.cache.readFragment({
      fragment: UseHouseholdInvite_HomeFragmentDoc,
      fragmentName: 'useHouseholdInvite_home',
      id: client.cache.identify({ __typename: 'Home', id: homeId }),
      optimistic: true,
    });
    if (!home?.joinCode) return null;
    return home.joinLink?.universal ?? buildJoinHomeUrl(home.joinCode);
  };

  return { inviteLink };
}
