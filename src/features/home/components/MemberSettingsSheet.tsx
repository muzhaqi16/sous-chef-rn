import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { ActionMenuRow } from '#components/molecules/ActionMenuRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { Sheet } from '#components/templates/Sheet';
import { formatRole } from '#/utils/formatters/roleFormatters';
import type { MembershipRole } from '#/graphql/generated/schemaTypes';
import type { MembershipPermissionKey } from '#features/home/types';

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

interface MemberSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  name: string;
  email?: string | null;
  role: MembershipRole;
  /** The roles the viewer may give; fewer than two hides the control. */
  roles: readonly MembershipRole[];
  onChangeRole: (role: MembershipRole) => void;
  permissions: Readonly<Record<MembershipPermissionKey, boolean>>;
  /** Whether the viewer may switch this flag on; off is always allowed. */
  canGrant: (permission: MembershipPermissionKey) => boolean;
  onUpdatePermission?: (
    permission: MembershipPermissionKey,
    value: boolean,
  ) => void;
  /** Absent hides "Make owner". */
  onTransferOwnership?: () => void;
  transferDisabled?: boolean;
  onRemove: () => void;
}

/**
 * One member's role, permissions and actions. A switch writes in place; an
 * action that asks to confirm closes the sheet first.
 */
export const MemberSettingsSheet: React.FC<MemberSettingsSheetProps> = ({
  visible,
  onDismiss,
  name,
  email,
  role,
  roles,
  onChangeRole,
  permissions,
  canGrant,
  onUpdatePermission,
  onTransferOwnership,
  transferDisabled = false,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      mode="action"
      enableDynamicSizing
      snapPoints={[]}
      title={name}
    >
      <View>
        {!!email && (
          <Text role="caption" tone="secondary" style={styles.email}>
            {email}
          </Text>
        )}
        {roles.length > 1 && (
          <SegmentedControl
            label={t('labels.role')}
            options={roles}
            value={role}
            onChange={next => {
              if (next !== role) onChangeRole(next);
            }}
            formatLabel={value => formatRole(value, t)}
          />
        )}
        {!!onUpdatePermission && (
          <View style={styles.permissions}>
            <Text role="label" tone="secondary">
              {t('homeDetail.permissions')}
            </Text>
            {PERMISSION_ROWS.map(({ key, labelKey }) => (
              <SettingSwitch
                key={key}
                title={t(labelKey)}
                value={permissions[key]}
                disabled={!permissions[key] && !canGrant(key)}
                onValueChange={value => onUpdatePermission(key, value)}
                containerStyle={styles.permissionRow}
              />
            ))}
          </View>
        )}
        <View style={styles.actions}>
          {!!onTransferOwnership && (
            <ActionMenuRow
              icon="ribbon-outline"
              label={t('homeDetail.makeOwner')}
              disabled={transferDisabled}
              onPress={() => {
                onDismiss();
                onTransferOwnership();
              }}
            />
          )}
          <ActionMenuRow
            icon="person-remove"
            label={t('labels.remove')}
            destructive
            onPress={() => {
              onDismiss();
              onRemove();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  // Each block owns the space below it, as `SegmentedControl` does.
  email: {
    marginBottom: theme.spacing.md,
  },
  permissions: {
    marginBottom: theme.spacing.lg,
  },
  // The sheet's content owns the gutter.
  permissionRow: {
    paddingHorizontal: 0,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
