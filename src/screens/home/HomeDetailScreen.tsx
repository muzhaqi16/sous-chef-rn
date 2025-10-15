import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks';
import { Icon } from '#utils';
import { commonStyles } from '#styles';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { FormInput } from '#components/molecules';
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
import { useStore } from '#store';
import { MESSAGES } from '@/constants';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { homeId } = route.params;
  const currentUser = useStore(state => state.user);
  const { theme } = useUnistyles();

  const [editingName, setEditingName] = useState(false);
  const [homeName, setHomeName] = useState('');

  const { data, loading } = useGetHomeQuery({
    variables: { homeId },
    fetchPolicy: 'cache-and-network',
  });

  const [updateHomeMutation, { loading: updating }] = useUpdateHomeMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onCompleted: () => {
      setEditingName(false);
      Alert.alert('Success', MESSAGES.success.homeNameUpdated);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || MESSAGES.errors.updateHomeNameFailed);
    },
  });

  const [updateMembershipMutation] = useUpdateMembershipMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onCompleted: () => {
      Alert.alert('Success', MESSAGES.success.memberRoleUpdated);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || MESSAGES.errors.updateMemberRoleFailed);
    },
  });

  const [removeMemberMutation] = useRemoveMemberMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onCompleted: () => {
      Alert.alert('Success', MESSAGES.success.memberRemoved);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || MESSAGES.errors.removeMemberFailed);
    },
  });

  const [revokeInviteMutation] = useRevokeHomeInviteMutation({
    refetchQueries: [
      { query: GetHomesDocument },
      { query: GetHomeDocument, variables: { homeId } },
    ],
    onCompleted: () => {
      Alert.alert('Success', MESSAGES.success.invitationRevoked);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || MESSAGES.errors.revokeInviteFailed);
    },
  });

  const home = data?.home;

  const handleSaveName = async () => {
    if (!homeName.trim()) {
      Alert.alert('Error', 'Home name cannot be empty');
      return;
    }

    await updateHomeMutation({
      variables: {
        id: homeId,
        input: { name: homeName.trim() },
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setHomeName(home?.name || '');
  };

  const handleChangeRole = (membershipId: string, currentRole: string, memberName: string) => {
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

    buttons.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' } as any);

    Alert.alert('Select Role', `Current role: ${formatRole(currentRole)}`, buttons);
  };

  const handleRemoveMember = (membershipId: string, memberName: string) => {
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
  };

  const handleRevokeInvite = (inviteId: string, inviteEmail: string) => {
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
  };

  const formatRole = (role: string): string => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      case 'MEMBER':
        return 'Member';
      case 'GUEST':
        return 'Guest';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string, theme: any): string => {
    switch (role) {
      case 'OWNER':
        return theme.colors.roles.owner;
      case 'ADMIN':
        return theme.colors.roles.admin;
      case 'MEMBER':
        return theme.colors.roles.member;
      case 'GUEST':
        return theme.colors.roles.guest;
      default:
        return theme.colors.roles.guest;
    }
  };

  const getMemberDisplayName = (member: any): string => {
    const isCurrentUser = member.user?.id === currentUser?.id;

    if (isCurrentUser) {
      return 'You';
    }

    return (
      member.displayName ||
      member.user?.profile?.displayName ||
      member.user?.profile?.firstName ||
      member.user?.email?.split('@')[0] ||
      member.user?.email ||
      'Unknown Member'
    );
  };

  const getInviteDisplayName = (invite: any): string => {
    return invite.recipientName || invite.email.split('@')[0] || invite.email;
  };

  const formatInviteStatus = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'Invited';
      case 'ACCEPTED':
        return 'Accepted';
      case 'DECLINED':
        return 'Declined';
      case 'EXPIRED':
        return 'Expired';
      case 'REVOKED':
        return 'Revoked';
      default:
        return status;
    }
  };

  const getInviteStatusColor = (status: string, theme: any): string => {
    switch (status) {
      case 'PENDING':
        return theme.colors.status.pending;
      case 'ACCEPTED':
        return theme.colors.status.accepted;
      case 'DECLINED':
        return theme.colors.status.declined;
      case 'EXPIRED':
      case 'REVOKED':
        return theme.colors.status.expired;
      default:
        return theme.colors.status.expired;
    }
  };

  if (loading || !home) {
    return (
      <DetailTemplate
        title="Home Details"
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={commonStyles.body}>
                  {loading ? 'Loading...' : 'Home not found'}
                </Text>
              </View>
            ),
          },
        ]}
      />
    );
  }

  const sections = [
    {
      title: 'Home Information',
      content: (
        <View>
          {editingName ? (
            <View>
              <FormInput
                label="Home Name"
                value={homeName}
                onChangeText={setHomeName}
                placeholder="Enter home name"
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                  disabled={updating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, styles.saveButton]}
                  onPress={handleSaveName}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <View style={styles.nameContainer}>
                <Text style={styles.nameLabel}>Name</Text>
                <Text style={styles.nameValue}>{home.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.editIconButton}
                onPress={() => {
                  setHomeName(home.name);
                  setEditingName(true);
                }}
              >
                <Icon name="edit" size={20} uniProps={theme => ({ color: theme.colors.info })} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ),
    },
    {
      title: 'Members & Invites',
      content: (
        <View>
          {/* Active Members */}
          {home.members && home.members.length > 0 ? (
            home.members.map((member: any) => {
              const isCurrentUser = member.user?.id === currentUser?.id;
              const displayName = getMemberDisplayName(member);
              const roleBadgeColor = getRoleBadgeColor(member.role, theme);

              return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberHeader}>
                      <Text style={styles.memberName}>{displayName}</Text>
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: roleBadgeColor + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleText,
                            { color: roleBadgeColor },
                          ]}
                        >
                          {formatRole(member.role)}
                        </Text>
                      </View>
                    </View>
                    {member.user?.email && !isCurrentUser && (
                      <Text style={styles.memberEmail}>
                        {member.user.email}
                      </Text>
                    )}
                  </View>

                  {!isCurrentUser && (
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() =>
                          handleChangeRole(
                            member.id,
                            member.role,
                            displayName,
                          )
                        }
                      >
                        <Icon
                          name="swap-horizontal"
                          size={18}
                          uniProps={theme => ({ color: theme.colors.info })}
                        />
                        <Text style={styles.actionButtonText}>
                          Change Role
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.removeButton]}
                        onPress={() =>
                          handleRemoveMember(member.id, displayName)
                        }
                      >
                        <Icon name="person-remove" size={18} uniProps={theme => ({ color: theme.colors.error })} />
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No members</Text>
            </View>
          )}

          {/* Pending Invites */}
          {home.invites && home.invites.filter((inv: any) => inv.status !== 'ACCEPTED').length > 0 && (
            <View style={styles.invitesSection}>
              <Text style={styles.invitesSectionTitle}>Pending Invitations</Text>
              {home.invites
                .filter((invite: any) => invite.status !== 'ACCEPTED')
                .map((invite: any) => {
                  const displayName = getInviteDisplayName(invite);
                  const statusColor = getInviteStatusColor(invite.status, theme);
                  const statusText = formatInviteStatus(invite.status);

                  return (
                    <View
                      key={invite.id}
                      style={[
                        styles.inviteCard,
                        { borderColor: statusColor },
                      ]}
                    >
                      <View style={styles.inviteInfo}>
                        <Text style={styles.inviteName}>{displayName}</Text>
                        <Text style={styles.inviteEmail}>{invite.email}</Text>
                      </View>
                      <View style={styles.inviteActions}>
                        <View
                          style={[
                            styles.inviteStatusBadge,
                            { backgroundColor: statusColor + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.inviteStatusText,
                              { color: statusColor },
                            ]}
                          >
                            {statusText}
                          </Text>
                        </View>
                        {invite.status === 'PENDING' && (
                          <TouchableOpacity
                            style={styles.revokeButton}
                            onPress={() =>
                              handleRevokeInvite(invite.id, invite.email)
                            }
                          >
                            <Icon name="close" size={20} uniProps={theme => ({ color: theme.colors.error })} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      ),
    },
  ];

  return (
    <DetailTemplate
      title="Home Details"
      onBack={goBack}
      headerActions={[]}
      sections={sections}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  nameContainer: {
    flex: 1,
  },
  nameLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  nameValue: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  editIconButton: {
    padding: theme.spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  editButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.semibold,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.neutral[0],
    fontWeight: theme.fonts.weight.semibold,
  },
  memberCard: {
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...commonStyles.shadow,
  },
  memberInfo: {
    marginBottom: theme.spacing.sm,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  memberName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  memberEmail: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  roleText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
  memberActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  actionButtonText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.info,
    fontWeight: theme.fonts.weight.medium,
  },
  removeButton: {
    backgroundColor: theme.colors.validation.errorBg,
  },
  removeButtonText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    fontWeight: theme.fonts.weight.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  invitesSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  invitesSectionTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  inviteEmail: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  inviteStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  inviteStatusText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
  revokeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.validation.errorBg,
  },
}));
