import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSharedBottomSheetConfigs } from '#hooks';
import { TagInput } from '#components';
import { Icon } from '#utils';

export interface SaveRecipeSheetProps {
  visible: boolean;
  onClose: () => void;
  folders: string[];
  availableTags: string[];
  onSave: (options: { folder?: string; tags?: string[]; notes?: string }) => Promise<void>;
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Form state
  const [selectedFolder, setSelectedFolder] = useState<string | null>('Favorites');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [localFolders, setLocalFolders] = useState<string[]>([]); // Track newly created folders

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      setSelectedFolder('Favorites');
      setTags([]);
      setNotes('');
      setShowNewFolder(false);
      setNewFolderName('');
      setLocalFolders([]);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (saving) return;

    await onSave({
      folder: selectedFolder ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  }, [saving, selectedFolder, tags, notes, onSave, onClose]);

  const handleSelectFolder = useCallback((folder: string | null) => {
    setSelectedFolder(folder);
    setShowNewFolder(false);
    setNewFolderName('');
  }, []);

  const handleCreateFolder = useCallback(() => {
    const trimmedName = newFolderName.trim();
    if (trimmedName) {
      // Add to local folders list so it appears in the UI
      setLocalFolders(prev =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName]
      );
      setSelectedFolder(trimmedName);
      setShowNewFolder(false);
      setNewFolderName('');
    }
  }, [newFolderName]);

  // Dedupe folders with "Favorites" first, then existing folders, then locally created folders
  const allFolders = [...new Set([...folders, ...localFolders])];
  const displayFolders = ['Favorites', ...allFolders.filter(f => f !== 'Favorites')];

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['75%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Save Recipe</Text>
            {recipeName && (
              <Text style={styles.recipeName} numberOfLines={1}>
                {recipeName}
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={handleSave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Icon name="checkmark" size={24} color={theme.colors.primary} library="Ionicons" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={24} color={theme.colors.textPrimary} library="Ionicons" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Folder Selection */}
        <Text style={styles.sectionLabel}>Folder</Text>
        <ScrollView
          style={styles.folderList}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
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
              >
                <Icon
                  name={isNoFolder ? 'folder-outline' : 'folder'}
                  size={18}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                  library="Ionicons"
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
                  <Icon
                    name="checkmark"
                    size={18}
                    color={theme.colors.primary}
                    library="Ionicons"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Create New Folder - Outside ScrollView so always visible */}
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
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.newFolderButton}
            onPress={() => setShowNewFolder(true)}
          >
            <Icon name="add" size={18} color={theme.colors.primary} library="Ionicons" />
            <Text style={styles.newFolderButtonText}>Create New Folder</Text>
          </TouchableOpacity>
        )}

        {/* Tags */}
        <Text style={styles.sectionLabel}>Tags (optional)</Text>
        <TagInput
          tags={tags}
          onTagsChange={setTags}
          suggestions={availableTags}
          placeholder="Add tags..."
          maxTags={5}
        />

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <BottomSheetTextInput
          style={styles.notesInput}
          placeholder="Add any notes about this recipe..."
          placeholderTextColor={theme.colors.textSecondary}
          value={notes}
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
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  recipeName: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  folderList: {
    maxHeight: 180,
  },
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
    marginTop: theme.spacing.sm,
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
    color: '#FFFFFF',
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
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    minHeight: 60,
  },
}));
