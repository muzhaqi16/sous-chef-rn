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
import { resolveFolderLongPress } from './folderProtection';

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

interface FolderPickerBaseProps {
  visible: boolean;
  folders: string[];
  selectedFolder?: string | null;
  onSelect: (folder: string | null) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Default true; false for filter-only mode. */
  allowCreate?: boolean;
  folderActionLoading?: boolean;
}

/** Selection only, so there is nothing to protect. */
interface FolderPickerWithoutActionsProps {
  onRenameFolder?: undefined;
  onDeleteFolder?: undefined;
  protectedFolders?: string[];
}

/**
 * Folder management offered, so `protectedFolders` is REQUIRED, not defaulted: a
 * caller able to rename and delete cannot compile without declaring what those
 * actions may not touch.
 */
interface FolderPickerWithActionsProps {
  /** Enables the long-press menu. */
  onRenameFolder?: (oldName: string, newName: string) => Promise<boolean>;
  onDeleteFolder?: (folderName: string) => Promise<boolean>;
  /** Folders that cannot be renamed or deleted. */
  protectedFolders: string[];
}

export type FolderPickerProps = FolderPickerBaseProps &
  (FolderPickerWithoutActionsProps | FolderPickerWithActionsProps);

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
  protectedFolders,
  folderActionLoading = false,
}) => {
  const { t } = useTranslation();
  const nextSheetActionRef = useRef<'manage' | null>(null);

  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // The manage sub-sheet borrows the picker's modalProps (one
  // useStandardBottomSheet instance), so it stays on the manual ref + effect
  // pattern. `manageHasPresentedRef` guards the initial dismiss: gorhom 5.2.14
  // wedges a modal closed forever if dismiss() lands before it ever presented.
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

  const [managingFolder, setManagingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasFolderActions = Boolean(onRenameFolder || onDeleteFolder);

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
    // Deferred so the dismiss lands outside any synchronous render/state chain.
    queueMicrotask(() => folderPickerRef.current?.dismiss());
  };

  // The decision lives in `resolveFolderLongPress` so it can be tested — this
  // handler is only reachable through the mocked-away list.
  const handleFolderLongPress = (folder: string) => {
    const outcome = resolveFolderLongPress(folder, {
      hasFolderActions,
      protectedFolders,
    });

    if (outcome.kind === 'ignored') return;

    if (outcome.kind === 'protected') {
      toastService.info(t('toasts.folderProtected', { folder }));
      return;
    }

    setManagingFolder(folder);
    setRenameValue(folder);
    setShowDeleteConfirm(false);
    nextSheetActionRef.current = 'manage';
    queueMicrotask(() => folderPickerRef.current?.dismiss());
  };

  const handleRenameConfirm = async () => {
    if (!managingFolder || !renameValue.trim() || !onRenameFolder) return;

    const newName = renameValue.trim();
    if (newName === managingFolder) {
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
      return;
    }

    if (folders.includes(newName)) {
      alertService.alert(
        t('labels.error'),
        t('folderPicker.duplicate', { name: newName }),
      );
      return;
    }

    const success = await onRenameFolder(managingFolder, newName);
    if (success) {
      if (selectedFolder === managingFolder) {
        onSelect(newName);
      }
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!managingFolder || !onDeleteFolder) return;

    const success = await onDeleteFolder(managingFolder);
    if (success) {
      if (selectedFolder === managingFolder) {
        onSelect(null);
      }
      setManageVisible(false);
      setManagingFolder(null);
      setRenameValue('');
      setShowDeleteConfirm(false);
    }
  };

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

          <View style={styles.divider} />

          {!!allowCreate &&
            (showNewFolder ? (
              <View style={styles.newFolderContainer}>
                <ThemedBottomSheetTextInput
                  style={styles.newFolderInput}
                  placeholder={t('labels.enterFolderName')}
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
                  {t('labels.createNewFolder')}
                </Text>
              </AppPressable>
            ))}

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

          {!!folderActionLoading && (
            <View style={styles.loadingOverlay}>
              <ThemedActivityIndicator size="large" />
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>
      <ManageFolderSheet
        sheetRef={manageSheetRef}
        modalProps={modalProps}
        contentContainerStyle={contentContainerStyle}
        onDismiss={() => {
          setManagingFolder(null);
          setRenameValue('');
          setShowDeleteConfirm(false);
          setManageVisible(false);
          // Deferred until the manage sheet's dismiss event has flushed.
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
