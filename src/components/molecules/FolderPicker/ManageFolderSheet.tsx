import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import {
  BottomSheetView,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  type BottomSheetModalRef,
} from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import {
  WhiteActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface ManageFolderSheetProps {
  sheetRef: React.RefObject<BottomSheetModalRef | null>;
  modalProps: Partial<BottomSheetModalProps>;
  contentContainerStyle: { paddingBottom: number };
  /** Re-open the folder picker once this sheet finishes dismissing. */
  onDismiss: () => void;
  /** Folder currently being managed (drives the displayed name). */
  managingFolder: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  showDeleteConfirm: boolean;
  onShowDeleteConfirm: (value: boolean) => void;
  onRenameConfirm: () => void;
  onDeleteConfirm: () => void;
  onClose: () => void;
  folderActionLoading: boolean;
  /** Whether rename is available (parent supplied an onRenameFolder). */
  canRename: boolean;
  /** Whether delete is available (parent supplied an onDeleteFolder). */
  canDelete: boolean;
}

/**
 * Rename / delete bottom sheet for a single folder. Presentational — the
 * parent {@link FolderPicker} owns all folder state and the rename/delete
 * orchestration; this component only renders the manage UI and forwards
 * intent via callbacks.
 */
export const ManageFolderSheet: React.FC<ManageFolderSheetProps> = ({
  sheetRef,
  modalProps,
  contentContainerStyle,
  onDismiss,
  managingFolder,
  renameValue,
  onRenameValueChange,
  showDeleteConfirm,
  onShowDeleteConfirm,
  onRenameConfirm,
  onDeleteConfirm,
  onClose,
  folderActionLoading,
  canRename,
  canDelete,
}) => {
  const renameDisabled =
    !renameValue.trim() || renameValue.trim() === managingFolder;

  return (
    <BottomSheetModal
      ref={sheetRef}
      {...modalProps}
      snapPoints={['45%']}
      onDismiss={onDismiss}
    >
      <BottomSheetView
        style={[styles.bottomSheetContent, contentContainerStyle]}
      >
        {/* Header */}
        <View style={styles.manageFolderHeader}>
          <Text size="lg" weight="semibold">
            Manage Folder
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Icon name="close" size={24} tone="textPrimary" />
          </Pressable>
        </View>

        {/* Current folder name */}
        <View style={styles.currentFolderContainer}>
          <Icon name="folder-outline" size={20} tone="primary" />
          <Text size="base" weight="semibold" tone="accent">
            {managingFolder}
          </Text>
        </View>

        {/* Delete Confirmation View */}
        {showDeleteConfirm ? (
          <View style={styles.deleteConfirmContainer}>
            <Icon name="warning-outline" size={32} tone="error" />
            <Text size="lg" weight="semibold" style={styles.deleteConfirmTitle}>
              Delete this folder?
            </Text>
            <Text
              size="base"
              tone="secondary"
              align="center"
              style={styles.deleteConfirmText}
            >
              Recipes in this folder will be moved to "No Folder".
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <AppPressable
                style={styles.deleteConfirmCancelButton}
                onPress={() => onShowDeleteConfirm(false)}
                disabled={folderActionLoading}
              >
                <Text size="base" weight="medium">
                  Cancel
                </Text>
              </AppPressable>
              <AppPressable
                style={styles.deleteConfirmDeleteButton}
                onPress={onDeleteConfirm}
                disabled={folderActionLoading}
              >
                {folderActionLoading ? (
                  <WhiteActivityIndicator size="small" />
                ) : (
                  <Text
                    size="base"
                    weight="semibold"
                    style={styles.deleteConfirmDeleteText}
                  >
                    Delete
                  </Text>
                )}
              </AppPressable>
            </View>
          </View>
        ) : (
          <>
            {/* Rename Section */}
            {!!canRename && (
              <View style={styles.renameSection}>
                <Text
                  size="sm"
                  weight="semibold"
                  tone="secondary"
                  style={styles.sectionLabel}
                >
                  Rename
                </Text>
                <View style={styles.renameInputRow}>
                  <ThemedBottomSheetTextInput
                    style={styles.renameInput}
                    defaultValue={renameValue}
                    onChangeText={onRenameValueChange}
                    placeholder="Enter new folder name..."
                    autoCapitalize="words"
                    onSubmitEditing={onRenameConfirm}
                    editable={!folderActionLoading}
                  />
                  <AppPressable
                    style={[
                      styles.renameButton,
                      renameDisabled && styles.renameButtonDisabled,
                    ]}
                    onPress={onRenameConfirm}
                    disabled={renameDisabled || folderActionLoading}
                  >
                    {folderActionLoading ? (
                      <WhiteActivityIndicator size="small" />
                    ) : (
                      <Text
                        size="base"
                        weight="semibold"
                        style={[
                          styles.renameButtonText,
                          renameDisabled && styles.renameButtonTextDisabled,
                        ]}
                      >
                        Rename
                      </Text>
                    )}
                  </AppPressable>
                </View>
              </View>
            )}

            {/* Delete Section */}
            {!!canDelete && (
              <View style={styles.deleteSection}>
                <AppPressable
                  style={styles.deleteButton}
                  onPress={() => onShowDeleteConfirm(true)}
                  disabled={folderActionLoading}
                >
                  <Icon name="trash-outline" size={18} tone="error" />
                  <Text size="base" weight="medium" tone="error">
                    Delete Folder
                  </Text>
                </AppPressable>
                <Text
                  size="sm"
                  tone="secondary"
                  align="center"
                  style={styles.deleteDescription}
                >
                  Recipes will be moved to No Folder
                </Text>
              </View>
            )}
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    padding: theme.spacing['5'],
  },
  manageFolderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  currentFolderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  renameSection: {
    marginBottom: theme.spacing.lg,
  },
  renameInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
  },
  renameButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  renameButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  renameButtonText: {
    color: theme.colors.white,
  },
  renameButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  deleteSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  deleteDescription: {
    marginTop: theme.spacing.xs,
  },
  deleteConfirmContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  deleteConfirmTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  deleteConfirmText: {
    marginBottom: theme.spacing.lg,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  deleteConfirmCancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  deleteConfirmDeleteButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  deleteConfirmDeleteText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
