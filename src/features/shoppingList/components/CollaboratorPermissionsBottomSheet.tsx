import React, { useState } from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#services/alertService';
import { localizedErrorMessage } from '#services/errorService';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { Icon } from '#components/atoms/Icon';
import { CollaboratorRole } from '#graphql/generated/schemaTypes';
import type { ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  useCollaboratorPermissions,
  type CollabPermissions,
} from '#features/shoppingList/hooks/useCollaboratorPermissions';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { executeWithLoadingState } from '#utils/finallyHelpers';
import { useTranslation, type TranslationKey } from '#i18n';
import { ROLE_PERMISSIONS } from '#features/shoppingList/components/collaboratorRoles';
import { getCollaboratorDisplayName } from '#utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';

interface CollaboratorPermissionsBottomSheetProps {
  shoppingListId: string;
  /** The collaborator being edited; null closes the sheet. */
  collaborator: ShoppingListCollaboratorFragment | null;
  onDismiss: () => void;
  onSuccess?: () => void;
}

const PERMISSION_ROWS: {
  key: keyof CollabPermissions;
  labelKey: TranslationKey;
}[] = [
  { key: 'canAddItems', labelKey: 'labels.canAddItems' },
  { key: 'canEditItems', labelKey: 'shoppingListScreens.permCanEditItems' },
  { key: 'canRemoveItems', labelKey: 'labels.canRemoveItems' },
  {
    key: 'canMarkPurchased',
    labelKey: 'shoppingListScreens.permCanMarkPurchased',
  },
];

