import { useCallback } from 'react';
import { Alert } from 'react-native';
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
import { formatRole } from '#utils/formatters/roleFormatters';
import { normalizeHome } from '#/utils/connectionUtils';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useAppStore, selectSelectedHomeId, selectHomeState } from '#store/useAppStore';

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
  // - cache-first: Uses cache if available for detail views
  // - errorPolicy: 'ignore' returns cached data when network fails

  // Query
  const { data, loading, refetch } = useGetHomeQuery({
    variables: { homeId },
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Mutations
  const [updateHomeMutation, { loading: updating }] = useUpdateHomeMutation({
    // No refetchQueries or update function needed!
    // Mutation returns full HomeFragment, so Apollo automatically normalizes
    // and updates the cache based on __typename + id
    errorPolicy: 'all',
    onError: error => {
      Alert.alert(
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
      Alert.alert(
        'Error',
        error.message || MESSAGES.errors.updateMemberRoleFailed,
      );
    },
  });

  const [removeMemberMutation] = useRemoveMemberMutation({
    errorPolicy: 'all',
    update(cache, { data }, { variables }) {
      if (!data?.removeMember?.success || !variables) return;

      try {
        const removeFromMembersCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'membersConnection',
          'Membership',
        );
        removeFromMembersCache(cache, homeId, variables.id, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for removeMember:', error);
      }
    },
    onError: error => {
      // PERFORMANCE: Handle version conflict errors with user-friendly message
      if (handleVersionConflict(error)) {
        Alert.alert('Member Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      Alert.alert('Error', error.message || MESSAGES.errors.removeMemberFailed);
    },
  });

  const [revokeInviteMutation] = useRevokeHomeInviteMutation({
    errorPolicy: 'all',
    update(cache, { data }, { variables }) {
      if (!data?.revokeHomeInvite?.success || !variables) return;

      try {
        const removeFromInvitesCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'invitesConnection',
          'HomeInvite',
        );
        removeFromInvitesCache(cache, homeId, variables.id, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for revokeInvite:', error);
      }
    },
    onError: error => {
      // PERFORMANCE: Handle version conflict errors with user-friendly message
      if (handleVersionConflict(error)) {
        Alert.alert('Invite Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      Alert.alert('Error', error.message || MESSAGES.errors.revokeInviteFailed);
    },
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation();

  const [leaveHomeMutation, { loading: leaving, client: leaveClient }] =
    useLeaveHomeMutation({
      errorPolicy: 'all',
      update(cache, { data }) {
        if (!data?.leaveHome?.success) return;

        try {
          // Evict the home from cache after leaving
          cache.evict({
            id: cache.identify({ __typename: 'Home', id: homeId }),
          });
          cache.gc();
        } catch (error) {
          console.warn('Cache update failed for leaveHome:', error);
        }
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
        Alert.alert('Error', error.message || 'Failed to leave home');
      },
    });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const preservedHomeData = usePreservedQueryData(data?.home, null);
  const home = normalizeHome(preservedHomeData);

  // CRUD operations utilities
  const { createRemoveOperation } = useCrudOperations();

  // Handler functions
  const saveName = useCallback(
    async (name: string) => {
      await updateHomeMutation({
        variables: {
          id: homeId,
          input: { name },
        },
      });
    },
    [homeId, updateHomeMutation],
  );

  const changeRole = useCallback(
    (membershipId: string, currentRole: string, memberName: string) => {
      const roles = [
        { label: 'Owner', value: MembershipRole.Owner },
        { label: 'Admin', value: MembershipRole.Admin },
        { label: 'Member', value: MembershipRole.Member },
        { label: 'Guest', value: MembershipRole.Guest },
      ];

      const buttons = roles.map(role => ({
        text: role.label,
        onPress: () => {
          if (role.value === currentRole) return;

          Alert.alert(
            'Change Role',
            `Change ${memberName}'s role to ${role.label}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Change',
                onPress: async () => {
                  await updateMembershipMutation({
                    variables: {
                      id: membershipId,
                      input: { role: role.value },
                    },
                  });
                },
              },
            ],
          );
        },
      }));

      buttons.push({
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      } as any);

      Alert.alert(
        'Select Role',
        `Current role: ${formatRole(currentRole)}`,
        buttons,
      );
    },
    [updateMembershipMutation],
  );

  const removeMember = useCallback(
    (membershipId: string, memberName: string) => {
      const operation = createRemoveOperation({
        mutation: removeMemberMutation,
        itemId: membershipId,
        confirmMessage: `Are you sure you want to remove {name} from this home?`,
        itemName: memberName,
        operationName: 'Remove Member',
      });
      return operation();
    },
    [removeMemberMutation, createRemoveOperation],
  );

  const revokeInvite = useCallback(
    (inviteId: string, inviteEmail: string) => {
      const operation = createRemoveOperation({
        mutation: revokeInviteMutation,
        itemId: inviteId,
        confirmMessage: `Are you sure you want to revoke the invitation to {name}?`,
        itemName: inviteEmail,
        operationName: 'Revoke Invitation',
      });
      return operation();
    },
    [revokeInviteMutation, createRemoveOperation],
  );

  const leaveHome = useCallback(
    (homeName: string): Promise<boolean> => {
      return new Promise(resolve => {
        Alert.alert(
          'Leave Home',
          `Are you sure you want to leave "${homeName}"? You will lose access to this home and its pantries and shopping lists.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                try {
                  const result = await leaveHomeMutation({
                    variables: { homeId },
                  });
                  resolve(!!result.data?.leaveHome?.success);
                } catch {
                  resolve(false);
                }
              },
            },
          ],
        );
      });
    },
    [homeId, leaveHomeMutation],
  );

  const toggleJoinCode = useCallback(
    async (enabled: boolean) => {
      await updateHomeMutation({
        variables: {
          id: homeId,
          input: { allowJoinCode: enabled },
        },
      });
    },
    [homeId, updateHomeMutation],
  );

  return {
    // Data
    home,
    loading,
    updating,
    leaving,

    // Actions
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
  };
}
