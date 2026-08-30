import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';

interface InlineFolderChooserProps {
  folders: string[];
  selectedFolder: string | null;
  onSelect: (folder: string | null) => void;
  /** Called with a trimmed, non-empty name. The caller owns the folder list. */
  onCreateFolder: (name: string) => void;
}

/**
 * The folder section of a recipe sheet: pick one, or make one. Deliberately NOT
 * `molecules/FolderPicker`, which is a modal of its own — using it here would
 * stack a second sheet over the host. The create affordance keeps its own
 * open/draft state; the caller hears about a folder only once it has a name.
 */
export const InlineFolderChooser: React.FC<InlineFolderChooserProps> = ({
  folders,
  selectedFolder,
  onSelect,
  onCreateFolder,
}) => {
  const { t } = useTranslation();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleSelect = (folder: string | null) => {
    setShowNewFolder(false);
    setNewFolderName('');
    onSelect(folder);
  };

  const handleCreate = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setShowNewFolder(false);
    setNewFolderName('');
    onCreateFolder(trimmed);
  };

  return (
    <>
      <Text
        size="sm"
        weight="semibold"
        tone="secondary"
        style={styles.sectionLabel}
      >
        {t('labels.folder')}
      </Text>

      <View>
        {[null, ...folders].map(folder => {
          const isSelected =
            folder === null ? !selectedFolder : selectedFolder === folder;
          const isNoFolder = folder === null;
          return (
            <AppPressable
              key={folder ?? 'no-folder'}
              style={[
                styles.folderOption,
                isSelected && styles.folderOptionSelected,
              ]}
              onPress={() => handleSelect(folder)}
            >
              <Icon
                name={isNoFolder ? 'folder-outline' : 'folder'}
                size={18}
                tone={isSelected ? 'primary' : 'textSecondary'}
              />
              <Text
                style={[
                  styles.folderOptionText,
                  isSelected && styles.folderOptionTextSelected,
                ]}
              >
                {isNoFolder ? t('labels.noFolder') : folder}
              </Text>
              {!!isSelected && (
                <Icon name="checkmark" size={18} tone="primary" />
              )}
            </AppPressable>
          );
        })}
      </View>

      {showNewFolder ? (
        <View style={styles.newFolderContainer}>
          <ThemedBottomSheetTextInput
            style={styles.newFolderInput}
            placeholder={t('labels.enterFolderName')}
            defaultValue={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
            autoCapitalize="words"
            onSubmitEditing={handleCreate}
          />
          <AppPressable
            style={[
              styles.createButton,
              !newFolderName.trim() && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!newFolderName.trim()}
          >
            <Text
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
          <Icon name="add" size={18} tone="primary" />
          <Text size="base" weight="medium" tone="accent">
            {t('labels.createNewFolder')}
          </Text>
        </AppPressable>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionLabel: {
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  folderOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  folderOptionText: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
  },
  folderOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  newFolderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  newFolderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  createButtonText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.semibold,
  },
  createButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
}));
