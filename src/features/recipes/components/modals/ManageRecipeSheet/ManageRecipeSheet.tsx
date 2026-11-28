import React, { useState } from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedActivityIndicator,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { TagInput } from '#features/recipes/components/TagInput';
import { Text } from '#components/atoms/Text';
import { InlineFolderChooser } from '#features/recipes/components/InlineFolderChooser';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Sheet } from '#components/templates/Sheet';
import { useOpening } from '#hooks/ui/useOpening';

export interface ManageRecipeSheetProps {
  visible: boolean;
  onClose: () => void;
  folders: string[];
  availableTags: string[];
  currentFolder?: string | null;
  currentTags?: string[];
  currentNotes?: string | null;
  currentRating?: number | null;
  onUpdateFolder: (folder: string | null) => Promise<void>;
  onUpdateTags: (tags: string[]) => Promise<void>;
  onUpdateNotes: (notes: string) => Promise<void>;
  onUpdateRating: (rating: number | null) => Promise<void>;
  onRemove: () => Promise<void>;
  updating?: boolean;
  recipeName?: string;
}

type ManageRecipeContentProps = Omit<ManageRecipeSheetProps, 'visible'>;

/**
 * One opening. Each change saves as it is made through a local-first write,
 * so the folder, tags and rating read from the props, which hold it at once
 * and roll back on a refusal; only the notes being typed are held here.
 */
const ManageRecipeContent: React.FC<ManageRecipeContentProps> = ({
  onClose,
  folders,
  availableTags,
  currentFolder,
  currentTags = [],
  currentNotes,
  currentRating,
  onUpdateFolder,
  onUpdateTags,
  onUpdateNotes,
  onUpdateRating,
  onRemove,
  updating = false,
  recipeName,
}) => {
  const { t } = useTranslation();

  const [notes, setNotes] = useState(currentNotes ?? '');
  // Folders made here, listed before the write that creates them lands.
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const selectedFolder = currentFolder ?? null;
  const rating = currentRating ?? null;

  const handleCreateFolder = async (name: string) => {
    setLocalFolders(prev => (prev.includes(name) ? prev : [...prev, name]));
    await onUpdateFolder(name);
  };

  const handleNotesBlur = async () => {
    if (notes !== (currentNotes ?? '')) {
      await onUpdateNotes(notes);
    }
  };

  const handleRatingPress = async (star: number) => {
    // Pressing the rating already set clears it.
    await onUpdateRating(rating === star ? null : star);
  };

  const handleRemove = async () => {
    await onRemove();
    onClose();
  };

  // Dedupe folders with "Favorites" first, then existing folders, then locally created
  const allFolders = [...new Set([...folders, ...localFolders])];
  const displayFolders = [
    'Favorites',
    ...allFolders.filter(f => f !== 'Favorites'),
  ];

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text role="subheading">{t('manageRecipe.title')}</Text>
          {!!recipeName && (
            <Text
              role="caption"
              tone="secondary"
              style={styles.recipeName}
              numberOfLines={1}
            >
              {recipeName}
            </Text>
          )}
        </View>
        <View style={styles.headerButtons}>
          <IconButton
            name="trash-outline"
            size="md"
            tone="error"
            onPress={handleRemove}
            accessibilityLabel={t('labels.remove')}
            disabled={updating}
          />
          <IconButton
            name="close"
            size="md"
            tone="textPrimary"
            onPress={onClose}
            accessibilityLabel={t('labels.close')}
          />
        </View>
      </View>

      {/* Loading indicator */}
      {!!updating && (
        <View style={styles.updatingBanner}>
          <ThemedActivityIndicator size="small" />
          <Text role="label" tone="accent">
            {t('manageRecipe.updating')}
          </Text>
        </View>
      )}

      {/* Rating */}
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('manageRecipe.yourRating')}
      </SectionHeader>
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <IconButton
            key={star}
            name={rating !== null && star <= rating ? 'star' : 'star-outline'}
            size="lg"
            tone={
              rating !== null && star <= rating ? 'rating' : 'textSecondary'
            }
            onPress={() => handleRatingPress(star)}
            accessibilityLabel={t('a11y.rateStars', { count: star })}
            disabled={updating}
          />
        ))}
        {rating !== null && (
          <Text role="caption" tone="secondary" style={styles.ratingText}>
            {t('manageRecipe.ratingFormat', { rating })}
          </Text>
        )}
      </View>

      <InlineFolderChooser
        folders={displayFolders}
        selectedFolder={selectedFolder}
        onSelect={folder => {
          void onUpdateFolder(folder);
        }}
        onCreateFolder={folder => {
          void handleCreateFolder(folder);
        }}
      />

      {/* Tags */}
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('labels.tags')}
      </SectionHeader>
      <TagInput
        tags={currentTags}
        onTagsChange={newTags => {
          void onUpdateTags(newTags);
        }}
        suggestions={availableTags}
        placeholder={t('manageRecipe.tagsPlaceholder')}
        editable={!updating}
      />

      {/* Notes */}
      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('manageRecipe.notes')}
      </SectionHeader>
      <ThemedTextInput
        style={styles.notesInput}
        placeholder={t('labels.addAnyNotesAboutThisRecipe')}
        value={notes}
        onChangeText={setNotes}
        onBlur={handleNotesBlur}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!updating}
      />
    </>
  );
};

export const ManageRecipeSheet: React.FC<ManageRecipeSheetProps> = ({
  visible,
  ...content
}) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={content.onClose}
      snapPoints={['85%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening ? <ManageRecipeContent key={opening.id} {...content} /> : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recipeName: {
    marginTop: theme.spacing.xs,
  },
  updatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ratingText: {
    marginLeft: theme.spacing.sm,
  },
  notesInput: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 80,
  },
}));
