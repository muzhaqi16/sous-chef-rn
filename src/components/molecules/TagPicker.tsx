import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

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
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onCancel,
    snapPoints: ['55%', '70%'],
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
          tone={isSelected ? 'primary' : 'textSecondary'}
        />
        <Text
          size="base"
          weight={isSelected ? 'semibold' : 'regular'}
          tone={isSelected ? 'accent' : 'primary'}
          style={styles.tagName}
          numberOfLines={1}
        >
          {item}
        </Text>
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </Pressable>
    );
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView
        style={[styles.bottomSheetContent, contentContainerStyle]}
      >
        <View style={styles.header}>
          <Text size="lg" weight="semibold">
            Filter by Tags
          </Text>
        </View>

        {/* Search Input */}
        {tags.length > 5 && (
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} tone="textSecondary" />
            <ThemedBottomSheetTextInput
              style={styles.searchInput}
              placeholder="Search tags..."
              defaultValue={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Clear All / Selected Count */}
        <View style={styles.selectionRow}>
          <Text size="sm" tone="secondary">
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
              <Text size="sm" weight="medium" tone="accent">
                Clear all
              </Text>
            </Pressable>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Tags List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text size="base" tone="secondary">
              Loading tags...
            </Text>
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
            <Text size="base" tone="secondary" align="center">
              No tags match "{searchQuery}"
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text size="base" tone="secondary" align="center">
              No tags available
            </Text>
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
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
