import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

const TagListSeparator = () => <View style={styles.tagSeparator} />;

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
  const BottomSheetScrollable = useBottomSheetScrollableCreator();
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      onDismiss: onCancel,
      snapPoints: ['55%', '70%'],
      keyboardBehavior: 'interactive',
    });
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search query when sheet opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setSearchQuery('');
    }
  }

  // Sync visible prop with bottom sheet ref
  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible, ref]);

  const filteredTags = (() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => tag.toLowerCase().includes(query));
  })();

  const handleToggleTag = (tag: string) => {
    const newSelection = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onSelect(newSelection);
  };

  const handleClearAll = () => {
    onSelect([]);
  };

  const renderTagItem = ({ item }: { item: string }) => {
    const isSelected = selectedTags.includes(item);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.tagItem,
          isSelected && styles.tagItemSelected,
          pressed && styles.pressed,
        ]}
        onPress={() => handleToggleTag(item)}
      >
        <Icon
          name="pricetag-outline"
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text
          style={[styles.tagName, isSelected && styles.tagNameSelected]}
          numberOfLines={1}
        >
          {item}
        </Text>
        {!!isSelected && (
          <Icon name="checkmark" size={20} color={theme.colors.primary} />
        )}
      </Pressable>
    );
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView
        style={[styles.bottomSheetContent, contentContainerStyle]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Filter by Tags</Text>
        </View>

        {/* Search Input */}
        {tags.length > 5 && (
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} color={theme.colors.textSecondary} />
            <BottomSheetTextInput
              style={styles.searchInput}
              placeholder="Search tags..."
              placeholderTextColor={theme.colors.textSecondary}
              defaultValue={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Clear All / Selected Count */}
        <View style={styles.selectionRow}>
          <Text style={styles.selectionText}>
            {selectedTags.length === 0
              ? 'No tags selected'
              : `${selectedTags.length} tag${
                  selectedTags.length > 1 ? 's' : ''
                } selected`}
          </Text>
          {selectedTags.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
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
          <FlashList
            renderScrollComponent={BottomSheetScrollable}
            data={filteredTags}
            renderItem={renderTagItem}
            keyExtractor={(item: string) => item}
            extraData={selectedTags}
            showsVerticalScrollIndicator={false}
            style={styles.tagList}
            contentContainerStyle={styles.tagListContent}
            ItemSeparatorComponent={TagListSeparator}
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
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    padding: theme.spacing['5'],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
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
    fontWeight: theme.fonts.weight.medium,
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
    fontWeight: theme.fonts.weight.semibold,
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
  tagSeparator: {
    height: theme.spacing.sm,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