/** Role card with selected-state styling driven by Unistyles variants. */
function RoleCard({
  isSelected,
  isSubmitting,
  onSelect,
  children,
}: {
  isSelected: boolean;
  isSubmitting: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const variantStyles = styles.useVariants({ selected: isSelected });
  return (
    <AppPressable
      style={variantStyles.roleCard}
      onPress={onSelect}
      disabled={isSubmitting}
    >
      {children}
    </AppPressable>
  );
}

/** Radio outer + inner circle, selected state via Unistyles variants. */
function RadioMarker({ isSelected }: { isSelected: boolean }) {
  const variantStyles2 = styles.useVariants({ selected: isSelected });
  return (
    <View style={variantStyles2.radioOuter}>
      {!!isSelected && <View style={variantStyles2.radioInner} />}
    </View>
  );
}

const CollaboratorPermissionsBottomSheet: React.FC<
  CollaboratorPermissionsBottomSheetProps
> = ({ collaborator, onDismiss, ...content }) => {
  const opening = useOpening(collaborator !== null, collaborator);

  return (
    <Sheet
      mode="action"
      visible={collaborator !== null}
      onDismiss={onDismiss}
      headerFromContent
      snapPoints={['75%', '90%']}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      {opening?.payload ? (
        <CollaboratorPermissions
          key={opening.id}
          {...content}
          collaborator={opening.payload}
          onDismiss={onDismiss}
        />
      ) : null}
    </Sheet>
  );
};

/** One opening: the role and switches start from the collaborator as opened. */
const CollaboratorPermissions: React.FC<
  Omit<CollaboratorPermissionsBottomSheetProps, 'collaborator'> & {
    collaborator: ShoppingListCollaboratorFragment;
  }
> = ({ shoppingListId, collaborator, onDismiss, onSuccess }) => {
  // `useTranslation` and not the module-level `t`: every label in this sheet is
  // read during render, so the module-level helper leaves them showing the old
  // language until something else happens to re-render the sheet.
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole | null>(
    collaborator.role,
  );
  const [permissions, setPermissions] = useState<CollabPermissions | null>({
    canAddItems: !!collaborator.canAddItems,
    canEditItems: !!collaborator.canEditItems,
    canRemoveItems: !!collaborator.canRemoveItems,
    canMarkPurchased: !!collaborator.canMarkPurchased,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateRole, updatePermissions } =
    useCollaboratorPermissions(shoppingListId);

  const handleSubmit = () => {
    if (!selectedRole || !collaborator.collaboratorId) {
      alertService.alert(t('labels.error'), t('errors.missingRequiredInfo'));
      return;
    }

    if (selectedRole === collaborator.role) {
      // No change, just close
      onDismiss();
      return;
    }

    // Capture narrowed values so the closure below doesn't lose nullability narrowing.
    const collaboratorId = collaborator.collaboratorId;
    const role = selectedRole;

    void executeWithLoadingState(
      async () => {
        // A refusal was alerted by the hook; the sheet stays open.
        if (!(await updateRole(collaboratorId, role))) return;

        onDismiss();
        onSuccess?.();
      },
      setIsSubmitting,
      (error: unknown) => {
        alertService.alert(
          t('labels.error'),
          localizedErrorMessage(error, t('errors.codes.genericRetry')),
        );
      },
    );
  };

  // Each permission toggle fires immediately (overriding the role's default)
  // and reverts the switch if the server refuses it.
  const handleTogglePermission = async (
    key: keyof CollabPermissions,
    value: boolean,
  ) => {
    if (!collaborator.collaboratorId || !permissions) return;
    const previous = permissions;
    const next = { ...permissions, [key]: value };
    setPermissions(next);
    const collaboratorId = collaborator.collaboratorId;

    if (!(await updatePermissions(collaboratorId, next))) {
      setPermissions(previous);
    }
  };

  // Available roles (excluding OWNER - that's only for list owners)
  const availableRoles = [
    CollaboratorRole.Viewer,
    CollaboratorRole.Shopper,
    CollaboratorRole.Contributor,
    CollaboratorRole.Editor,
    CollaboratorRole.Admin,
  ];

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('collaborators.editPermissions')}
          onClose={onDismiss}
          confirm={{
            onPress: handleSubmit,
            accessibilityLabel: t('labels.update'),
            disabled: !selectedRole,
            loading: isSubmitting,
          }}
        />
      </SheetHeaderSlot>
      <View style={styles.headerBlock}>
        <Text role="bodyStrong">
          {getCollaboratorDisplayName(collaborator, t)}
        </Text>
        {!!collaborator.email &&
          collaborator.email !==
            getCollaboratorDisplayName(collaborator, t) && (
            <Text role="caption" tone="secondary" style={styles.emailCaption}>
              {collaborator.email}
            </Text>
          )}
      </View>

      <View style={styles.rolesContainer}>
        {availableRoles.map(role => {
          const roleInfo = ROLE_PERMISSIONS[role];
          const isSelected = selectedRole === role;

          return (
            <RoleCard
              key={role}
              isSelected={isSelected}
              isSubmitting={isSubmitting}
              onSelect={() => setSelectedRole(role)}
            >
              <View style={styles.roleHeader}>
                <View style={styles.roleTitle}>
                  <Icon
                    name={roleInfo.icon}
                    size="md"
                    tone={isSelected ? 'primary' : 'textSecondary'}
                  />
                  <View>
                    <Text role="bodyStrong">{t(roleInfo.labelKey)}</Text>
                    <Text
                      role="caption"
                      tone="secondary"
                      style={styles.roleDescription}
                    >
                      {t(roleInfo.descriptionKey)}
                    </Text>
                  </View>
                </View>
                <RadioMarker isSelected={isSelected} />
              </View>

              {/* Show permissions preview for selected role */}
              {!!isSelected && (
                <View style={styles.permissionsContainer}>
                  <Text role="label" style={styles.permissionsTitle}>
                    {t('collaboratorRoles.permissionsTitle')}
                  </Text>
                  <View style={styles.permissionsList}>
                    {roleInfo.permissions.map((permission, index) => (
                      <View key={index} style={styles.permissionItem}>
                        <Icon
                          name={permission.granted ? 'checkmark' : 'close'}
                          size="2xsPlus"
                          tone={
                            permission.granted ? 'success' : 'textSecondary'
                          }
                        />
                        <Text
                          role="caption"
                          style={!permission.granted && styles.permissionDenied}
                        >
                          {t(permission.labelKey)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </RoleCard>
          );
        })}
      </View>

      {/* Granular per-permission overrides on top of the selected role. */}
      {!!permissions && (
        <View style={styles.customPermissions}>
          <Text role="label" style={styles.customPermissionsTitle}>
            {t('shoppingListScreens.customPermissions')}
          </Text>
          {PERMISSION_ROWS.map(({ key, labelKey }) => (
            <View key={key} style={styles.permissionToggleRow}>
              <Text role="caption" style={styles.permissionToggleLabel}>
                {t(labelKey)}
              </Text>
              <BaseSwitch
                accessibilityLabel={t(labelKey)}
                value={permissions[key]}
                onValueChange={value => handleTogglePermission(key, value)}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.lg,
  },
  headerBlock: {
    marginBottom: theme.spacing.lg,
  },
  emailCaption: {
    marginTop: theme.spacing['2xs'],
  },
  rolesContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  roleCard: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    variants: {
      selected: {
        true: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primaryLight,
        },
      },
    },
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  roleDescription: {
    marginTop: theme.spacing['2xs'],
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      selected: {
        true: { borderColor: theme.colors.primary },
      },
    },
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
  permissionsContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
  },
  permissionsTitle: {
    marginBottom: theme.spacing.sm,
  },
  permissionsList: {
    gap: theme.spacing.xs,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  permissionDenied: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  customPermissions: {
    marginBottom: theme.spacing.lg,
  },
  customPermissionsTitle: {
    marginBottom: theme.spacing.sm,
  },
  permissionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  permissionToggleLabel: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
}));

export default CollaboratorPermissionsBottomSheet;
