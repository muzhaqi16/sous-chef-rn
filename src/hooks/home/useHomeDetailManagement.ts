import { useState } from 'react';
import { alertService } from '#/services/alertService';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import { HomeDetailScreen_HomeFragmentDoc } from '#/screens/home/HomeDetailScreen.generated';
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
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

/** The per-member permission overrides `updateMembership` accepts. */
export type MembershipPermissionKey =
  | 'canAddItems'
  | 'canRemoveItems'
  | 'canEditPantry'
  | 'canViewPantry'
  | 'canInviteOthers'
  | 'canManageHome';
import { t } from '#/i18n/t';
import {
  createRemoveFromParentConnectionUpdater,
  safeEvict,
  setCachedFields,
} from '#/apollo/utils/cacheUpdaters';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import {
  useAppStore,
  useHomeState,
  useSelectedHomeId,
  useSetSelectedPantryId,
} from '#store/useAppStore';

export interface RolePickerState {
  visible: boolean;
  membershipId: string;
  currentRole: string;
  memberName: string;
}

export const ROLE_OPTIONS = [
  { label: 'Owner', value: MembershipRole.Owner },
  { label: 'Admin', value: MembershipRole.Admin },
  { label: 'Member', value: MembershipRole.Member },
  { label: 'Guest', value: MembershipRole.Guest },
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
          'Error',
          error.message || t('errors.updateHomeNameFailed'),
        );
      },
    },
  );
  const [enableJoinLinkMutation] = useMutation(EnableHomeJoinLinkDocument);
  const [rotateJoinCodeMutation, { loading: rotatingJoinCode }] = useMutation(
    UpdateHomeJoinCodeDocument,
  );
  const [transferOwnershipMutation, { loading: transferringOwnership }] =
    useMutation(TransferHomeOwnershipDocument);

  const [updateMembershipMutation] = useMutation(UpdateMembershipDocument, {
    // Use cache.modify to update the membership role field
    update(cache, { data }, { variables }) {
      if (
        data?.updateMembership?.__typename !== 'UpdateMembershipPayload' ||
        !variables
      ) {
        return;
      }

      const membershipId = variables.input.id;
      const newRole = variables.input.role;

      setCachedFields(cache, 'Membership', membershipId, {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
    },
    // Error/rejection handling lives in handleRoleSelect so a resolved
    // ForbiddenError member is surfaced (it doesn't throw under errorPolicy:'all').
  });

  const [removeMemberMutation] = useMutation(RemoveMemberDocument, {
    update(cache, { data }, { variables }) {
      if (
        data?.removeMember?.__typename !== 'RemoveMemberPayload' ||
        !variables
      ) {
        return;
      }

      executeCacheUpdate(() => {
        const removeFromMembersCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'membersConnection',
          'Membership',
        );
        removeFromMembersCache(cache, homeId, variables.input.membershipId, {
          evictItem: true,
        });
      }, 'Cache update failed for removeMember:');
    },
    onError: error => {
      handleMutationError(error, {
        operation: 'Remove Member',
        checks: [
          versionConflictCheck({
            itemName: 'Member',
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

      executeCacheUpdate(() => {
        const removeFromInvitesCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'invitesConnection',
          'HomeInvite',
        );
        removeFromInvitesCache(cache, homeId, variables.input.id, {
          evictItem: true,
        });
      }, 'Cache update failed for revokeInvite:');
    },
    onError: error => {
      handleMutationError(error, {
        operation: 'Revoke Invitation',
        checks: [
          versionConflictCheck({
            itemName: 'Invite',
            onRefresh: () => refetch(),
          }),
        ],
      });
    },
  });

  const [setDefaultHomeMutation] = useMutation(MarkHomeAsDefaultDocument);

  const [leaveHomeMutation, { loading: leaving, client: leaveClient }] =
    useMutation(LeaveHomeDocument, {
      update(cache, { data }) {
        if (data?.leaveHome?.__typename !== 'LeaveHomePayload') return;

        executeCacheUpdate(() => {
          safeEvict(cache, 'Home', homeId);
        }, 'Cache update failed for leaveHome:');
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
            setDefaultHomeMutation({
              variables: { input: { homeId: newDefaultHome.id } },
            }).catch(err => {
              console.warn('Failed to set new default home after leave:', err);
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
    await updateHomeMutation({
      variables: {
        input: { id: homeId, name },
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

    const result = await executeMutation(
      () =>
        updateMembershipMutation({
          variables: {
            input: { id: membershipId, role: value as MembershipRole },
          },
        }),
      error => handleMutationError(error, { operation: 'Update Member Role' }),
    );
    if (!result) return;
    alertIfRejected(
      result,
      'updateMembership',
      'UpdateMembershipPayload',
      t('errors.updateMemberRoleFailed'),
    );
  };

  // Toggle a single membership permission override. updateMembership returns the
  // updated member (HomeMemberCard_member), so Apollo normalizes it and the
  // toggle reflects the server state.
  const updateMemberPermission = async (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => {
    const result = await executeMutation(
      () =>
        updateMembershipMutation({
          variables: { input: { id: membershipId, [permission]: value } },
        }),
      error =>
        handleMutationError(error, { operation: 'Update Member Permission' }),
    );
    return !alertIfRejected(
      result,
      'updateMembership',
      'UpdateMembershipPayload',
      t('errors.updateMemberRoleFailed'),
    );
  };

  const removeMember = (membershipId: string, memberName: string) => {
    const operation = createRemoveOperation({
      mutation: removeMemberMutation,
      itemId: membershipId,
      confirmMessage: `Are you sure you want to remove {name} from this home?`,
      itemName: memberName,
      operationName: 'Remove Member',
    });
    return operation();
  };

  const revokeInvite = (inviteId: string, inviteEmail: string) => {
    const operation = createRemoveOperation({
      mutation: revokeInviteMutation,
      itemId: inviteId,
      confirmMessage: `Are you sure you want to revoke the invitation to {name}?`,
      itemName: inviteEmail,
      operationName: 'Revoke Invitation',
    });
    return operation();
  };

  const leaveHome = (homeName: string): Promise<boolean> => {
    return new Promise(resolve => {
      alertService.alert(
        'Leave Home',
        `Are you sure you want to leave "${homeName}"? You will lose access to this home and its pantries and shopping lists.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              const result = await executeMutation(
                () => leaveHomeMutation({ variables: { input: { homeId } } }),
                error =>
                  handleMutationError(error, { operation: 'Leave Home' }),
              );
              if (!result) {
                resolve(false);
                return;
              }
              if (
                alertIfRejected(
                  result,
                  'leaveHome',
                  'LeaveHomePayload',
                  t('errors.somethingWentWrong'),
                )
              ) {
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
    if (enabled) {
      // Dedicated mutation: mints a joinCode + join link server-side.
      const result = await executeMutation(
        () => enableJoinLinkMutation({ variables: { input: { id: homeId } } }),
        error => handleMutationError(error, { operation: 'Enable Join Link' }),
      );
      alertIfRejected(
        result,
        'enableHomeJoinLink',
        'UpdateHomePayload',
        t('errors.updateHomeFailed'),
      );
      return;
    }
    // No disableHomeJoinLink mutation — clear the flag via updateHome.
    await updateHomeMutation({
      variables: { input: { id: homeId, allowJoinCode: false } },
    });
  };

  // Hand the home off to another member. The server flips the OWNER role; the
  // response carries the refreshed membersConnection so roles update in-place.
  const transferOwnership = async (newOwnerId: string) => {
    const result = await executeMutation(
      () =>
        transferOwnershipMutation({
          variables: { input: { homeId, newOwnerId } },
        }),
      error =>
        handleMutationError(error, { operation: 'Transfer Home Ownership' }),
    );
    return !alertIfRejected(
      result,
      'transferHomeOwnership',
      'TransferHomeOwnershipPayload',
      t('errors.updateHomeFailed'),
    );
  };

  // Rotate the join code to invalidate a leaked link.
  const rotateJoinCode = async () => {
    const result = await executeMutation(
      () => rotateJoinCodeMutation({ variables: { input: { id: homeId } } }),
      error => handleMutationError(error, { operation: 'Rotate Join Code' }),
    );
    return !alertIfRejected(
      result,
      'updateHomeJoinCode',
      'UpdateHomePayload',
      t('errors.updateHomeFailed'),
    );
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
