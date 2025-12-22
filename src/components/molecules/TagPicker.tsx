import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

export interface TagPickerProps {
  visible: boolean;
  tags: string[];
  selectedTags: string[];
  onSelect: (tags: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  visible,
  tags,
  selectedTags,
  onSelect,
  onCancel,
  loading = false,
}) => {
  const { theme } = useUnistyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalSelectedTags(selectedTags);
      setSearchQuery('');
    }
  }, [visible, selectedTags]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => tag.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  const handleToggleTag = (tag: string) => {
    setLocalSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleClearAll = () => {
    setLocalSelectedTags([]);
  };

  const handleApply = () => {
    setSearchQuery('');
    onSelect(localSelectedTags);
  };

  const handleCancel = () => {
    setSearchQuery('');
    setLocalSelectedTags(selectedTags);
    onCancel();
  };

  const renderTagItem = ({ item }: { item: string }) => {
    const isSelected = localSelectedTags.includes(item);
    return (
      <TouchableOpacity
        style={[styles.tagItem, isSelected && styles.tagItemSelected]}
        onPress={() => handleToggleTag(item)}>
        <Icon
          library="Feather"
          name="tag"
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text
          style={[styles.tagName, isSelected && styles.tagNameSelected]}
          numberOfLines={1}>
          {item}
        </Text>
        {isSelected && (
          <Icon
            library="Feather"
            name="check"
            size={20}
            color={theme.colors.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter by Tags</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Icon
                library="Feather"
                name="x"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          {tags.length > 5 && (
            <View style={styles.searchContainer}>
              <Icon
                library="Feather"
                name="search"
                size={18}
                color={theme.colors.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tags..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Clear All / Selected Count */}
          <View style={styles.selectionRow}>
            <Text style={styles.selectionText}>
              {localSelectedTags.length === 0
                ? 'No tags selected'
                : `${localSelectedTags.length} tag${localSelectedTags.length > 1 ? 's' : ''} selected`}
            </Text>
            {localSelectedTags.length > 0 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Tags List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading tags...</Text>
            </View>
          ) : filteredTags.length > 0 ? (
            <FlatList
              data={filteredTags}
              renderItem={renderTagItem}
              keyExtractor={item => item}
              showsVerticalScrollIndicator={false}
              style={styles.tagList}
              contentContainerStyle={styles.tagListContent}
            />
          ) : tags.length > 0 && searchQuery ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tags match "{searchQuery}"</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tags available</Text>
            </View>
          )}

          {/* Apply Button */}
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing['5'],
    maxHeight: '80%',
    width: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing['3'],
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  selectionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  clearText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    gap: theme.spacing['3'],
  },
  tagItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  tagName: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  tagNameSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.md,
  },
  tagList: {
    maxHeight: 250,
  },
  tagListContent: {
    paddingBottom: theme.spacing.sm,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  applyButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    fontWeight: '600',
  },
}));
