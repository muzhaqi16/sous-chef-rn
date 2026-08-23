import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { TagInput } from '#components/molecules/TagInput';
import { Text } from '#components/atoms/Text';
import { InlineFolderChooser } from '#components/molecules/InlineFolderChooser';

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

export const ManageRecipeSheet: React.FC<ManageRecipeSheetProps> = ({
  visible,
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
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['85%', '95%'],
  });

  // Local state for editing
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    currentFolder ?? null,
  );
  const [tags, setTags] = useState<string[]>(currentTags);
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [rating, setRating] = useState<number | null>(currentRating ?? null);
  const [localFolders, setLocalFolders] = useState<string[]>([]);

  // Sync local state when props change (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevCurrentFolder, setPrevCurrentFolder] = useState(currentFolder);
  const [prevCurrentTags, setPrevCurrentTags] = useState(currentTags);
  const [prevCurrentNotes, setPrevCurrentNotes] = useState(currentNotes);
  const [prevCurrentRating, setPrevCurrentRating] = useState(currentRating);
  if (
    visible !== prevVisible ||
    currentFolder !== prevCurrentFolder ||
    currentTags !== prevCurrentTags ||
    currentNotes !== prevCurrentNotes ||
    currentRating !== prevCurrentRating
  ) {
    setPrevVisible(visible);
    setPrevCurrentFolder(currentFolder);
    setPrevCurrentTags(currentTags);
    setPrevCurrentNotes(currentNotes);
    setPrevCurrentRating(currentRating);
    if (visible) {
      setSelectedFolder(currentFolder ?? null);
      setTags(currentTags);
      setNotes(currentNotes ?? '');
      setRating(currentRating ?? null);
      setLocalFolders([]);
    }
  }

  const handleSelectFolder = async (folder: string | null) => {
    setSelectedFolder(folder);
    await onUpdateFolder(folder);
  };

  const handleCreateFolder = async (name: string) => {
    // Held locally so the new folder shows up in the list right away; the
    // mutation below is what makes it real.
    setLocalFolders(prev => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedFolder(name);
    await onUpdateFolder(name);
  };

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags);
    await onUpdateTags(newTags);
  };

  const handleNotesBlur = async () => {
    if (notes !== (currentNotes ?? '')) {
      await onUpdateNotes(notes);
    }
  };

  const handleRatingPress = async (star: number) => {
    // Toggle off if pressing same rating, otherwise set new rating
    const newRating = rating === star ? null : star;
    setRating(newRating);
    await onUpdateRating(newRating);
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
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetKeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text size="xl" weight="semibold">
              {t('manageRecipe.title')}
            </Text>
            {!!recipeName && (
              <Text
                size="sm"
                tone="secondary"
                style={styles.recipeName}
                numberOfLines={1}
              >
                {recipeName}
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              onPress={handleRemove}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={updating}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="trash-outline" size={22} tone="error" />
            </Pressable>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="close" size={24} tone="textPrimary" />
            </Pressable>
          </View>
        </View>

        {/* Loading indicator */}
        {!!updating && (
          <View style={styles.updatingBanner}>
            <ThemedActivityIndicator size="small" />
            <Text size="sm" weight="medium" tone="accent">
              {t('manageRecipe.updating')}
            </Text>
          </View>
        )}

        {/* Rating */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          {t('manageRecipe.yourRating')}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map(star => (
            <Pressable
              key={star}
              onPress={() => handleRatingPress(star)}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              disabled={updating}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon
                name={
                  rating !== null && star <= rating ? 'star' : 'star-outline'
                }
                size={32}
                color={
                  rating !== null && star <= rating ? '#FFB800' : undefined
                }
                tone={
                  rating !== null && star <= rating
                    ? undefined
                    : 'textSecondary'
                }
              />
            </Pressable>
          ))}
          {rating !== null && (
            <Text size="sm" tone="secondary" style={styles.ratingText}>
              {t('manageRecipe.ratingFormat', { rating })}
            </Text>
          )}
        </View>

        <InlineFolderChooser
          folders={displayFolders}
          selectedFolder={selectedFolder}
          onSelect={handleSelectFolder}
          onCreateFolder={handleCreateFolder}
        />

        {/* Tags */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          {t('manageRecipe.tags')}
        </Text>
        <TagInput
          tags={tags}
          onTagsChange={handleTagsChange}
          suggestions={availableTags}
          placeholder={t('manageRecipe.tagsPlaceholder')}
          maxTags={5}
          editable={!updating}
        />

        {/* Notes */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          {t('manageRecipe.notes')}
        </Text>
        <ThemedBottomSheetTextInput
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
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 80,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
