import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  type BottomSheetModalRef,
} from '#hooks/useStandardBottomSheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { toastService } from '#/services/toastService';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

/** Protected folders that cannot be renamed or deleted */
const PROTECTED_FOLDERS = ['Favorites'];

export interface FolderPickerProps {
  visible: boolean;
  folders: string[];
  selectedFolder?: string | null;
  onSelect: (folder: string | null) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Allow creating new folders. Set to false for filter-only mode. Default: true */
  allowCreate?: boolean;
  /** Callback for renaming a folder. If provided, enables long-press menu. */
  onRenameFolder?: (oldName: string, newName: string) => Promise<boolean>;
  /** Callback for deleting a folder. If provided, enables long-press menu. */
  onDeleteFolder?: (folderName: string) => Promise<boolean>;
  /** Loading state for folder actions */
  folderActionLoading?: boolean;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  visible,
  folders,
  selectedFolder,
  onSelect,
  onCancel,
  loading = false,
  allowCreate = true,
  onRenameFolder,
  onDeleteFolder,
  folderActionLoading = false,
}) => {
  // Track what should happen after the folder picker dismisses
  const nextSheetActionRef = useRef<'manage' | null>(null);

  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // Per CLAUDE.md: never call present()/dismiss() outside an effect.
  // Drive the manage sub-sheet visibility via state and an effect.
  const [manageVisible, setManageVisible] = useState(false);
  const manageSheetRef = useRef<BottomSheetModalRef>(null);
  useEffect(() => {
    if (manageVisible) {
      manageSheetRef.current?.present();
    } else {
      manageSheetRef.current?.dismiss();
    }
  }, [manageVisible]);

  const {
    ref: folderPickerRef,
    modalProps,
    contentContainerStyle,
  } = useStandardBottomSheet({
    visible,
    onDismiss: () => {
      if (nextSheetActionRef.current === 'manage') {
        nextSheetActionRef.current = null;
        // Effect will dispatch present() once state commits.
        setManageVisible(true);
        return;
      }
      onCancel();
    },
    snapPoints: ['55%', '70%'],
    keyboardBehavior: 'interactive',
  });

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Manage folder state
  const [managingFolder, setManagingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if folder management is enabled
  const hasFolderActions = Boolean(onRenameFolder || onDeleteFolder);

  // Check if a folder is protected
  const isProtectedFolder = (folder: string) => {
    return PROTECTED_FOLDERS.includes(folder);
  };

  const filteredFolders = (() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(folder => folder.toLowerCase().includes(query));
  })();

  const handleSelectFolder = (folder: string | null) => {
    setSearchQuery('');
    setShowNewFolder(false);
    setNewFolderName('');
    onSelect(folder);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      handleSelectFolder(newFolderName.trim());
    }
  };

  const handleCancel = () => {
    setSearchQuery('');
    setShowNewFolder(false);
    setNewFolderName('');
    setManageVisible(false);
    setManagingFolder(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
    // Dismiss in a deferred microtask so the call lands outside of any
    // synchronous render/state-update chain (per CLAUDE.md, present()/
    // dismiss() should not be called from event handlers in-line).
    queueMicrotask(() => folderPickerRef.current?.dismiss());
    // onCancel is called by the picker's onDismiss callback once the
    // dismiss animation completes.
  };

  // Handle long-press on folder item - show manage folder bottom sheet
  const handleFolderLongPress = (folder: string) => {
    // Don't show menu if no actions available
    if (!hasFolderActions) return;

    // Show toast for protected folders
    if (isProtectedFolder(folder)) {
      toastService.info(`"${folder}" cannot be renamed or deleted`);
      return;
    }

    setManagingFolder(folder);
    setRenameValue(folder);
    setShowDeleteConfirm(false);
    // Dismiss folder picker; onDismiss will present manage sheet via state.
    nextSheetActionRef.current = 'manage';
    queueMicrotask(() => folderPickerRef.current?.dismiss());
  };

  // Handle rename confirmation
  const handleRenameConfirm = async () => {
    if (!managingFolder || !renameValue.trim() || !onRenameFolder) return;

    const newName = renameValue.trim();
    if (newName === managingFolder) {
      // No change, just close manage sheet — onDismiss will re-open folder picker
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
      return;
    }

    // Check for duplicate
    if (folders.includes(newName)) {
      alertService.alert(
        'Error',
        `A folder named "${newName}" already exists.`,
      );
      return;
    }

    const success = await onRenameFolder(managingFolder, newName);
    if (success) {
      // Update selection if renamed folder was selected
      if (selectedFolder === managingFolder) {
        onSelect(newName);
      }
      // Close manage sheet — onDismiss will re-open folder picker
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!managingFolder || !onDeleteFolder) return;

    const success = await onDeleteFolder(managingFolder);
    if (success) {
      // Reset selection if deleted folder was selected
      if (selectedFolder === managingFolder) {
        onSelect(null);
      }
      // Close manage sheet — onDismiss will re-open folder picker
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
      setShowDeleteConfirm(false);
    }
  };

  // Handle manage folder bottom sheet close — onDismiss will re-open folder picker
  const handleManageFolderClose = () => {
    setManageVisible(false);
    setManagingFolder(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
  };

  const renderFolderItem = ({ item }: { item: string }) => {
    const isSelected = item === selectedFolder;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.folderItem,
          isSelected && styles.folderItemSelected,
          pressed && styles.pressed,
        ]}
        onPress={() => handleSelectFolder(item)}
        onLongPress={
          hasFolderActions ? () => handleFolderLongPress(item) : undefined
        }
        delayLongPress={500}
        disabled={folderActionLoading}
      >
        <Icon
          name="folder-outline"
          size={20}
          tone={isSelected ? 'primary' : 'textSecondary'}
        />
        <Text
          size="base"
          weight={isSelected ? 'semibold' : 'regular'}
          tone={isSelected ? 'accent' : 'primary'}
          style={styles.folderName}
          numberOfLines={1}
        >
          {item}
        </Text>
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </Pressable>
    );
  };

  return (
    <>
      {/* Folder Picker Bottom Sheet */}
      <BottomSheetModal ref={folderPickerRef} {...modalProps}>
        <BottomSheetView
          style={[styles.bottomSheetContent, contentContainerStyle]}
        >
          <View style={styles.header}>
            <Text size="lg" weight="semibold">
              Select Folder
            </Text>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="close" size={24} tone="textPrimary" />
            </Pressable>
          </View>

          {/* Search Input */}
          {folders.length > 5 && (
            <View style={styles.searchContainer}>
              <Icon name="search" size={18} tone="textSecondary" />
              <ThemedBottomSheetTextInput
                style={styles.searchInput}
                placeholder="Search folders..."
                defaultValue={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* No Folder Option */}
          <Pressable
            style={({ pressed }) => [
              styles.folderItem,
              !selectedFolder && styles.folderItemSelected,
              pressed && styles.pressed,
            ]}
            onPress={() => handleSelectFolder(null)}
          >
            <Icon
              name="mail-outline"
              size={20}
              tone={!selectedFolder ? 'primary' : 'textSecondary'}
            />
            <Text
              size="base"
              weight={!selectedFolder ? 'semibold' : 'regular'}
              tone={!selectedFolder ? 'accent' : 'primary'}
              style={styles.folderName}
            >
              No Folder
            </Text>
            {!selectedFolder && (
              <Icon name="checkmark" size={20} tone="primary" />
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Create New Folder - only shown if allowCreate is true */}
          {!!allowCreate &&
            (showNewFolder ? (
              <View style={styles.newFolderContainer}>
                <ThemedBottomSheetTextInput
                  style={styles.newFolderInput}
                  placeholder="Enter folder name..."
                  defaultValue={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  autoCapitalize="words"
                  onSubmitEditing={handleCreateFolder}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.createButton,
                    !newFolderName.trim() && styles.createButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  <Text
                    size="base"
                    weight="semibold"
                    style={[
                      styles.createButtonText,
                      !newFolderName.trim() && styles.createButtonTextDisabled,
                    ]}
                  >
                    Create
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.newFolderButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowNewFolder(true)}
              >
                <Icon name="add" size={20} tone="primary" />
                <Text size="base" weight="medium" tone="accent">
                  Create New Folder
                </Text>
              </Pressable>
            ))}

          {/* Existing Folders */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text size="base" tone="secondary">
                Loading folders...
              </Text>
            </View>
          ) : filteredFolders.length > 0 ? (
            <FlashList
              renderScrollComponent={BottomSheetScrollable}
              data={filteredFolders}
              renderItem={renderFolderItem}
              keyExtractor={(item: string) => item}
              showsVerticalScrollIndicator={false}
              style={styles.folderList}
              contentContainerStyle={styles.folderListContent}
            />
          ) : folders.length > 0 && searchQuery ? (
            <View style={styles.emptyContainer}>
              <Text size="base" tone="secondary" align="center">
                No folders match "{searchQuery}"
              </Text>
            </View>
          ) : null}

          {/* Hint text for folder management */}
          {!!hasFolderActions && filteredFolders.length > 0 && (
            <Text
              size="sm"
              tone="secondary"
              align="center"
              style={styles.hintText}
            >
              Long press a folder to edit or delete
            </Text>
          )}

          {/* Loading overlay */}
          {!!folderActionLoading && (
            <View style={styles.loadingOverlay}>
              <ThemedActivityIndicator size="large" />
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Manage Folder Bottom Sheet */}
      <BottomSheetModal
        ref={manageSheetRef}
        {...modalProps}
        snapPoints={['45%']}
        onDismiss={() => {
          setManagingFolder(null);
          setRenameValue('');
          setShowDeleteConfirm(false);
          setManageVisible(false);
          // Re-open folder picker — defer until after the manage sheet's
          // dismiss event has flushed so the present call lands cleanly.
          queueMicrotask(() => folderPickerRef.current?.present());
        }}
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
              onPress={handleManageFolderClose}
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
              <Text
                size="lg"
                weight="semibold"
                style={styles.deleteConfirmTitle}
              >
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
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteConfirmCancelButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={folderActionLoading}
                >
                  <Text size="base" weight="medium">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteConfirmDeleteButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleDeleteConfirm}
                  disabled={folderActionLoading}
                >
                  {folderActionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      size="base"
                      weight="semibold"
                      style={styles.deleteConfirmDeleteText}
                    >
                      Delete
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* Rename Section */}
              {!!onRenameFolder && (
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
                      onChangeText={setRenameValue}
                      placeholder="Enter new folder name..."
                      autoCapitalize="words"
                      onSubmitEditing={handleRenameConfirm}
                      editable={!folderActionLoading}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.renameButton,
                        (!renameValue.trim() ||
                          renameValue.trim() === managingFolder) &&
                          styles.renameButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleRenameConfirm}
                      disabled={
                        !renameValue.trim() ||
                        renameValue.trim() === managingFolder ||
                        folderActionLoading
                      }
                    >
                      {folderActionLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text
                          size="base"
                          weight="semibold"
                          style={[
                            styles.renameButtonText,
                            (!renameValue.trim() ||
                              renameValue.trim() === managingFolder) &&
                              styles.renameButtonTextDisabled,
                          ]}
                        >
                          Rename
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Delete Section */}
              {!!onDeleteFolder && (
                <View style={styles.deleteSection}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setShowDeleteConfirm(true)}
                    disabled={folderActionLoading}
                  >
                    <Icon name="trash-outline" size={18} tone="error" />
                    <Text size="base" weight="medium" tone="error">
                      Delete Folder
                    </Text>
                  </Pressable>
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
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing['3'],
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    gap: theme.spacing['3'],
  },
  folderItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  folderName: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.md,
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  newFolderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  newFolderInput: {
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
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.md,
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  createButtonText: {
    color: theme.colors.white,
  },
  createButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  folderList: {
    maxHeight: 250,
  },
  folderListContent: {
    paddingBottom: theme.spacing.sm,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  hintText: {
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.lg,
  },
  // Bottom sheet content
  bottomSheetContent: {
    padding: theme.spacing['5'],
  },
  // Manage folder styles
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
  // Delete confirmation styles
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
