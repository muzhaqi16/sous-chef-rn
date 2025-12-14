import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Button } from '../base/Button';
import { Icon } from '#utils';
import {
  CollaboratorRole,
  useUpdateCollaboratorRoleMutation,
} from '#generated';

// Define permissions for each role
const ROLE_PERMISSIONS: Record<
  CollaboratorRole,
  {
    label: string;
    description: string;
    icon: string;
    permissions: Array<{ label: string; granted: boolean }>;
  }
> = {
  [CollaboratorRole.Viewer]: {
    label: 'Viewer',
    description: 'Can view the shopping list',
    icon: '👁️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: false },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Mark purchased', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Shopper]: {
    label: 'Shopper',
    description: 'Can mark items as purchased',
    icon: '🛒',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Add items', granted: false },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Contributor]: {
    label: 'Contributor',
    description: 'Can add items and mark as purchased',
    icon: '✏️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Editor]: {
    label: 'Editor',
    description: 'Can add, edit, and remove items',
    icon: '📝',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Admin]: {
    label: 'Admin',
    description: 'Full control including inviting others',
    icon: '⚙️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: true },
    ],
  },
  [CollaboratorRole.Owner]: {
    label: 'Owner',
    description: 'Full control over the shopping list',
    icon: '👑',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: true },
    ],
  },
};

interface CollaboratorPermissionsBottomSheetProps {
  shoppingListId: string;
  collaborator: {
    id: string;
    collaboratorId?: string;
    email: string;
    role: CollaboratorRole;
    status: string;
  } | null;
  onSuccess?: () => void;
}

export interface CollaboratorPermissionsBottomSheetRef {
  open: (collaborator: any) => void;
  close: () => void;
}

const CollaboratorPermissionsBottomSheet = forwardRef<
  CollaboratorPermissionsBottomSheetRef,
  Omit<CollaboratorPermissionsBottomSheetProps, 'collaborator'>
>(({ shoppingListId, onSuccess }, ref) => {
  const { theme } = useUnistyles();
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const [collaborator, setCollaborator] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [updateRole] = useUpdateCollaboratorRoleMutation();

  useImperativeHandle(ref, () => ({
    open: (collab: any) => {
      setCollaborator(collab);
      setSelectedRole(collab.role);
      bottomSheetRef.current?.expand();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSubmit = async () => {
    if (!collaborator || !selectedRole || !collaborator.collaboratorId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (selectedRole === collaborator.role) {
      // No change, just close
      bottomSheetRef.current?.close();
      return;
    }

    setIsSubmitting(true);
    try {
      await updateRole({
        variables: {
          shoppingListId,
          collaboratorId: collaborator.collaboratorId,
          role: selectedRole,
        },
      });

      bottomSheetRef.current?.close();
      onSuccess?.();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to update collaborator role',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Don't clear state here - open() always sets fresh data
    // Clearing here causes race conditions when user quickly reopens the sheet
  };

  // Available roles (excluding OWNER - that's only for list owners)
  const availableRoles = [
    CollaboratorRole.Viewer,
    CollaboratorRole.Shopper,
    CollaboratorRole.Contributor,
    CollaboratorRole.Editor,
    CollaboratorRole.Admin,
  ];

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  if (!collaborator) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={['75%', '90%']}
      enableDynamicSizing={false}
      maxDynamicContentSize={Dimensions.get('window').height * 0.85}
      onClose={handleClose}
      enablePanDownToClose
      animateOnMount={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Edit Permissions</Text>
        <Text style={styles.subtitle}>{collaborator.email}</Text>

        <View style={styles.rolesContainer}>
          {availableRoles.map(role => {
            const roleInfo = ROLE_PERMISSIONS[role];
            const isSelected = selectedRole === role;

            return (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleCard,
                  isSelected && {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary + '10',
                  },
                ]}
                onPress={() => setSelectedRole(role)}
                disabled={isSubmitting}
              >
                <View style={styles.roleHeader}>
                  <View style={styles.roleTitle}>
                    <Text style={styles.roleIcon}>{roleInfo.icon}</Text>
                    <View>
                      <Text style={styles.roleLabel}>{roleInfo.label}</Text>
                      <Text style={styles.roleDescription}>
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
                    {isSelected && (
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
                {isSelected && (
                  <View style={styles.permissionsContainer}>
                    <Text style={styles.permissionsTitle}>Permissions:</Text>
                    <View style={styles.permissionsList}>
                      {roleInfo.permissions.map((permission, index) => (
                        <View key={index} style={styles.permissionItem}>
                          <Icon
                            name={permission.granted ? 'check' : 'close'}
                            size={14}
                            color={
                              permission.granted
                                ? theme.colors.success
                                : theme.colors.textSecondary
                            }
                            library="MaterialIcons"
                          />
                          <Text
                            style={[
                              styles.permissionLabel,
                              !permission.granted && styles.permissionDenied,
                            ]}
                          >
                            {permission.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button
            onPress={handleSubmit}
            disabled={isSubmitting || !selectedRole}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              'Update Role'
            )}
          </Button>
          <Button
            onPress={() => bottomSheetRef.current?.close()}
            variant="secondary"
            disabled={isSubmitting}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
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
  roleIcon: {
    fontSize: theme.typography.fontSize.xl,
  },
  roleLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  roleDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
  permissionLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
  },
  permissionDenied: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
  },
}));

export default CollaboratorPermissionsBottomSheet;
