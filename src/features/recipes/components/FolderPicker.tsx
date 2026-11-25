import React, { useState } from 'react';
import { SearchBar } from '#components/molecules/SearchBar';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#services/alertService';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { Icon } from '#components/atoms/Icon';
import { toastService } from '#services/toastService';
import { Text } from '#components/atoms/Text';
import { FolderListItem } from '#features/recipes/components/FolderPicker/FolderListItem';
import { ManageFolderSheet } from '#features/recipes/components/FolderPicker/ManageFolderSheet';
import { resolveFolderLongPress } from '#features/recipes/utils/folderProtection';
import { identity, useLocalSearch } from '#hooks/search/useLocalSearch';
import { DataStateView } from '#components/organisms/DataStateView';
import { Divider } from '#components/atoms/Divider';
import { NewFolderForm } from '#features/recipes/components/FolderPicker/NewFolderForm';

// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

interface FolderPickerBaseProps {
  visible: boolean;
  folders: string[];
  selectedFolder?: string | null;
  onSelect: (folder: string | null) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Why the folders could not be read, shown in place of an empty picker. */
  unavailable?: { state: 'offline' | 'error'; onRetry: () => void };
  /** Default true; false for filter-only mode. */
  allowCreate?: boolean;
  folderActionLoading?: boolean;
}

/** Selection only, so there is nothing to protect. */
interface FolderPickerWithoutActionsProps {
  onRenameFolder?: undefined;
  onDeleteFolder?: undefined;
  onSelectedFolderMoved?: undefined;
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
  /**
   * The selected folder's new name after a rename, or null after a delete.
   * Not a pick, so the picker stays as it was.
   */
  onSelectedFolderMoved: (folder: string | null) => void;
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
  unavailable,
  allowCreate = true,
  onRenameFolder,
  onDeleteFolder,
  onSelectedFolderMoved,
  protectedFolders,
  folderActionLoading = false,
}) => {
  const { t } = useTranslation();

  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // One sheet at a time: a long-pressed folder hides the picker, the manage
  // sheet opens once the picker has closed, and the picker returns once the
  // manage sheet has closed.
  const [manageVisible, setManageVisible] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [managingFolder, setManagingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasFolderActions = Boolean(onRenameFolder ?? onDeleteFolder);

  const filteredFolders = useLocalSearch(folders, searchQuery, [identity]);

  const handleSelectFolder = (folder: string | null) => {
    setSearchQuery('');
    setShowNewFolder(false);
    onSelect(folder);
  };

  const handleCancel = () => {
    setSearchQuery('');
    setShowNewFolder(false);
    onCancel();
  };

  const handlePickerDismiss = () => {
    if (managingFolder !== null) {
      setManageVisible(true);
      return;
    }
    onCancel();
  };

  const handleManageDismiss = () => {
    setManageVisible(false);
    setManagingFolder(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
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
  };

  const handleRenameConfirm = async () => {
    if (!managingFolder || !renameValue.trim() || !onRenameFolder) return;

    const newName = renameValue.trim();
    if (newName === managingFolder) {
      setManageVisible(false);
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
        onSelectedFolderMoved(newName);
      }
      setManageVisible(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!managingFolder || !onDeleteFolder) return;

    const success = await onDeleteFolder(managingFolder);
    if (success) {
      if (selectedFolder === managingFolder) {
        onSelectedFolderMoved(null);
      }
      setManageVisible(false);
    }
  };

  const renderFolderItem = ({ item }: { item: string }) => (
    <FolderListItem
      folder={item}
      isSelected={item === selectedFolder}
      onPress={handleSelectFolder}
      onLongPress={hasFolderActions ? handleFolderLongPress : undefined}
    />
  );

  const pickerVisible = visible && managingFolder === null;

  return (
    <>
      <Sheet
        mode="list"
        visible={pickerVisible}
        onDismiss={handlePickerDismiss}
        snapPoints={['55%', '70%']}
        header={
          <SheetHeader
            title={t('folderPicker.selectFolder')}
            onClose={handleCancel}
          />
        }
      >
        <View style={styles.bottomSheetContent}>
          {folders.length > 5 && (
            <SearchBar
              placeholder={t('folderPicker.searchPlaceholder')}
              defaultValue={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              containerStyle={styles.search}
            />
          )}

          <FolderListItem
            folder={null}
            label={t('labels.noFolder')}
            isSelected={!selectedFolder}
            onPress={handleSelectFolder}
          />

          <Divider style={styles.dividerGap} />

          {!!allowCreate &&
            (showNewFolder ? (
              <NewFolderForm
                onCreate={handleSelectFolder}
                style={styles.newFolder}
              />
            ) : (
              <AppPressable
                style={styles.newFolderButton}
                onPress={() => setShowNewFolder(true)}
              >
                <Icon name="add" size="sm" tone="primary" />
                <Text role="bodyStrong" tone="accent">
                  {t('labels.createNewFolder')}
                </Text>
              </AppPressable>
            ))}

          {unavailable ? (
            <DataStateView
              state={unavailable.state}
              onRetry={unavailable.onRetry}
            />
          ) : loading ? (
            <View style={styles.centeredSpinner}>
              <Text role="body" tone="secondary">
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
            <View style={styles.emptyInset}>
              <Text role="body" tone="secondary" align="center">
                {t('folderPicker.noMatches', { query: searchQuery })}
              </Text>
            </View>
          ) : null}

          {!!hasFolderActions && filteredFolders.length > 0 && (
            <Text
              role="caption"
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
        </View>
      </Sheet>
      <ManageFolderSheet
        visible={manageVisible}
        onDismiss={handleManageDismiss}
        managingFolder={managingFolder}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        showDeleteConfirm={showDeleteConfirm}
        onShowDeleteConfirm={setShowDeleteConfirm}
        onRenameConfirm={handleRenameConfirm}
        onDeleteConfirm={handleDeleteConfirm}
        onClose={() => setManageVisible(false)}
        folderActionLoading={folderActionLoading}
        canRename={Boolean(onRenameFolder)}
        canDelete={Boolean(onDeleteFolder)}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  dividerGap: {
    marginVertical: theme.spacing.md,
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  newFolder: {
    marginBottom: theme.spacing.md,
  },
  folderList: {
    maxHeight: 250,
  },
  folderListContent: {
    paddingBottom: theme.spacing.sm,
  },
  centeredSpinner: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyInset: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  hintText: {
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.veil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
  },
  bottomSheetContent: {
    flex: 1,
    padding: theme.spacing.mdPlus,
  },
  search: {
    marginBottom: theme.spacing.md,
  },
}));
