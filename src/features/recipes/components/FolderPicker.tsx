import React, { useState } from 'react';
import { SearchBar } from '#components/molecules/SearchBar';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
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
import { useOpening } from '#hooks/ui/useOpening';
import { DataStateView } from '#components/organisms/DataStateView';
import { Divider } from '#components/atoms/Divider';
import { FolderNameForm } from '#features/recipes/components/FolderPicker/FolderNameForm';
import { recipesTestIDs } from '#features/recipes/testIDs';

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

  // One sheet at a time: a long-pressed folder hides the picker, the manage
  // sheet opens once the picker has closed, and the picker returns once the
  // manage sheet has closed.
  const [manageVisible, setManageVisible] = useState(false);

  const [managingFolder, setManagingFolder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasFolderActions = Boolean(onRenameFolder ?? onDeleteFolder);

  // One opening of the picker: its search and new-folder form start empty,
  // and a trip to the manage sheet and back keeps them.
  const opening = useOpening(visible);

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
    setShowDeleteConfirm(false);
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!managingFolder || !onRenameFolder) return;
    if (newName === managingFolder) {
      setManageVisible(false);
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
            onClose={onCancel}
          />
        }
      >
        {opening ? (
          <FolderPickerContent
            key={opening.id}
            folders={folders}
            selectedFolder={selectedFolder}
            onSelect={onSelect}
            onLongPress={hasFolderActions ? handleFolderLongPress : undefined}
            loading={loading}
            unavailable={unavailable}
            allowCreate={allowCreate}
            folderActionLoading={folderActionLoading}
          />
        ) : null}
      </Sheet>
      <ManageFolderSheet
        visible={manageVisible}
        onDismiss={handleManageDismiss}
        managingFolder={managingFolder}
        otherFolders={folders.filter(folder => folder !== managingFolder)}
        showDeleteConfirm={showDeleteConfirm}
        onShowDeleteConfirm={setShowDeleteConfirm}
        onRenameConfirm={name => {
          void handleRenameConfirm(name);
        }}
        onDeleteConfirm={handleDeleteConfirm}
        onClose={() => setManageVisible(false)}
        folderActionLoading={folderActionLoading}
        canRename={Boolean(onRenameFolder)}
        canDelete={Boolean(onDeleteFolder)}
      />
    </>
  );
};

type FolderPickerContentProps = Pick<
  FolderPickerProps,
  | 'folders'
  | 'selectedFolder'
  | 'onSelect'
  | 'loading'
  | 'unavailable'
  | 'allowCreate'
  | 'folderActionLoading'
> & { onLongPress: ((folder: string) => void) | undefined };

/** One opening of the picker: a fresh search and no new-folder form. */
const FolderPickerContent: React.FC<FolderPickerContentProps> = ({
  folders,
  selectedFolder,
  onSelect,
  onLongPress,
  loading = false,
  unavailable,
  allowCreate = true,
  folderActionLoading = false,
}) => {
  const { t } = useTranslation();
  const BottomSheetScrollable = useBottomSheetScrollableCreator();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredFolders = useLocalSearch(folders, searchQuery, [identity]);

  const renderFolderItem = ({ item }: { item: string }) => (
    <FolderListItem
      folder={item}
      isSelected={item === selectedFolder}
      onPress={onSelect}
      onLongPress={onLongPress}
    />
  );

  return (
    <View style={styles.bottomSheetContent}>
      {folders.length > 5 && (
        <SearchBar
          placeholder={t('folderPicker.searchPlaceholder')}
          testID={recipesTestIDs.folderSearchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          containerStyle={styles.search}
        />
      )}

      <FolderListItem
        folder={null}
        label={t('labels.noFolder')}
        isSelected={!selectedFolder}
        onPress={onSelect}
      />

      <Divider style={styles.dividerGap} />

      {!!allowCreate &&
        (showNewFolder ? (
          <FolderNameForm
            onSubmit={onSelect}
            actionLabel={t('labels.create')}
            autoFocus
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
          contentContainerStyle={styles.folderListContent}
        />
      ) : folders.length > 0 && searchQuery ? (
        <View style={styles.emptyInset}>
          <Text role="body" tone="secondary" align="center">
            {t('folderPicker.noMatches', { query: searchQuery })}
          </Text>
        </View>
      ) : null}

      {!!onLongPress && filteredFolders.length > 0 && (
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
    paddingHorizontal: theme.layout.pageGutter,
    paddingVertical: theme.spacing.mdPlus,
  },
  search: {
    marginBottom: theme.spacing.md,
  },
}));
