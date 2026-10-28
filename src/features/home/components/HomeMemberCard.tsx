import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { formatRole } from '#/utils/formatters/roleFormatters';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import type { MembershipPermissionKey } from '#features/home/types';
import {
  canGrantFlag,
  canManageMember,
  type HomeViewer,
} from '#features/home/utils/homePermissions';
import { HomeMemberCard_MemberFragmentDoc } from './HomeMemberCard.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

const PERMISSION_ROWS: {
  key: MembershipPermissionKey;
  labelKey: TranslationKey;
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
  /** The current user's own membership: decides which actions render. */
  viewer: HomeViewer | null;
  onChangeRole: () => void;
  onRemove: () => void;
  onTransferOwnership?: () => void;
  transferDisabled?: boolean;
  onUpdatePermission?: (
    permission: MembershipPermissionKey,
    value: boolean,
  ) => void;
}

/**
 * Reads its Membership through `useFragment`, so it re-renders alone when this
 * member's role changes.
 */
export const HomeMemberCard: React.FC<HomeMemberCardProps> = ({
  memberRef,
  displayName,
  isCurrentUser,
  viewer,
  onChangeRole,
  onRemove,
  onTransferOwnership,
  transferDisabled = false,
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

  const canManage = canManageMember(viewer, member.role, isCurrentUser);
  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.memberCard]}>
      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text role="bodyStrong" style={styles.memberName}>
            {displayName}
          </Text>
          <View style={styles.roleBadge}>
            <Text role="label" tone="accent">
              {formatRole(member.role, t)}
            </Text>
          </View>
        </View>
        {!!member.user.email && !isCurrentUser && (
          <Text role="caption" tone="secondary">
            {member.user.email}
          </Text>
        )}
      </View>
      {!!canManage && (
        <View style={styles.memberActions}>
          <AppPressable style={styles.actionButton} onPress={onChangeRole}>
            <Icon name="swap-horizontal" size={18} />
            <Text
              role="label"
              numberOfLines={1}
              style={styles.actionButtonText}
            >
              {t('homeDetail.changeRole')}
            </Text>
          </AppPressable>
          {viewer?.role === MembershipRole.Owner && !!onTransferOwnership && (
            <AppPressable
              style={[
                styles.actionButton,
                transferDisabled && styles.actionButtonDisabled,
              ]}
              onPress={onTransferOwnership}
              disabled={transferDisabled}
              accessibilityState={{ disabled: transferDisabled }}
            >
              <Icon name="ribbon-outline" size={18} tone="primary" />
              <Text role="label" tone="accent" numberOfLines={1}>
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
                role="label"
                numberOfLines={1}
                style={styles.actionButtonText}
              >
                {t('homeDetail.permissions')}
              </Text>
            </AppPressable>
          )}
          <AppPressable style={styles.actionButton} onPress={onRemove}>
            <Icon name="person-remove" size={18} />
            <Text role="label" tone="danger" numberOfLines={1}>
              {t('labels.remove')}
            </Text>
          </AppPressable>
        </View>
      )}

      {/* Per-permission overrides (managed members only). */}
      {!!viewer && !!canManage && !!onUpdatePermission && !!showPermissions && (
        <View style={styles.permissionList}>
          {PERMISSION_ROWS.map(({ key, labelKey }) => (
            <View key={key} style={styles.permissionRow}>
              <Text role="caption" style={styles.permissionLabel}>
                {t(labelKey)}
              </Text>
              <BaseSwitch
                accessibilityLabel={t(labelKey)}
                value={member[key]}
                // Switching off is always allowed; on takes holding the flag.
                disabled={!member[key] && !canGrantFlag(viewer, key)}
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
  // `commonStyles.card` supplies padding and `marginBottom`; RN margins do not
  // collapse, so no `marginVertical` here. `gap`, not trailing margins: both
  // children are conditional, and a margin is dead space when neither renders.
  memberCard: {
    gap: theme.spacing.sm,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  // Same reasoning one level down: the email line is conditional too.
  memberInfo: {
    gap: theme.spacing.xs,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderTopWidth: theme.borderWidth.hairline,
    paddingTop: theme.spacing.sm,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    // Two per row: at four, "Permissions" breaks mid-word. `flexGrow` lets a
    // lone third action fill its row.
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
  actionButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  actionButtonText: {
    color: theme.colors.info,
  },
  permissionList: {
    // No `marginTop` — the card's `gap` is the separation now.
    paddingTop: theme.spacing.sm,
    borderTopWidth: theme.borderWidth.hairline,
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
}));
