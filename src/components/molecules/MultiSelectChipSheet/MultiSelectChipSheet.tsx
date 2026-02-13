import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { BottomSheetHeader } from '#/components/atoms/BottomSheetHeader';
import { AnimatedChip } from '#/components/atoms/AnimatedChip';
import { Icon } from '#utils/iconUtils';

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const animationConfigs = useSharedBottomSheetConfigs();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync visible prop with bottom sheet ref
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      setSearchQuery('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.label.toLowerCase().includes(query));
  }, [items, searchQuery]);

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
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['60%', '80%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
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
      <BottomSheetView
        style={[
          styles.bottomSheetContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
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
        {showSearch && (
          <View style={styles.searchContainer}>
            <Icon
              library="Feather"
              name="search"
              size={18}
              color={theme.colors.textSecondary}
            />
            <BottomSheetTextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Selection Counter / Clear All */}
        <View style={styles.selectionRow}>
          <Text style={styles.selectionText}>
            {selectedItems.length === 0
              ? 'No items selected'
              : `${selectedItems.length} selected`}
          </Text>
          {selectedItems.length > 0 && (
            <Pressable onPress={handleClearAll} style={({pressed}) => pressed && styles.pressed}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {/* Chip Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
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
            <Text style={styles.emptyText}>No items match "{searchQuery}"</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items available</Text>
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
  selectionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  clearText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
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
    opacity: 0.7,
  },
}));
