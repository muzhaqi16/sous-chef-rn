import { useState } from 'react';
import { alertService } from '#/services/alertService';
import { useShallow } from 'zustand/shallow';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import {
  useGetHomeQuery,
  useUpdateHomeMutation,
  useUpdateMembershipMutation,
  useRemoveMemberMutation,
  useRevokeHomeInviteMutation,
  useLeaveHomeMutation,
  useSetDefaultHomeMutation,
  GetHomesDocument,
  MembershipRole,
} from '#generated';
import { MESSAGES } from '#/constants/messages';
import { normalizeHome } from '#/utils/connectionUtils';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  useAppStore,
  selectSelectedHomeId,
  selectHomeState,
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
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const { setSelectedHomeId } = useAppStore(useShallow(selectHomeState));
  const setSelectedPantryId = useAppStore(state => state.setSelectedPantryId);
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, then fetches full HomeFragment
  // - errorPolicy: 'all' returns cached data AND errors (needed to distinguish "not found" from "failed to load")

  // Query
  const { data, loading, error, refetch } = useGetHomeQuery({
    variables: { homeId },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  // Mutations
  const [updateHomeMutation, { loading: updating }] = useUpdateHomeMutation({
    // Mutation returns updated scalar fields; Apollo auto-merges by __typename + id
    errorPolicy: 'all',
    onError: error => {
      alertService.alert(
        'Error',
        error.message || MESSAGES.errors.updateHomeNameFailed,
      );
    },
  });

  const [updateMembershipMutation] = useUpdateMembershipMutation({
    errorPolicy: 'all',
    // Use cache.modify to update the membership role field
    update(cache, { data }, { variables }) {
      if (!data?.updateMembership?.success || !variables) return;

      const membershipId = variables.id;
      const newRole = variables.input.role;

      // Directly modify the cached membership's role field
      cache.modify({
        id: cache.identify({ __typename: 'Membership', id: membershipId }),
        fields: {
          role() {
            return newRole;
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });
    },
    onError: error => {
      alertService.alert(
        'Error',
        error.message || MESSAGES.errors.updateMemberRoleFailed,
      );
    },
  });

  const [removeMemberMutation] = useRemoveMemberMutation({
    errorPolicy: 'all',
    update(cache, { data }, { variables }) {
      if (!data?.removeMember?.success || !variables) return;

      executeCacheUpdate(() => {
        const removeFromMembersCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'membersConnection',
          'Membership',
        );
        removeFromMembersCache(cache, homeId, variables.id, {
          evictItem: true,
        });
      }, 'Cache update failed for removeMember:');
    },
    onError: error => {
      // PERFORMANCE: Handle version conflict errors with user-friendly message
      if (handleVersionConflict(error)) {
        alertService.alert('Member Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      alertService.alert(
        'Error',
        error.message || MESSAGES.errors.removeMemberFailed,
      );
    },
  });

  const [revokeInviteMutation] = useRevokeHomeInviteMutation({
    errorPolicy: 'all',
    update(cache, { data }, { variables }) {
      if (!data?.revokeHomeInvite?.success || !variables) return;

      executeCacheUpdate(() => {
        const removeFromInvitesCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'invitesConnection',
          'HomeInvite',
        );
        removeFromInvitesCache(cache, homeId, variables.id, {
          evictItem: true,
        });
      }, 'Cache update failed for revokeInvite:');
    },
    onError: error => {
      // PERFORMANCE: Handle version conflict errors with user-friendly message
      if (handleVersionConflict(error)) {
        alertService.alert('Invite Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      alertService.alert(
        'Error',
        error.message || MESSAGES.errors.revokeInviteFailed,
      );
    },
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation();

  const [leaveHomeMutation, { loading: leaving, client: leaveClient }] =
    useLeaveHomeMutation({
      errorPolicy: 'all',
      update(cache, { data }) {
        if (!data?.leaveHome?.success) return;

        executeCacheUpdate(() => {
          cache.evict({
            id: cache.identify({ __typename: 'Home', id: homeId }),
          });
          cache.gc();
        }, 'Cache update failed for leaveHome:');
      },
      onCompleted: data => {
        if (data?.leaveHome?.success && homeId === selectedHomeId) {
          // Read remaining homes from cache
          const cachedData = leaveClient.cache.readQuery({
            query: GetHomesDocument,
          }) as { homes: any[] } | null;
          const remainingHomes = cachedData?.homes ?? [];

          if (remainingHomes.length > 0) {
            const newDefaultHome = remainingHomes[0];
            setSelectedHomeId(newDefaultHome.id);
            setSelectedPantryId(null);
            setDefaultHomeMutation({
              variables: { homeId: newDefaultHome.id },
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
      onError: error => {
        alertService.alert('Error', error.message || 'Failed to leave home');
      },
    });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const preservedHomeData = usePreservedQueryData(data?.home, null);
  const home = normalizeHome(preservedHomeData);

  // CRUD operations utilities
  const { createRemoveOperation } = useCrudOperations();

  // Handler functions
  const saveName = async (name: string) => {
    await updateHomeMutation({
      variables: {
        id: homeId,
        input: { name },
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

    await updateMembershipMutation({
      variables: {
        id: membershipId,
        input: { role: value as MembershipRole },
      },
    });
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
                () => leaveHomeMutation({ variables: { homeId } }),
                'Failed to leave home',
              );
              resolve(result ? !!result.data?.leaveHome?.success : false);
            },
          },
        ],
      );
    });
  };

  const toggleJoinCode = async (enabled: boolean) => {
    await updateHomeMutation({
      variables: {
        id: homeId,
        input: { allowJoinCode: enabled },
      },
    });
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
  };
}
