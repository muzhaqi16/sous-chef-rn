import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { TagInput } from '#features/recipes/components/TagInput';
import { Text } from '#components/atoms/Text';
import { InlineFolderChooser } from '#features/recipes/components/InlineFolderChooser';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';

export interface SaveRecipeSheetProps {
  visible: boolean;
  onClose: () => void;
  folders: string[];
  availableTags: string[];
  onSave: (options: {
    folder?: string;
    tags?: string[];
    notes?: string;
  }) => Promise<void>;
  saving?: boolean;
  recipeName?: string;
}

export const SaveRecipeSheet: React.FC<SaveRecipeSheetProps> = ({
  visible,
  onClose,
  folders,
  availableTags,
  onSave,
  saving = false,
  recipeName,
}) => {
  const { t } = useTranslation();

  // Form state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    'Favorites',
  );
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [localFolders, setLocalFolders] = useState<string[]>([]); // Track newly created folders

  // Reset form when sheet opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setSelectedFolder('Favorites');
      setTags([]);
      setNotes('');
      setLocalFolders([]);
    }
  }

  const handleSave = async () => {
    if (saving) return;

    await onSave({
      folder: selectedFolder ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  const handleCreateFolder = (name: string) => {
    // Held locally so the new folder appears in the list before the save that
    // will actually create it server-side.
    setLocalFolders(prev => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedFolder(name);
  };

  // Dedupe folders with "Favorites" first, then existing folders, then locally created folders
  const displayFolders = (() => {
    const allFolders = [...new Set([...folders, ...localFolders])];
    return ['Favorites', ...allFolders.filter(f => f !== 'Favorites')];
  })();

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['75%', '95%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      <SheetHeader
        title={t('saveRecipe.title')}
        onClose={onClose}
        confirm={{
          onPress: () => {
            void handleSave();
          },
          loading: saving,
        }}
      />
      {!!recipeName && (
        <Text
          role="caption"
          tone="secondary"
          align="center"
          style={styles.recipeName}
          numberOfLines={1}
        >
          {recipeName}
        </Text>
      )}

      <InlineFolderChooser
        folders={displayFolders}
        selectedFolder={selectedFolder}
        onSelect={setSelectedFolder}
        onCreateFolder={handleCreateFolder}
      />

      {/* Tags */}
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('saveRecipe.tagsOptional')}
      </SectionHeader>
      <TagInput
        tags={tags}
        onTagsChange={setTags}
        suggestions={availableTags}
        placeholder={t('saveRecipe.tagsPlaceholder')}
        maxTags={5}
      />

      {/* Notes */}
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('saveRecipe.notesOptional')}
      </SectionHeader>
      <ThemedBottomSheetTextInput
        style={styles.notesInput}
        placeholder={t('labels.addAnyNotesAboutThisRecipe')}
        defaultValue={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  recipeName: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  notesInput: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 60,
  },
}));
