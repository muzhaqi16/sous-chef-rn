import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useGetHomeQuery,
  useUpdateHomeMutation,
  useUpdateMembershipMutation,
  useRemoveMemberMutation,
  useRevokeHomeInviteMutation,
  MembershipRole,
} from '#generated';
import { MESSAGES } from '#constants';
import { formatRole } from '#utils/formatters';
import { normalizeHome } from '#/utils/connectionUtils';

/**
 * Custom hook for HomeDetailScreen business logic
 * Manages home details, members, and invites
 */
export function useHomeDetailManagement(homeId: string) {
  // Query
  const { data, loading } = useGetHomeQuery({
    variables: { homeId },
    fetchPolicy: 'cache-and-network',
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
      if (!data?.updateMembership || !variables) return;

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
    // Remove member from home's members array using cache.modify
    update(cache, { data }, { variables }) {
      if (!data?.removeMember || !variables) return;

      const membershipId = variables.membershipId;

      cache.modify({
        id: cache.identify({ __typename: 'Home', id: homeId }),
        fields: {
          membersConnection(existingConnection = {}, { readField }) {
            if (!existingConnection?.edges) {
              return existingConnection;
            }

            const filteredEdges = existingConnection.edges.filter((edge: any) => {
              const nodeId = readField('id', edge?.node);
              return nodeId !== membershipId;
            });

            return {
              ...existingConnection,
              edges: filteredEdges,
              totalCount: Math.max(
                0,
                (existingConnection.totalCount ?? filteredEdges.length) -
                  (filteredEdges.length < existingConnection.edges.length ? 1 : 0),
              ),
            };
          },
          members(existingMembers = [], { readField }) {
            return existingMembers.filter(
              (memberRef: any) => readField('id', memberRef) !== membershipId,
            );
          },
        },
      });

      // Evict the membership entity from cache
      cache.evict({
        id: cache.identify({ __typename: 'Membership', id: membershipId }),
      });

      // Garbage collect orphaned data
      cache.gc();
    },
    onError: error => {
      Alert.alert('Error', error.message || MESSAGES.errors.removeMemberFailed);
    },
  });

  const [revokeInviteMutation] = useRevokeHomeInviteMutation({
    errorPolicy: 'all',
    // Remove invite from home's invites array using cache.modify
    update(cache, { data }, { variables }) {
      if (!data?.revokeHomeInvite || !variables) return;

      const inviteId = variables.id;

      // Remove from home's invites array
      cache.modify({
        id: cache.identify({ __typename: 'Home', id: homeId }),
        fields: {
          invitesConnection(existingConnection = {}, { readField }) {
            if (!existingConnection?.edges) {
              return existingConnection;
            }

            const filteredEdges = existingConnection.edges.filter((edge: any) => {
              const nodeId = readField('id', edge?.node);
              return nodeId !== inviteId;
            });

            return {
              ...existingConnection,
              edges: filteredEdges,
              totalCount: Math.max(
                0,
                (existingConnection.totalCount ?? filteredEdges.length) -
                  (filteredEdges.length < existingConnection.edges.length ? 1 : 0),
              ),
            };
          },
          invites(existingInvites = [], { readField }) {
            return existingInvites.filter(
              (inviteRef: any) => readField('id', inviteRef) !== inviteId,
            );
          },
        },
      });

      // Evict the invite entity from cache
      cache.evict({
        id: cache.identify({ __typename: 'HomeInvite', id: inviteId }),
      });

      // Garbage collect orphaned data
      cache.gc();
    },
    onError: error => {
      Alert.alert('Error', error.message || MESSAGES.errors.revokeInviteFailed);
    },
  });

  const home = normalizeHome(data?.home);

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
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${memberName} from this home?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await removeMemberMutation({
                variables: { membershipId },
              });
            },
          },
        ],
      );
    },
    [removeMemberMutation],
  );

  const revokeInvite = useCallback(
    (inviteId: string, inviteEmail: string) => {
      Alert.alert(
        'Revoke Invitation',
        `Are you sure you want to revoke the invitation to ${inviteEmail}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              await revokeInviteMutation({
                variables: { id: inviteId },
              });
            },
          },
        ],
      );
    },
    [revokeInviteMutation],
  );

  return {
    // Data
    home,
    loading,
    updating,

    // Actions
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
  };
}
