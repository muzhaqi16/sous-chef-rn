import { skipToken, useQuery } from '@apollo/client/react';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useDataState } from '#hooks/data/useDataState';
import { useUser } from '#store/useAppStore';
import { GetMyPendingInvitesDocument } from './useOnboardingInvites.generated';

/** The account's pending home invitations, for the setup screen's cards. */
export function useOnboardingInvites() {
  const userId = useUser()?.id;
  const { data, loading, error, refetch } = useQuery(
    GetMyPendingInvitesDocument,
    userId ? {} : skipToken,
  );
  const held = usePreservedQueryData(data, undefined, userId ?? '');
  const invites = extractNodes(held?.me?.pendingHomeInvitesConnection);
  const state = useDataState({
    loading,
    error,
    hasResult: held !== undefined,
    isEmpty: invites.length === 0,
    skipped: !userId,
  });
  return {
    invites,
    loading: !userId || (loading && !held),
    state,
    refetch,
  };
}
