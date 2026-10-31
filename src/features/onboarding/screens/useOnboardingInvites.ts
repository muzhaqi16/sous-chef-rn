import { skipToken, useQuery } from '@apollo/client/react';
import { extractNodes } from '#/utils/connectionUtils';
import { useUser } from '#store/useAppStore';
import { GetMyPendingInvitesDocument } from './useOnboardingInvites.generated';

/** The account's pending home invitations, for the setup screen's cards. */
export function useOnboardingInvites() {
  const userId = useUser()?.id;
  const { data, loading } = useQuery(
    GetMyPendingInvitesDocument,
    userId ? {} : skipToken,
  );
  return {
    invites: extractNodes(data?.me?.pendingHomeInvitesConnection),
    loading: !userId || (loading && !data),
  };
}
