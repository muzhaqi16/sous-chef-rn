import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { formatRole } from '#/utils/formatters/roleFormatters';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import type { MembershipPermissionKey } from '#features/home/hooks/useHomeDetailManagement';
import { HomeMemberCard_MemberFragmentDoc } from './HomeMemberCard.generated';

const PERMISSION_ROWS: {
  key: MembershipPermissionKey;
  labelKey: string;
}[] = [
  { key: 'canViewPantry', labelKey: 'homeDetail.permViewPantry' },
  { key: 'canAddItems', labelKey: 'labels.canAddItems' },
  { key: 'canRemoveItems', labelKey: 'labels.canRemoveItems' },
  { key: 'canEditPantry', labelKey: 'homeDetail.permEditPantry' },
  { key: 'canInviteOthers', labelKey: 'homeDetail.permInviteOthers' },
  { key: 'canManageHome', labelKey: 'homeDetail.permManageHome' },
];

interface HomeMemberCardProps {
  memberRef: FragmentType<typeof HomeMemberCard_MemberFragmentDoc>;
  displayName: string;
  isCurrentUser: boolean;
  /** Current user's own membership — drives whether action buttons render. */
  canManageHome?: boolean;
  /** Current user is the home OWNER — gates the transfer-ownership action. */
  isOwner?: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
  onTransferOwnership?: () => void;
  onUpdatePermission?: (
    permission: MembershipPermissionKey,
    value: boolean,
  ) => void;
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
  isOwner,
  onChangeRole,
  onRemove,
  onTransferOwnership,
  onUpdatePermission,
}) => {
  const { t } = useTranslation();
  const [showPermissions, setShowPermissions] = useState(false);
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
            <Text
              size="sm"
              weight="medium"
              numberOfLines={1}
              style={styles.actionButtonText}
            >
              {t('homeDetail.changeRole')}
            </Text>
          </AppPressable>
          {!!isOwner && !!onTransferOwnership && (
            <AppPressable
              style={styles.actionButton}
              onPress={onTransferOwnership}
            >
              <Icon name="ribbon-outline" size={18} tone="primary" />
              <Text size="sm" weight="medium" tone="accent" numberOfLines={1}>
                {t('homeDetail.makeOwner')}
              </Text>
            </AppPressable>
          )}
          {!!onUpdatePermission && (
            <AppPressable
              style={styles.actionButton}
              onPress={() => setShowPermissions(prev => !prev)}
            >
              <Icon
                name={showPermissions ? 'chevron-up' : 'options-outline'}
                size={18}
              />
              <Text
                size="sm"
                weight="medium"
                numberOfLines={1}
                style={styles.actionButtonText}
              >
                {t('homeDetail.permissions')}
              </Text>
            </AppPressable>
          )}
          <AppPressable style={styles.actionButton} onPress={onRemove}>
            <Icon name="person-remove" size={18} />
            <Text size="sm" weight="medium" tone="error" numberOfLines={1}>
              {t('labels.remove')}
            </Text>
          </AppPressable>
        </View>
      )}

      {/* Per-permission overrides (managed members only). */}
      {!!canManageMember && !!onUpdatePermission && !!showPermissions && (
        <View style={styles.permissionList}>
          {PERMISSION_ROWS.map(({ key, labelKey }) => (
            <View key={key} style={styles.permissionRow}>
              <Text size="sm" style={styles.permissionLabel}>
                {t(labelKey)}
              </Text>
              <BaseSwitch
                value={!!member[key]}
                onValueChange={value => onUpdatePermission(key, value)}
              />
            </View>
          ))}
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
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary + '20',
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    // Two per row, not four. Sharing one row between four actions left each
    // label about 70px — too narrow for "Permissions" to fit at all, so it
    // broke mid-word and the icon ended up centred against a two-line block.
    // A basis just under half keeps every label on one line beside its icon,
    // and `flexGrow` lets a lone third action fill its row.
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  actionButtonText: {
    color: theme.colors.info,
  },
  permissionList: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  permissionLabel: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
