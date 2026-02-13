import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { formatRole } from '#/utils/formatters/roleFormatters';
import { type Member } from '#/utils/formatters/memberFormatters';
import { commonStyles } from '#/styles/commonStyles';

interface HomeMemberCardProps {
  member: Member;
  displayName: string;
  isCurrentUser: boolean;
  currentUserMembership?: Member | null;
  onChangeRole: () => void;
  onRemove: () => void;
}

/**
 * HomeMemberCard - Displays individual member with role badge and actions
 */
export const HomeMemberCard: React.FC<HomeMemberCardProps> = ({
  member,
  displayName,
  isCurrentUser,
  currentUserMembership,
  onChangeRole,
  onRemove,
}) => {
  // Only show actions if:
  // 1. Current user has canManageHome permission (OWNER/ADMIN)
  // 2. Target member is not the current user
  // 3. Target member is not OWNER (owners cannot be removed/demoted)
  const canManageMember =
    currentUserMembership?.canManageHome &&
    !isCurrentUser &&
    member.role !== 'OWNER';
  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.memberCard]}>
      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text style={styles.memberName}>{displayName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{formatRole(member.role)}</Text>
          </View>
        </View>
        {member.user?.email && !isCurrentUser && (
          <Text style={styles.memberEmail}>{member.user.email}</Text>
        )}
      </View>

      {canManageMember && (
        <View style={styles.memberActions}>
          <Pressable style={({pressed}) => [styles.actionButton, pressed && styles.pressed]} onPress={onChangeRole}>
            <Icon name="swap-horizontal" size={18} library="Ionicons" />
            <Text style={styles.actionButtonText}>Change Role</Text>
          </Pressable>
          <Pressable style={({pressed}) => [styles.actionButton, pressed && styles.pressed]} onPress={onRemove}>
            <Icon name="person-remove" size={18} />
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  memberCard: {
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.primary + '20',
  },
  roleText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
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
  removeButtonText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: 0.7,
  },
}));
