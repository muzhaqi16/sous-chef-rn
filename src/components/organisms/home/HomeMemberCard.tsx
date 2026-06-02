import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { formatRole } from '#/utils/formatters/roleFormatters';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { HomeMemberCard_MemberFragmentDoc } from './HomeMemberCard.generated';

interface HomeMemberCardProps {
  memberRef: FragmentType<typeof HomeMemberCard_MemberFragmentDoc>;
  displayName: string;
  isCurrentUser: boolean;
  /** Current user's own membership — drives whether action buttons render. */
  canManageHome?: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
}

/**
 * HomeMemberCard - Displays individual member with role badge and actions.
 *
 * Subscribes to its Membership cache entry via `useFragment` so it re-renders
 * independently when this member's role changes.
 */
export const HomeMemberCard: React.FC<HomeMemberCardProps> = ({
  memberRef,
  displayName,
  isCurrentUser,
  canManageHome,
  onChangeRole,
  onRemove,
}) => {
  const { data: member, complete } = useFragment({
    fragment: HomeMemberCard_MemberFragmentDoc,
    fragmentName: 'HomeMemberCard_member',
    from: memberRef,
  });

  if (!complete) return null;

  // Only show actions if:
  // 1. Current user has canManageHome permission (OWNER/ADMIN)
  // 2. Target member is not the current user
  // 3. Target member is not OWNER (owners cannot be removed/demoted)
  const canManageMember =
    canManageHome && !isCurrentUser && member.role !== 'OWNER';
  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.memberCard]}>
      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text size="md" weight="semibold" style={styles.memberName}>
            {displayName}
          </Text>
          <View style={styles.roleBadge}>
            <Text size="xs" weight="semibold" tone="accent">
              {formatRole(member.role)}
            </Text>
          </View>
        </View>
        {!!member.user?.email && !isCurrentUser && (
          <Text size="sm" tone="secondary">
            {member.user.email}
          </Text>
        )}
      </View>
      {!!canManageMember && (
        <View style={styles.memberActions}>
          <AppPressable style={styles.actionButton} onPress={onChangeRole}>
            <Icon name="swap-horizontal" size={18} />
            <Text size="sm" weight="medium" style={styles.actionButtonText}>
              Change Role
            </Text>
          </AppPressable>
          <AppPressable style={styles.actionButton} onPress={onRemove}>
            <Icon name="person-remove" size={18} />
            <Text size="sm" weight="medium" tone="error">
              Remove
            </Text>
          </AppPressable>
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
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primary + '20',
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
    color: theme.colors.info,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
