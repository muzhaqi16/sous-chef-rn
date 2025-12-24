import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { toastService } from '#/services/toastService';
import { useSharedBottomSheetConfigs } from '#hooks';

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const animationConfigs = useSharedBottomSheetConfigs();
  const folderPickerRef = useRef<BottomSheetModal>(null);
  const manageSheetRef = useRef<BottomSheetModal>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Manage folder state
  const [managingFolder, setManagingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if folder management is enabled
  const hasFolderActions = Boolean(onRenameFolder || onDeleteFolder);

  // Sync visible prop with bottom sheet ref
  useEffect(() => {
    if (visible) {
      folderPickerRef.current?.present();
    } else {
      folderPickerRef.current?.dismiss();
    }
  }, [visible]);

  // Check if a folder is protected
  const isProtectedFolder = useCallback((folder: string) => {
    return PROTECTED_FOLDERS.includes(folder);
  }, []);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(folder => folder.toLowerCase().includes(query));
  }, [folders, searchQuery]);

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
    folderPickerRef.current?.dismiss();
    manageSheetRef.current?.dismiss();
    setManagingFolder(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
    // Note: onCancel is called by onDismiss callback on BottomSheetModal
  };

  // Handle long-press on folder item - show manage folder bottom sheet
  const handleFolderLongPress = useCallback(
    (folder: string) => {
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
      // Dismiss folder picker first, then present manage sheet after a brief delay
      folderPickerRef.current?.dismiss();
      setTimeout(() => {
        manageSheetRef.current?.present();
      }, 150);
    },
    [hasFolderActions, isProtectedFolder],
  );

  // Handle rename confirmation
  const handleRenameConfirm = useCallback(async () => {
    if (!managingFolder || !renameValue.trim() || !onRenameFolder) return;

    const newName = renameValue.trim();
    if (newName === managingFolder) {
      // No change, just close bottom sheet and re-open folder picker
      manageSheetRef.current?.dismiss();
      setTimeout(() => {
        folderPickerRef.current?.present();
      }, 150);
      setManagingFolder(null);
      setRenameValue('');
      return;
    }

    // Check for duplicate
    if (folders.includes(newName)) {
      Alert.alert('Error', `A folder named "${newName}" already exists.`);
      return;
    }

    const success = await onRenameFolder(managingFolder, newName);
    if (success) {
      // Update selection if renamed folder was selected
      if (selectedFolder === managingFolder) {
        onSelect(newName);
      }
      manageSheetRef.current?.dismiss();
      setTimeout(() => {
        folderPickerRef.current?.present();
      }, 150);
      setManagingFolder(null);
      setRenameValue('');
    }
  }, [
    managingFolder,
    renameValue,
    onRenameFolder,
    folders,
    selectedFolder,
    onSelect,
  ]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!managingFolder || !onDeleteFolder) return;

    const success = await onDeleteFolder(managingFolder);
    if (success) {
      // Reset selection if deleted folder was selected
      if (selectedFolder === managingFolder) {
        onSelect(null);
      }
      manageSheetRef.current?.dismiss();
      setTimeout(() => {
        folderPickerRef.current?.present();
      }, 150);
      setManagingFolder(null);
      setRenameValue('');
      setShowDeleteConfirm(false);
    }
  }, [managingFolder, onDeleteFolder, selectedFolder, onSelect]);

  // Handle manage folder bottom sheet close
  const handleManageFolderClose = useCallback(() => {
    manageSheetRef.current?.dismiss();
    setTimeout(() => {
      folderPickerRef.current?.present();
    }, 150);
    setManagingFolder(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
  }, []);

  const renderFolderItem = ({ item }: { item: string }) => {
    const isSelected = item === selectedFolder;
    return (
      <TouchableOpacity
        style={[styles.folderItem, isSelected && styles.folderItemSelected]}
        onPress={() => handleSelectFolder(item)}
        onLongPress={
          hasFolderActions ? () => handleFolderLongPress(item) : undefined
        }
        delayLongPress={500}
        disabled={folderActionLoading}
      >
        <Icon
          library="Feather"
          name="folder"
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text
          style={[styles.folderName, isSelected && styles.folderNameSelected]}
          numberOfLines={1}
        >
          {item}
        </Text>
        {isSelected && (
          <Icon
            library="Feather"
            name="check"
            size={20}
            color={theme.colors.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Folder Picker Bottom Sheet */}
      <BottomSheetModal
        ref={folderPickerRef}
        snapPoints={['55%', '70%']}
        enablePanDownToClose
        enableDynamicSizing={false}
        topInset={insets.top}
        onDismiss={onCancel}
        animationConfigs={animationConfigs}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={props => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close"
          />
        )}
      >
        <BottomSheetView
          style={[
            styles.bottomSheetContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Select Folder</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Icon
                library="Feather"
                name="x"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          {folders.length > 5 && (
            <View style={styles.searchContainer}>
              <Icon
                library="Feather"
                name="search"
                size={18}
                color={theme.colors.textSecondary}
              />
              <BottomSheetTextInput
                style={styles.searchInput}
                placeholder="Search folders..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* No Folder Option */}
          <TouchableOpacity
            style={[
              styles.folderItem,
              !selectedFolder && styles.folderItemSelected,
            ]}
            onPress={() => handleSelectFolder(null)}
          >
            <Icon
              library="Feather"
              name="inbox"
              size={20}
              color={
                !selectedFolder
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.folderName,
                !selectedFolder && styles.folderNameSelected,
              ]}
            >
              No Folder
            </Text>
            {!selectedFolder && (
              <Icon
                library="Feather"
                name="check"
                size={20}
                color={theme.colors.primary}
              />
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Create New Folder - only shown if allowCreate is true */}
          {allowCreate &&
            (showNewFolder ? (
              <View style={styles.newFolderContainer}>
                <BottomSheetTextInput
                  style={styles.newFolderInput}
                  placeholder="Enter folder name..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  autoCapitalize="words"
                  onSubmitEditing={handleCreateFolder}
                />
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    !newFolderName.trim() && styles.createButtonDisabled,
                  ]}
                  onPress={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  <Text
                    style={[
                      styles.createButtonText,
                      !newFolderName.trim() && styles.createButtonTextDisabled,
                    ]}
                  >
                    Create
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.newFolderButton}
                onPress={() => setShowNewFolder(true)}
              >
                <Icon
                  library="Feather"
                  name="plus"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.newFolderButtonText}>
                  Create New Folder
                </Text>
              </TouchableOpacity>
            ))}

          {/* Existing Folders */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading folders...</Text>
            </View>
          ) : filteredFolders.length > 0 ? (
            <BottomSheetFlatList
              data={filteredFolders}
              renderItem={renderFolderItem}
              keyExtractor={(item: string) => item}
              showsVerticalScrollIndicator={false}
              style={styles.folderList}
              contentContainerStyle={styles.folderListContent}
            />
          ) : folders.length > 0 && searchQuery ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No folders match "{searchQuery}"
              </Text>
            </View>
          ) : null}

          {/* Hint text for folder management */}
          {hasFolderActions && filteredFolders.length > 0 && (
            <Text style={styles.hintText}>
              Long press a folder to edit or delete
            </Text>
          )}

          {/* Loading overlay */}
          {folderActionLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Manage Folder Bottom Sheet */}
      <BottomSheetModal
        ref={manageSheetRef}
        snapPoints={['45%']}
        enablePanDownToClose
        enableDynamicSizing={false}
        topInset={insets.top}
        onDismiss={() => {
          setManagingFolder(null);
          setRenameValue('');
          setShowDeleteConfirm(false);
          // Re-open folder picker after manage sheet closes
          setTimeout(() => {
            folderPickerRef.current?.present();
          }, 150);
        }}
        animationConfigs={animationConfigs}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={props => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close"
          />
        )}
      >
        <BottomSheetView
          style={[
            styles.bottomSheetContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          {/* Header */}
          <View style={styles.manageFolderHeader}>
            <Text style={styles.manageFolderTitle}>Manage Folder</Text>
            <TouchableOpacity
              onPress={handleManageFolderClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                library="Feather"
                name="x"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Current folder name */}
          <View style={styles.currentFolderContainer}>
            <Icon
              library="Feather"
              name="folder"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.currentFolderName}>{managingFolder}</Text>
          </View>

          {/* Delete Confirmation View */}
          {showDeleteConfirm ? (
            <View style={styles.deleteConfirmContainer}>
              <Icon
                library="Feather"
                name="alert-triangle"
                size={32}
                color={theme.colors.error}
              />
              <Text style={styles.deleteConfirmTitle}>Delete this folder?</Text>
              <Text style={styles.deleteConfirmText}>
                Recipes in this folder will be moved to "No Folder".
              </Text>
              <View style={styles.deleteConfirmButtons}>
                <TouchableOpacity
                  style={styles.deleteConfirmCancelButton}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={folderActionLoading}
                >
                  <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteConfirmDeleteButton}
                  onPress={handleDeleteConfirm}
                  disabled={folderActionLoading}
                >
                  {folderActionLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.white}
                    />
                  ) : (
                    <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Rename Section */}
              {onRenameFolder && (
                <View style={styles.renameSection}>
                  <Text style={styles.sectionLabel}>Rename</Text>
                  <View style={styles.renameInputRow}>
                    <BottomSheetTextInput
                      style={styles.renameInput}
                      value={renameValue}
                      onChangeText={setRenameValue}
                      placeholder="Enter new folder name..."
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="words"
                      onSubmitEditing={handleRenameConfirm}
                      editable={!folderActionLoading}
                    />
                    <TouchableOpacity
                      style={[
                        styles.renameButton,
                        (!renameValue.trim() ||
                          renameValue.trim() === managingFolder) &&
                          styles.renameButtonDisabled,
                      ]}
                      onPress={handleRenameConfirm}
                      disabled={
                        !renameValue.trim() ||
                        renameValue.trim() === managingFolder ||
                        folderActionLoading
                      }
                    >
                      {folderActionLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.white}
                        />
                      ) : (
                        <Text
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
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Delete Section */}
              {onDeleteFolder && (
                <View style={styles.deleteSection}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => setShowDeleteConfirm(true)}
                    disabled={folderActionLoading}
                  >
                    <Icon
                      library="Feather"
                      name="trash-2"
                      size={18}
                      color={theme.colors.error}
                    />
                    <Text style={styles.deleteButtonText}>Delete Folder</Text>
                  </TouchableOpacity>
                  <Text style={styles.deleteDescription}>
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
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
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
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  folderNameSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
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
  newFolderButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary,
    fontWeight: '500',
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
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    fontWeight: '600',
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
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  hintText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  manageFolderTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
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
  currentFolderName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
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
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    fontWeight: '600',
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
  deleteButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.error,
    fontWeight: '500',
  },
  deleteDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  // Delete confirmation styles
  deleteConfirmContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  deleteConfirmTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  deleteConfirmText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  deleteConfirmCancelText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  deleteConfirmDeleteButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  deleteConfirmDeleteText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    fontWeight: '600',
  },
}));
