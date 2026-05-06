import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Icon } from '#utils/iconUtils';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { useMutation } from '@apollo/client/react';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { type ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UpdateCollaboratorRoleDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { ROLE_PERMISSIONS } from '#/constants/collaboratorRoles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { getCollaboratorDisplayName } from '#/utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';

interface CollaboratorPermissionsBottomSheetProps {
  shoppingListId: string;
  onSuccess?: () => void;
}

export interface CollaboratorPermissionsBottomSheetRef {
  open: (collaborator: ShoppingListCollaboratorFragment) => void;
  close: () => void;
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
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    ref: bottomSheetRef,
    modalProps,
    contentContainerStyle,
    theme,
  } = useStandardBottomSheet({
    visible: isVisible,
    onDismiss: () => setIsVisible(false),
    snapPoints: ['75%', '90%'],
  });

  const [updateRole] = useMutation(UpdateCollaboratorRoleDocument);

  useImperativeHandle(ref, () => ({
    open: (collab: ShoppingListCollaboratorFragment) => {
      setCollaborator(collab);
      setSelectedRole(collab.role);
      setIsVisible(true);
    },
    close: () => {
      setIsVisible(false);
    },
  }));

  const handleSubmit = () => {
    if (!collaborator || !selectedRole || !collaborator.collaboratorId) {
      alertService.alert('Error', 'Missing required information');
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
        await updateRole({
          variables: {
            input: {
              shoppingListId,
              collaboratorId,
              role,
            },
          },
        });

        setIsVisible(false);
        onSuccess?.();
      },
      setIsSubmitting,
      (error: unknown) => {
        alertService.alert(
          'Error',
          (error as any)?.message || 'Failed to update collaborator role',
        );
      },
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
        title="Edit Permissions"
        onCancel={() => setIsVisible(false)}
        onConfirm={handleSubmit}
        confirmLabel="Update"
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
              <Pressable
                key={role}
                style={({ pressed }) => [
                  styles.roleCard,
                  isSelected && {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary + '10',
                  },
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedRole(role)}
                disabled={isSubmitting}
              >
                <View style={styles.roleHeader}>
                  <View style={styles.roleTitle}>
                    <Text size="xl">{roleInfo.icon}</Text>
                    <View>
                      <Text size="md" weight="semibold">
                        {roleInfo.label}
                      </Text>
                      <Text
                        size="sm"
                        tone="secondary"
                        style={styles.roleDescription}
                      >
                        {roleInfo.description}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && {
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {!!isSelected && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                    )}
                  </View>
                </View>

                {/* Show permissions preview for selected role */}
                {!!isSelected && (
                  <View style={styles.permissionsContainer}>
                    <Text
                      size="sm"
                      weight="semibold"
                      style={styles.permissionsTitle}
                    >
                      Permissions:
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
                            {permission.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
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
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
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
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: theme.radii.full,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default CollaboratorPermissionsBottomSheet;
