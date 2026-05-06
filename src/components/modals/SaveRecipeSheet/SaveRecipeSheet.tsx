import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { TagInput } from '#components/molecules/TagInput';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

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
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['75%', '95%'],
    });

  // Form state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    'Favorites',
  );
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [localFolders, setLocalFolders] = useState<string[]>([]); // Track newly created folders

  // Reset form when sheet opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setSelectedFolder('Favorites');
      setTags([]);
      setNotes('');
      setShowNewFolder(false);
      setNewFolderName('');
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

  const handleSelectFolder = (folder: string | null) => {
    setSelectedFolder(folder);
    setShowNewFolder(false);
    setNewFolderName('');
  };

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    if (trimmedName) {
      // Add to local folders list so it appears in the UI
      setLocalFolders(prev =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName],
      );
      setSelectedFolder(trimmedName);
      setShowNewFolder(false);
      setNewFolderName('');
    }
  };

  // Dedupe folders with "Favorites" first, then existing folders, then locally created folders
  const displayFolders = (() => {
    const allFolders = [...new Set([...folders, ...localFolders])];
    return ['Favorites', ...allFolders.filter(f => f !== 'Favorites')];
  })();

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text size="lg" weight="semibold">
              Save Recipe
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
              onPress={handleSave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={saving}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Icon name="checkmark" size={24} tone="primary" />
              )}
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

        {/* Folder Selection */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          Folder
        </Text>
        <View style={styles.folderList}>
          {[null, ...displayFolders].map(folder => {
            const isSelected =
              folder === null ? !selectedFolder : selectedFolder === folder;
            const isNoFolder = folder === null;
            return (
              <Pressable
                key={folder ?? 'no-folder'}
                style={({ pressed }) => [
                  styles.folderOption,
                  isSelected && styles.folderOptionSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleSelectFolder(folder)}
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
                  {isNoFolder ? 'No Folder' : folder}
                </Text>
                {!!isSelected && (
                  <Icon name="checkmark" size={18} tone="primary" />
                )}
              </Pressable>
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
              defaultValue={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              autoCapitalize="words"
              onSubmitEditing={handleCreateFolder}
            />
            <Pressable
              style={({ pressed }) => [
                styles.createButton,
                !newFolderName.trim() && styles.createButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              <Text
                style={[
                  styles.createButtonText,
                  !newFolderName.trim() && styles.createButtonTextDisabled,
                ]}
              >
                Create
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.newFolderButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setShowNewFolder(true)}
          >
            <Icon name="add" size={18} tone="primary" />
            <Text size="base" weight="medium" tone="accent">
              Create New Folder
            </Text>
          </Pressable>
        )}

        {/* Tags */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          Tags (optional)
        </Text>
        <TagInput
          tags={tags}
          onTagsChange={setTags}
          suggestions={availableTags}
          placeholder="Add tags..."
          maxTags={5}
        />

        {/* Notes */}
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionLabel}
        >
          Notes (optional)
        </Text>
        <BottomSheetTextInput
          style={styles.notesInput}
          placeholder="Add any notes about this recipe..."
          placeholderTextColor={theme.colors.textSecondary}
          defaultValue={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
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
  sectionLabel: {
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
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
    fontWeight: theme.fonts.weight.semibold,
  },
  createButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 60,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
