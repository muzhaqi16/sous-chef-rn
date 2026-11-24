import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { NewFolderForm } from '#features/recipes/components/FolderPicker/NewFolderForm';

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
 * open state and its form the draft; the caller hears about a folder only once
 * it has a name.
 */
export const InlineFolderChooser: React.FC<InlineFolderChooserProps> = ({
  folders,
  selectedFolder,
  onSelect,
  onCreateFolder,
}) => {
  const { t } = useTranslation();
  const [showNewFolder, setShowNewFolder] = useState(false);

  const handleSelect = (folder: string | null) => {
    setShowNewFolder(false);
    onSelect(folder);
  };

  const handleCreate = (name: string) => {
    setShowNewFolder(false);
    onCreateFolder(name);
  };

  return (
    <>
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('labels.folder')}
      </SectionHeader>

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
                role="body"
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
        <NewFolderForm onCreate={handleCreate} style={styles.newFolder} />
      ) : (
        <AppPressable
          style={styles.newFolderButton}
          onPress={() => setShowNewFolder(true)}
        >
          <Icon name="add" size={18} tone="primary" />
          <Text role="bodyStrong" tone="accent">
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
    color: theme.colors.textPrimary,
  },
  folderOptionTextSelected: {
    color: theme.colors.primaryText,
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  newFolder: {
    marginTop: theme.spacing.sm,
  },
}));
