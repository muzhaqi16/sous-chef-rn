import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useGetHomeQuery,
  useUpdateHomeMutation,
  useUpdateMembershipMutation,
  useRemoveMemberMutation,
  useRevokeHomeInviteMutation,
  MembershipRole,
  GetHomesDocument,
  GetHomeDocument,
} from '#generated';
import { MESSAGES } from '#constants';
import { formatRole } from '#utils/formatters';

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
    refetchQueries: [{ query: GetHomesDocument }],
    onError: error => {
      Alert.alert(
        'Error',
        error.message || MESSAGES.errors.updateHomeNameFailed,
      );
    },
  });

  const [updateMembershipMutation] = useUpdateMembershipMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onError: error => {
      Alert.alert(
        'Error',
        error.message || MESSAGES.errors.updateMemberRoleFailed,
      );
    },
  });

  const [removeMemberMutation] = useRemoveMemberMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onError: error => {
      Alert.alert('Error', error.message || MESSAGES.errors.removeMemberFailed);
    },
  });

  const [revokeInviteMutation] = useRevokeHomeInviteMutation({
    refetchQueries: [
      { query: GetHomesDocument },
      { query: GetHomeDocument, variables: { homeId } },
    ],
    onError: error => {
      Alert.alert('Error', error.message || MESSAGES.errors.revokeInviteFailed);
    },
  });

  const home = data?.home;

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
