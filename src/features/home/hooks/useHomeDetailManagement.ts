import { useState } from 'react';
import { alertService } from '#/services/alertService';
import { localizedErrorMessage } from '#/services/errorService';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import { HomeDetailScreen_HomeFragmentDoc } from '#features/home/screens/HomeDetailScreen.generated';
import {
  GetHomeDocument,
  UpdateHomeDocument,
  EnableHomeJoinLinkDocument,
  UpdateHomeJoinCodeDocument,
  TransferHomeOwnershipDocument,
  UpdateMembershipDocument,
  RemoveMemberDocument,
  DeleteHomeInviteDocument,
  LeaveHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { useMarkHomeAsDefault } from '#features/home/hooks/useMarkHomeAsDefault';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

/** The per-member permission overrides `updateMembership` accepts. */
export type MembershipPermissionKey =
  | 'canAddItems'
  | 'canRemoveItems'
  | 'canEditPantry'
  | 'canViewPantry'
  | 'canInviteOthers'
  | 'canManageHome';
import { t } from '#/i18n';
// Interpolated key — the module-level t takes a fallback, not options.
import { getI18n } from '#/i18n/config';
import {
  createRemoveFromParentConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import {
  useAppStore,
  useHomeState,
  useSelectedHomeId,
  useSetSelectedPantryId,
} from '#store/useAppStore';
import { errorService } from '#/services/errorService';

export interface RolePickerState {
  visible: boolean;
  membershipId: string;
  currentRole: string;
  memberName: string;
}

/**
 * Key paths, not labels — this array is module-level, so calling t() here would
 * bake in whatever language was active at import time.
 */
export const ROLE_OPTIONS = [
  { labelKey: 'homeRoles.owner', value: MembershipRole.Owner },
  { labelKey: 'labels.admin', value: MembershipRole.Admin },
  { labelKey: 'homeRoles.member', value: MembershipRole.Member },
  { labelKey: 'labels.guest', value: MembershipRole.Guest },
];

const INITIAL_ROLE_PICKER_STATE: RolePickerState = {
  visible: false,
  membershipId: '',
  currentRole: '',
  memberName: '',
};

/**
 * Custom hook for HomeDetailScreen business logic
 * Manages home details, members, and invites
 */
export function useHomeDetailManagement(homeId: string) {
  // Store state and actions for managing selections after leaving
  const selectedHomeId = useSelectedHomeId();
  const { setSelectedHomeId } = useHomeState();
  const setSelectedPantryId = useSetSelectedPantryId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, then fetches full HomeFragment
  // - errorPolicy: 'all' returns cached data AND errors (needed to distinguish "not found" from "failed to load")

  // Query
  const { data, loading, error, refetch } = useQuery(GetHomeDocument, {
    variables: { homeId },
  });

  // Mutations
  const [updateHomeMutation, { loading: updating }] = useMutation(
    UpdateHomeDocument,
    {
      // Mutation returns updated scalar fields; Apollo auto-merges by __typename + id
      onError: error => {
        alertService.alert(
          t('labels.error'),
          // Code-resolved, with this site's own copy as the fallback. The
          // server's `message` is English by construction.
          localizedErrorMessage(error, t('errors.updateHomeNameFailed')),
        );
      },
    },
  );
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const [enableJoinLinkMutation] = useMutation(EnableHomeJoinLinkDocument);
  const [rotateJoinCodeMutation, { loading: rotatingJoinCode }] = useMutation(
    UpdateHomeJoinCodeDocument,
  );
  const [transferOwnershipMutation, { loading: transferringOwnership }] =
    useMutation(TransferHomeOwnershipDocument);

  // No update callback: the response spreads HomeMemberCard_member, so Apollo
  // normalizes role and the can* permission fields by Membership id. A manual
  // cache.modify here would also run for permission-only toggles, where
  // variables.input.role is undefined — and a modify writing undefined deletes
  // the field, blanking the member card.
  // Error/rejection handling lives in handleRoleSelect so a resolved
  // ForbiddenError member is surfaced (it doesn't throw under errorPolicy:'all').
  const [updateMembershipMutation] = useMutation(UpdateMembershipDocument);

  const [removeMemberMutation] = useMutation(RemoveMemberDocument, {
    update(cache, { data }, { variables }) {
      if (
        data?.removeMember?.__typename !== 'RemoveMemberPayload' ||
        !variables
      ) {
        return;
      }

      try {
        const removeFromMembersCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'membersConnection',
          'Membership',
        );
        removeFromMembersCache(cache, homeId, variables.input.membershipId, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for removeMember:',
        });
      }
    },
    onError: error => {
      handleMutationError(error, {
        operation: 'Remove Member',
        checks: [
          versionConflictCheck({
            itemName: t('errors.entityMember'),
            onRefresh: () => refetch(),
          }),
        ],
      });
    },
  });

  const [revokeInviteMutation] = useMutation(DeleteHomeInviteDocument, {
    update(cache, { data }, { variables }) {
      if (
        data?.deleteHomeInvite?.__typename !== 'DeleteHomeInvitePayload' ||
        !variables
      ) {
        return;
      }

      try {
        const removeFromInvitesCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'invitesConnection',
          'HomeInvite',
        );
        removeFromInvitesCache(cache, homeId, variables.input.id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for revokeInvite:',
        });
      }
    },
    onError: error => {
      handleMutationError(error, {
        operation: 'Revoke Invitation',
        checks: [
          versionConflictCheck({
            itemName: t('errors.entityInvite'),
            onRefresh: () => refetch(),
          }),
        ],
      });
    },
  });

  const { markAsDefault } = useMarkHomeAsDefault();

  const [leaveHomeMutation, { loading: leaving, client: leaveClient }] =
    useMutation(LeaveHomeDocument, {
      update(cache, { data }) {
        if (data?.leaveHome?.__typename !== 'LeaveHomePayload') return;

        try {
          safeEvict(cache, 'Home', homeId);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for leaveHome:',
          });
        }
      },
      onCompleted: data => {
        if (
          data?.leaveHome?.__typename === 'LeaveHomePayload' &&
          homeId === selectedHomeId
        ) {
          // Read remaining homes from cache
          const cachedData = leaveClient.cache.readQuery({
            query: GetHomesDocument,
          });
          const remainingHomes = extractNodes(cachedData?.homes);

          if (remainingHomes.length > 0) {
            const newDefaultHome = remainingHomes[0];
            setSelectedHomeId(newDefaultHome.id);
            setSelectedPantryId(null);
            void markAsDefault(newDefaultHome.id).then(({ status }) => {
              if (status === 'refused' || status === 'failed') {
                handleMutationError(new Error(`markHomeAsDefault ${status}`), {
                  operation: 'Set Default Home After Leave',
                  showAlert: false,
                });
              }
            });
          } else {
            setSelectedHomeId(null);
            setSelectedPantryId(null);
          }
          // Clear shopping list selection (may have belonged to left home)
          setSelectedShoppingListId(null);
        }
      },
      // Error/rejection handling lives in the leaveHome action below; onCompleted
      // (above) runs only on the success payload.
    });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error.
  // Then unmask via useFragment so consumers (and this hook) see the full
  // HomeDetailScreen_home shape — fields, members/invite edges, myMembership.
  //
  // useFragment reads from `{ __typename, id }` rather than the masked
  // `data?.home` ref so it always resolves the cache entry by key. When the
  // fragment isn't fully in cache yet, `complete` is false and we fall back
  // to null so the screen shows the loader instead of rendering with
  // partial data (which would, e.g., make the owner look like a non-owner
  // because `myMembership.role` isn't populated yet).
  const homeRef = usePreservedQueryData(data?.home, null);
  const { data: unmaskedData, complete: unmaskedComplete } = useFragment({
    fragment: HomeDetailScreen_HomeFragmentDoc,
    fragmentName: 'HomeDetailScreen_home',
    from: homeRef ? { __typename: 'Home', id: homeId } : null,
  });
  const home = homeRef && unmaskedComplete ? unmaskedData : null;

  // CRUD operations utilities
  const { createRemoveOperation } = useCrudOperations();

  // Handler functions
  const saveName = async (name: string) => {
    // The server requires the version for the optimistic-concurrency check.
    if (!home) return;
    await updateHomeMutation({
      variables: {
        input: { id: homeId, name, version: home.version },
      },
    });
  };

  // Role picker state (drives ModalPicker in the screen)
  const [rolePickerState, setRolePickerState] = useState<RolePickerState>(
    INITIAL_ROLE_PICKER_STATE,
  );

  const openRolePicker = (
    membershipId: string,
    currentRole: string,
    memberName: string,
  ) => {
    setRolePickerState({
      visible: true,
      membershipId,
      currentRole,
      memberName,
    });
  };

  const closeRolePicker = () => {
    setRolePickerState(INITIAL_ROLE_PICKER_STATE);
  };

  const handleRoleSelect = async (value: string) => {
    const { membershipId, currentRole } = rolePickerState;
    closeRolePicker();
    if (value === currentRole) return;

    let result;
    try {
      result = await updateMembershipMutation({
        variables: {
          input: { id: membershipId, role: value as MembershipRole },
        },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Update Member Role' });
    }
    if (!result) return;
    alertIfRejected(result, t('errors.updateMemberRoleFailed'));
  };

  // Toggle a single membership permission override. updateMembership returns the
  // updated member (HomeMemberCard_member), so Apollo normalizes it and the
  // toggle reflects the server state.
  const updateMemberPermission = async (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => {
    let result;
    try {
      result = await updateMembershipMutation({
        variables: { input: { id: membershipId, [permission]: value } },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Update Member Permission' });
    }
    if (!result) return false;
    return !alertIfRejected(result, t('errors.updateMemberRoleFailed'));
  };

  const removeMember = (membershipId: string, memberName: string) => {
    const operation = createRemoveOperation({
      mutation: removeMemberMutation,
      itemId: membershipId,
      confirmTitle: t('confirmations.removeMemberTitle'),
      confirmMessage: t('confirmations.removeMemberNamed', {
        name: memberName,
      }),
      operationName: 'Remove Member',
    });
    return operation();
  };

  const revokeInvite = (inviteId: string, inviteEmail: string) => {
    const operation = createRemoveOperation({
      mutation: revokeInviteMutation,
      itemId: inviteId,
      confirmTitle: t('confirmations.revokeInviteTitle'),
      confirmMessage: t('confirmations.revokeInviteNamed', {
        name: inviteEmail,
      }),
      operationName: 'Revoke Invitation',
    });
    return operation();
  };

  const leaveHome = (homeName: string): Promise<boolean> => {
    return new Promise(resolve => {
      alertService.alert(
        t('labels.leaveHome'),
        getI18n().t('home.leaveBody', { name: homeName }),
        [
          {
            text: t('labels.cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t('labels.leave'),
            style: 'destructive',
            onPress: async () => {
              let result;
              try {
                result = await leaveHomeMutation({
                  variables: { input: { homeId } },
                });
              } catch (error) {
                handleMutationError(error, { operation: 'Leave Home' });
              }
              if (!result) {
                resolve(false);
                return;
              }
              if (alertIfRejected(result, t('errors.codes.genericRetry'))) {
                resolve(false);
                return;
              }
              resolve(true);
            },
          },
        ],
      );
    });
  };

  const toggleJoinCode = async (enabled: boolean) => {
    // Only minting a join link is gated; revoking one stays available so an
    // unverified account can always close off a home it already opened.
    if (enabled && !requireVerifiedEmail()) return;

    if (enabled) {
      // Dedicated mutation: mints a joinCode + join link server-side.
      let result;
      try {
        result = await enableJoinLinkMutation({
          variables: { input: { id: homeId } },
        });
      } catch (error) {
        handleMutationError(error, { operation: 'Enable Join Link' });
      }
      alertIfRejected(result, t('errors.updateHomeFailed'));
      return;
    }
    // No disableHomeJoinLink mutation — clear the flag via updateHome. Same
    // rejection surface as the enable branch: a resolved error member never
    // fires onError under errorPolicy:'all', so classify the result here.
    if (!home) return;
    const result = await updateHomeMutation({
      variables: {
        input: { id: homeId, allowJoinCode: false, version: home.version },
      },
    });
    alertIfRejected(result, t('errors.updateHomeFailed'));
  };

  // Hand the home off to another member. The server flips the OWNER role; the
  // response carries the refreshed membersConnection so roles update in-place.
  const transferOwnership = async (newOwnerId: string) => {
    let result;
    try {
      result = await transferOwnershipMutation({
        variables: { input: { homeId, newOwnerId } },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Transfer Home Ownership' });
    }
    if (!result) return false;
    return !alertIfRejected(result, t('errors.updateHomeFailed'));
  };

  // Rotate the join code to invalidate a leaked link.
  const rotateJoinCode = async () => {
    let result;
    try {
      result = await rotateJoinCodeMutation({
        variables: { input: { id: homeId } },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Rotate Join Code' });
    }
    if (!result) return false;
    return !alertIfRejected(result, t('errors.updateHomeFailed'));
  };

  return {
    // Data
    home,
    loading,
    error,
    updating,
    leaving,
    refetch,

    // Role picker
    rolePickerState,
    handleRoleSelect,
    closeRolePicker,

    // Actions
    saveName,
    changeRole: openRolePicker,
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
