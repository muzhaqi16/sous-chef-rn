import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetHeader } from '#/components/atoms/BottomSheetHeader';
import { AnimatedChip } from '#/components/atoms/AnimatedChip';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

export interface MultiSelectChipSheetItem<T extends string = string> {
  id: T;
  label: string;
}

export interface MultiSelectChipSheetProps<T extends string = string> {
  visible: boolean;
  title: string;
  items: MultiSelectChipSheetItem<T>[];
  selectedItems: T[];
  onSelect: (items: T[]) => void;
  onClose: () => void;
  onDone: () => void;
  loading?: boolean;
}

export function MultiSelectChipSheet<T extends string = string>({
  visible,
  title,
  items,
  selectedItems,
  onSelect,
  onClose,
  onDone,
  loading = false,
}: MultiSelectChipSheetProps<T>) {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      onDismiss: onClose,
      snapPoints: ['60%', '80%'],
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

  const filteredItems = (() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.label.toLowerCase().includes(query));
  })();

  const handleToggleItem = (id: T) => {
    const newSelection = selectedItems.includes(id)
      ? selectedItems.filter(i => i !== id)
      : [...selectedItems, id];
    onSelect(newSelection);
  };

  const handleClearAll = () => {
    onSelect([]);
  };

  const showSearch = items.length > 8;

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView
        style={[styles.bottomSheetContent, contentContainerStyle]}
      >
        <BottomSheetHeader
          title={title}
          onCancel={onClose}
          onConfirm={onDone}
          cancelLabel="Cancel"
          confirmLabel="Done"
          confirmDisabled={loading}
        />

        {/* Search Input */}
        {!!showSearch && (
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} tone="textSecondary" />
            <BottomSheetTextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={theme.colors.textSecondary}
              defaultValue={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Selection Counter / Clear All */}
        <View style={styles.selectionRow}>
          <Text size="sm" tone="secondary">
            {selectedItems.length === 0
              ? 'No items selected'
              : `${selectedItems.length} selected`}
          </Text>
          {selectedItems.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text size="sm" tone="accent" weight="medium">
                Clear all
              </Text>
            </Pressable>
          )}
        </View>

        {/* Chip Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text size="base" tone="secondary">
              Loading...
            </Text>
          </View>
        ) : filteredItems.length > 0 ? (
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.chipContainer}>
              {filteredItems.map(item => (
                <AnimatedChip
                  key={item.id}
                  label={item.label}
                  selected={selectedItems.includes(item.id)}
                  onPress={() => handleToggleItem(item.id)}
                />
              ))}
            </View>
          </BottomSheetScrollView>
        ) : items.length > 0 && searchQuery ? (
          <View style={styles.emptyContainer}>
            <Text size="base" tone="secondary" align="center">
              No items match "{searchQuery}"
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text size="base" tone="secondary" align="center">
              No items available
            </Text>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
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
    marginBottom: theme.spacing.sm,
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
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
