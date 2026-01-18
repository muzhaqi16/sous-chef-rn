import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useSharedBottomSheetConfigs, useBottomSheetBackHandler } from '#hooks';
import { TagInput } from '#components';

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);

  // Local state for editing
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    currentFolder ?? null,
  );
  const [tags, setTags] = useState<string[]>(currentTags);
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [rating, setRating] = useState<number | null>(currentRating ?? null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [localFolders, setLocalFolders] = useState<string[]>([]);

  // Sync local state when props change
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      setSelectedFolder(currentFolder ?? null);
      setTags(currentTags);
      setNotes(currentNotes ?? '');
      setRating(currentRating ?? null);
      setShowNewFolder(false);
      setNewFolderName('');
      setLocalFolders([]);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, currentFolder, currentTags, currentNotes, currentRating]);

  const handleSelectFolder = useCallback(
    async (folder: string | null) => {
      setSelectedFolder(folder);
      setShowNewFolder(false);
      setNewFolderName('');
      await onUpdateFolder(folder);
    },
    [onUpdateFolder],
  );

  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (trimmedName) {
      // Add to local folders list so it appears in the UI
      setLocalFolders(prev =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName]
      );
      setSelectedFolder(trimmedName);
      setShowNewFolder(false);
      setNewFolderName('');
      await onUpdateFolder(trimmedName);
    }
  }, [newFolderName, onUpdateFolder]);

  const handleTagsChange = useCallback(
    async (newTags: string[]) => {
      setTags(newTags);
      await onUpdateTags(newTags);
    },
    [onUpdateTags],
  );

  const handleNotesBlur = useCallback(async () => {
    if (notes !== (currentNotes ?? '')) {
      await onUpdateNotes(notes);
    }
  }, [notes, currentNotes, onUpdateNotes]);

  const handleRatingPress = useCallback(
    async (star: number) => {
      // Toggle off if pressing same rating, otherwise set new rating
      const newRating = rating === star ? null : star;
      setRating(newRating);
      await onUpdateRating(newRating);
    },
    [rating, onUpdateRating],
  );

  const handleRemove = useCallback(async () => {
    await onRemove();
    onClose();
  }, [onRemove, onClose]);

  // Dedupe folders with "Favorites" first, then existing folders, then locally created
  const allFolders = [...new Set([...folders, ...localFolders])];
  const displayFolders = ['Favorites', ...allFolders.filter(f => f !== 'Favorites')];

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['85%', '95%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
    >
      <BottomSheetKeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Manage Recipe</Text>
            {recipeName && (
              <Text style={styles.recipeName} numberOfLines={1}>
                {recipeName}
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={handleRemove}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={updating}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={theme.colors.error}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading indicator */}
        {updating && (
          <View style={styles.updatingBanner}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.updatingText}>Updating...</Text>
          </View>
        )}

        {/* Rating */}
        <Text style={styles.sectionLabel}>Your Rating</Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity
              key={star}
              onPress={() => handleRatingPress(star)}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              disabled={updating}
            >
              <Ionicons
                name={
                  rating !== null && star <= rating ? 'star' : 'star-outline'
                }
                size={32}
                color={
                  rating !== null && star <= rating
                    ? '#FFB800'
                    : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>
          ))}
          {rating !== null && <Text style={styles.ratingText}>{rating}/5</Text>}
        </View>

        {/* Folder Selection */}
        <Text style={styles.sectionLabel}>Folder</Text>
        <View style={styles.folderList}>
          {[null, ...displayFolders].map(folder => {
            const isSelected =
              folder === null ? !selectedFolder : selectedFolder === folder;
            const isNoFolder = folder === null;
            return (
              <TouchableOpacity
                key={folder ?? 'no-folder'}
                style={[
                  styles.folderOption,
                  isSelected && styles.folderOptionSelected,
                ]}
                onPress={() => handleSelectFolder(folder)}
                disabled={updating}
              >
                <Ionicons
                  name={isNoFolder ? 'folder-outline' : 'folder'}
                  size={18}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.folderOptionText,
                    isSelected && styles.folderOptionTextSelected,
                  ]}
                >
                  {isNoFolder ? 'No Folder' : folder}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Create New Folder */}
        {showNewFolder ? (
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
              disabled={!newFolderName.trim() || updating}
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
            disabled={updating}
          >
            <Ionicons name="add" size={18} color={theme.colors.primary} />
            <Text style={styles.newFolderButtonText}>Create New Folder</Text>
          </TouchableOpacity>
        )}

        {/* Tags */}
        <Text style={styles.sectionLabel}>Tags</Text>
        <TagInput
          tags={tags}
          onTagsChange={handleTagsChange}
          suggestions={availableTags}
          placeholder="Add tags..."
          maxTags={5}
          editable={!updating}
        />

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes</Text>
        <BottomSheetTextInput
          style={styles.notesInput}
          placeholder="Add any notes about this recipe..."
          placeholderTextColor={theme.colors.textSecondary}
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
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  recipeName: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  updatingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ratingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  folderList: {},
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
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
    fontWeight: '600',
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  newFolderButtonText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  newFolderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  newFolderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
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
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  createButtonText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.white,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 80,
  },
}));
