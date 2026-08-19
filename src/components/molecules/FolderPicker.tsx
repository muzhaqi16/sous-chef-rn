import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
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
import { FolderListItem } from './FolderPicker/FolderListItem';
import { ManageFolderSheet } from './FolderPicker/ManageFolderSheet';

/** Protected folders that cannot be renamed or deleted */
const PROTECTED_FOLDERS = ['Favorites'];

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

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
  const { t } = useTranslation();
  // Track what should happen after the folder picker dismisses
  const nextSheetActionRef = useRef<'manage' | null>(null);

  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // The manage sub-sheet is the folder picker's swap-partner and borrows the
  // picker's modalProps (single useStandardBottomSheet instance), so it stays
  // on the manual ref + effect pattern rather than its own `visible` hook.
  // `manageHasPresentedRef` guards the initial dismiss: gorhom 5.2.14 wedges a
  // modal permanently closed if dismiss() lands while it's still in INITIAL
  // status (never presented) — exactly what the else branch did on first mount
  // with manageVisible=false.
  const [manageVisible, setManageVisible] = useState(false);
  const manageSheetRef = useRef<BottomSheetModalRef>(null);
  const manageHasPresentedRef = useRef(false);
  useEffect(() => {
    if (manageVisible) {
      manageHasPresentedRef.current = true;
      manageSheetRef.current?.present();
    } else if (manageHasPresentedRef.current) {
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
      toastService.info(t('toasts.folderProtected', { folder }));
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
        t('labels.error'),
        t('folderPicker.duplicate', { name: newName }),
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

  const renderFolderItem = ({ item }: { item: string }) => (
    <FolderListItem
      folder={item}
      isSelected={item === selectedFolder}
      onPress={handleSelectFolder}
      onLongPress={hasFolderActions ? handleFolderLongPress : undefined}
      disabled={folderActionLoading}
    />
  );

  return (
    <>
      {/* Folder Picker Bottom Sheet */}
      <BottomSheetModal ref={folderPickerRef} {...modalProps}>
        <BottomSheetView
          style={[styles.bottomSheetContent, contentContainerStyle]}
        >
          <View style={styles.header}>
            <Text size="lg" weight="semibold">
              {t('folderPicker.selectFolder')}
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
                placeholder={t('folderPicker.searchPlaceholder')}
                defaultValue={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* No Folder Option */}
          <AppPressable
            style={[
              styles.folderItem,
              !selectedFolder && styles.folderItemSelected,
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
              {t('labels.noFolder')}
            </Text>
            {!selectedFolder && (
              <Icon name="checkmark" size={20} tone="primary" />
            )}
          </AppPressable>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Create New Folder - only shown if allowCreate is true */}
          {!!allowCreate &&
            (showNewFolder ? (
              <View style={styles.newFolderContainer}>
                <ThemedBottomSheetTextInput
                  style={styles.newFolderInput}
                  placeholder={t('folderPicker.namePlaceholder')}
                  defaultValue={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  autoCapitalize="words"
                  onSubmitEditing={handleCreateFolder}
                />
                <AppPressable
                  style={[
                    styles.createButton,
                    !newFolderName.trim() && styles.createButtonDisabled,
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
                    {t('labels.create')}
                  </Text>
                </AppPressable>
              </View>
            ) : (
              <AppPressable
                style={styles.newFolderButton}
                onPress={() => setShowNewFolder(true)}
              >
                <Icon name="add" size={20} tone="primary" />
                <Text size="base" weight="medium" tone="accent">
                  {t('folderPicker.createNew')}
                </Text>
              </AppPressable>
            ))}

          {/* Existing Folders */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text size="base" tone="secondary">
                {t('folderPicker.loading')}
              </Text>
            </View>
          ) : filteredFolders.length > 0 ? (
            <FlashList
              renderScrollComponent={BottomSheetScrollable}
              data={filteredFolders}
              renderItem={renderFolderItem}
              getItemType={getItemType}
              keyExtractor={(item: string) => item}
              showsVerticalScrollIndicator={false}
              style={styles.folderList}
              contentContainerStyle={styles.folderListContent}
            />
          ) : folders.length > 0 && searchQuery ? (
            <View style={styles.emptyContainer}>
              <Text size="base" tone="secondary" align="center">
                {t('folderPicker.noMatches', { query: searchQuery })}
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
              {t('folderPicker.longPressHint')}
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
      <ManageFolderSheet
        sheetRef={manageSheetRef}
        modalProps={modalProps}
        contentContainerStyle={contentContainerStyle}
        onDismiss={() => {
          setManagingFolder(null);
          setRenameValue('');
          setShowDeleteConfirm(false);
          setManageVisible(false);
          // Re-open folder picker — defer until after the manage sheet's
          // dismiss event has flushed so the present call lands cleanly.
          queueMicrotask(() => folderPickerRef.current?.present());
        }}
        managingFolder={managingFolder}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        showDeleteConfirm={showDeleteConfirm}
        onShowDeleteConfirm={setShowDeleteConfirm}
        onRenameConfirm={handleRenameConfirm}
        onDeleteConfirm={handleDeleteConfirm}
        onClose={handleManageFolderClose}
        folderActionLoading={folderActionLoading}
        canRename={Boolean(onRenameFolder)}
        canDelete={Boolean(onDeleteFolder)}
      />
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
  },
  bottomSheetContent: {
    padding: theme.spacing['5'],
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
