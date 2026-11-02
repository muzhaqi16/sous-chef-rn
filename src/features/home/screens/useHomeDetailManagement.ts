import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useDataState } from '#hooks/data/useDataState';
import { useFragment, useQuery } from '@apollo/client/react';
import { useUpdateHomeFields } from '#features/home/hooks/useUpdateHomeFields';
import { useHomeMembership } from '#features/home/hooks/useHomeMembership';
import type { MembershipPermissionKey } from '#features/home/types';
import { HomeDetailScreen_HomeFragmentDoc } from '#features/home/screens/HomeDetailScreen.generated';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';
import type { MembershipRole } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { cleanName } from '#/utils/validation/common';

/**
 * Custom hook for HomeDetailScreen business logic
 * Manages home details, members, and invites
 */
export function useHomeDetailManagement(homeId: string) {
  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, then fetches full HomeFragment
  // - errorPolicy: 'all' returns cached data AND errors (needed to distinguish "not found" from "failed to load")

  // Query
  const { data, loading, error, refetch } = useQuery(GetHomeDocument, {
    variables: { homeId },
  });

  const { updateHomeFields } = useUpdateHomeFields(homeId);
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const {
    updateMembership,
    removeMember,
    revokeInvite,
    leaveHome,
    leaving,
    enableJoinLink,
    rotateJoinCode,
    rotatingJoinCode,
    transferOwnership,
    transferringOwnership,
  } = useHomeMembership(homeId, {
    onConflictRefresh: () => {
      void refetch();
    },
  });

  // `errorPolicy: 'ignore'` yields undefined on error, so the last good data is
  // kept. `!complete` shows the loader: partial data renders an owner as a
  // non-owner while `myMembership.role` is absent.
  const homeRef = usePreservedQueryData(data?.home, null, homeId);
  const { data: unmaskedData, complete: unmaskedComplete } = useFragment({
    fragment: HomeDetailScreen_HomeFragmentDoc,
    fragmentName: 'HomeDetailScreen_home',
    from: homeRef ? { __typename: 'Home', id: homeId } : null,
  });
  const home = homeRef && unmaskedComplete ? unmaskedData : null;
  // An answer naming no home is not found, never a failed load.
  const homeState = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: !home,
  });

  /**
   * Local-first: an absolute field set keyed by the home id, written to the
   * cache before firing and idempotent on a queued replay. The server requires
   * the version for its optimistic-concurrency check.
   */
  const saveName = async (typed: string) => {
    const name = cleanName(typed);
    if (!home || !name) return;
    await updateHomeFields({ name }, home, t('errors.updateHomeNameFailed'));
  };

  const changeRole = (membershipId: string, role: MembershipRole) =>
    updateMembership(membershipId, { role });

  // Toggle a single membership permission override. updateMembership returns the
  // updated member (HomeMemberCard_member), so Apollo normalizes it and the
  // toggle reflects the server state.
  const updateMemberPermission = (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => updateMembership(membershipId, { [permission]: value });

  const toggleJoinCode = async (enabled: boolean) => {
    // Only minting a join link is gated; revoking one stays available so an
    // unverified account can always close off a home it already opened.
    if (enabled && !requireVerifiedEmail()) return;

    if (enabled) {
      await enableJoinLink();
      return;
    }
    // No disableHomeJoinLink mutation — the flag is cleared via updateHome.
    if (!home) return;
    await updateHomeFields(
      { allowJoinCode: false },
      home,
      t('errors.updateHomeFailed'),
    );
  };

  return {
    // Data
    home,
    homeState,
    leaving,
    refetch,

    // Actions
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
    rotateJoinCode,
    rotatingJoinCode,
    transferOwnership,
    transferringOwnership,
    updateMemberPermission,
  };
}
