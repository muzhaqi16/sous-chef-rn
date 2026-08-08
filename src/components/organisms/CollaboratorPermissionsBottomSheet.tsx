import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { errorMessageOr } from '#/services/errorService';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { Icon } from '#utils/iconUtils';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { useMutation } from '@apollo/client/react';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { type ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  UpdateCollaboratorRoleDocument,
  UpdateCollaboratorPermissionsDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { BaseSwitch } from '#components/base/BaseSwitch';
import {
  executeMutation,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n/t';
import { ROLE_PERMISSIONS } from '#/constants/collaboratorRoles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { getCollaboratorDisplayName } from '#/utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';

interface CollaboratorPermissionsBottomSheetProps {
  shoppingListId: string;
  onSuccess?: () => void;
}

// The item-level permissions the collaborator fragment carries — these can be
// toggled individually to override the role's defaults.
interface CollabPermissions {
  canAddItems: boolean;
  canEditItems: boolean;
  canRemoveItems: boolean;
  canMarkPurchased: boolean;
}

const PERMISSION_ROWS: { key: keyof CollabPermissions; labelKey: string }[] = [
  { key: 'canAddItems', labelKey: 'shoppingListScreens.permCanAddItems' },
  { key: 'canEditItems', labelKey: 'shoppingListScreens.permCanEditItems' },
  { key: 'canRemoveItems', labelKey: 'shoppingListScreens.permCanRemoveItems' },
  {
    key: 'canMarkPurchased',
    labelKey: 'shoppingListScreens.permCanMarkPurchased',
  },
];

export interface CollaboratorPermissionsBottomSheetRef {
  open: (collaborator: ShoppingListCollaboratorFragment) => void;
  close: () => void;
}

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
  styles.useVariants({ selected: isSelected });
  return (
    <AppPressable
      style={styles.roleCard}
      onPress={onSelect}
      disabled={isSubmitting}
    >
      {children}
    </AppPressable>
  );
}

/** Radio outer + inner circle, selected state via Unistyles variants. */
function RadioMarker({ isSelected }: { isSelected: boolean }) {
  styles.useVariants({ selected: isSelected });
  return (
    <View style={styles.radioOuter}>
      {!!isSelected && <View style={styles.radioInner} />}
    </View>
  );
}

const CollaboratorPermissionsBottomSheet = forwardRef<
  CollaboratorPermissionsBottomSheetRef,
  CollaboratorPermissionsBottomSheetProps
>(({ shoppingListId, onSuccess }, ref) => {
  const [collaborator, setCollaborator] =
    useState<ShoppingListCollaboratorFragment | null>(null);
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole | null>(
    null,
  );
  const [permissions, setPermissions] = useState<CollabPermissions | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    ref: bottomSheetRef,
    modalProps,
    contentContainerStyle,
  } = useStandardBottomSheet({
    visible: isVisible,
    onDismiss: () => setIsVisible(false),
    snapPoints: ['75%', '90%'],
  });

  const [updateRole] = useMutation(UpdateCollaboratorRoleDocument);
  const [updatePermissions] = useMutation(
    UpdateCollaboratorPermissionsDocument,
  );

  useImperativeHandle(ref, () => ({
    open: (collab: ShoppingListCollaboratorFragment) => {
      setCollaborator(collab);
      setSelectedRole(collab.role);
      setPermissions({
        canAddItems: !!collab.canAddItems,
        canEditItems: !!collab.canEditItems,
        canRemoveItems: !!collab.canRemoveItems,
        canMarkPurchased: !!collab.canMarkPurchased,
      });
      setIsVisible(true);
    },
    close: () => {
      setIsVisible(false);
    },
  }));

  const handleSubmit = () => {
    if (!collaborator || !selectedRole || !collaborator.collaboratorId) {
      alertService.alert(t('labels.error'), t('errors.missingRequiredInfo'));
      return;
    }

    if (selectedRole === collaborator.role) {
      // No change, just close
      setIsVisible(false);
      return;
    }

    // Capture narrowed values so the closure below doesn't lose nullability narrowing.
    const collaboratorId = collaborator.collaboratorId;
    const role = selectedRole;

    executeWithLoadingState(
      async () => {
        const result = await updateRole({
          variables: {
            input: {
              shoppingListId,
              collaboratorId,
              role,
            },
          },
        });

        // A resolved error member doesn't throw under errorPolicy:'all' — keep
        // the sheet open and surface it instead of reporting success.
        if (alertIfRejected(result, t('errors.somethingWentWrong'))) {
          return;
        }

        setIsVisible(false);
        onSuccess?.();
      },
      setIsSubmitting,
      (error: unknown) => {
        alertService.alert(
          t('labels.error'),
          errorMessageOr(error, t('errors.somethingWentWrong')),
        );
      },
    );
  };

  // Each permission toggle fires immediately (overriding the role's default)
  // and reverts the switch if the server refuses it.
  const handleTogglePermission = (
    key: keyof CollabPermissions,
    value: boolean,
  ) => {
    if (!collaborator?.collaboratorId || !permissions) return;
    const previous = permissions;
    const next = { ...permissions, [key]: value };
    setPermissions(next);
    const collaboratorId = collaborator.collaboratorId;

    executeMutation(
      async () => {
        const result = await updatePermissions({
          variables: {
            input: { shoppingListId, collaboratorId, permissions: next },
          },
        });
        if (alertIfRejected(result, t('errors.somethingWentWrong'))) {
          setPermissions(previous);
        }
      },
      () => setPermissions(previous),
    );
  };

  // Available roles (excluding OWNER - that's only for list owners)
  const availableRoles = [
    CollaboratorRole.Viewer,
    CollaboratorRole.Shopper,
    CollaboratorRole.Contributor,
    CollaboratorRole.Editor,
    CollaboratorRole.Admin,
  ];

  if (!collaborator) return null;

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps}>
      <BottomSheetHeader
        title={t('collaborators.editPermissions')}
        onCancel={() => setIsVisible(false)}
        onConfirm={handleSubmit}
        confirmLabel={t('labels.update')}
        confirmDisabled={isSubmitting || !selectedRole}
      />
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text size="md" weight="semibold">
            {getCollaboratorDisplayName(collaborator)}
          </Text>
          {!!collaborator.email &&
            collaborator.email !== getCollaboratorDisplayName(collaborator) && (
              <Text size="sm" tone="secondary" style={styles.emailCaption}>
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
                      size={24}
                      tone={isSelected ? 'primary' : 'textSecondary'}
                    />
                    <View>
                      <Text size="md" weight="semibold">
                        {t(roleInfo.labelKey)}
                      </Text>
                      <Text
                        size="sm"
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
                    <Text
                      size="sm"
                      weight="semibold"
                      style={styles.permissionsTitle}
                    >
                      {t('collaboratorRoles.permissionsTitle')}
                    </Text>
                    <View style={styles.permissionsList}>
                      {roleInfo.permissions.map((permission, index) => (
                        <View key={index} style={styles.permissionItem}>
                          <Icon
                            name={permission.granted ? 'checkmark' : 'close'}
                            size={14}
                            tone={
                              permission.granted ? 'success' : 'textSecondary'
                            }
                          />
                          <Text
                            size="sm"
                            style={
                              !permission.granted && styles.permissionDenied
                            }
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
            <Text
              size="sm"
              weight="semibold"
              style={styles.customPermissionsTitle}
            >
              {t('shoppingListScreens.customPermissions')}
            </Text>
            {PERMISSION_ROWS.map(({ key, labelKey }) => (
              <View key={key} style={styles.permissionToggleRow}>
                <Text size="sm" style={styles.permissionToggleLabel}>
                  {t(labelKey)}
                </Text>
                <BaseSwitch
                  value={permissions[key]}
                  onValueChange={value => handleTogglePermission(key, value)}
                />
              </View>
            ))}
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  headerBlock: {
    marginBottom: theme.spacing.lg,
  },
  emailCaption: {
    marginTop: 2,
  },
  rolesContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  roleCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    variants: {
      selected: {
        true: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '10',
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
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    borderWidth: 2,
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
    borderTopWidth: 1,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default CollaboratorPermissionsBottomSheet;
