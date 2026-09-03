import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { BottomSheetHeader } from '#/components/atoms/BottomSheetHeader';
import { AnimatedChip } from '#/components/atoms/AnimatedChip';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';
import { useLocalSearch } from '#hooks/search/useLocalSearch';

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
  /** When true, only one chip can be selected — tapping a chip replaces the
   *  current selection instead of appending. Used for mutually-exclusive sets
   *  (e.g. a single lifestyle diet). */
  singleSelect?: boolean;
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
  singleSelect = false,
}: MultiSelectChipSheetProps<T>) {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['60%', '80%'],
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

  const filteredItems = useLocalSearch(items, searchQuery, ['label']);

  const handleToggleItem = (id: T) => {
    if (singleSelect) {
      // Replace the selection (or clear it when re-tapping the active chip).
      onSelect(selectedItems.includes(id) ? [] : [id]);
      return;
    }
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
      {/*
        A plain View, NOT `BottomSheetView`: gorhom's own container style is
        absolutely positioned with no bottom and no height, and it composes
        AFTER the caller's — so this `flex: 1` loses and the
        `BottomSheetScrollView` below is never height-bounded.
      */}
      <View style={[styles.bottomSheetContent, contentContainerStyle]}>
        <BottomSheetHeader
          title={title}
          onCancel={onClose}
          onConfirm={onDone}
          cancelLabel={t('labels.cancel')}
          confirmLabel={t('labels.done')}
          confirmDisabled={loading}
        />

        {/* Search Input */}
        {!!showSearch && (
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} tone="textSecondary" />
            <ThemedBottomSheetTextInput
              style={styles.searchInput}
              placeholder={t('multiSelectChipSheet.searchPlaceholder')}
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
              ? t('multiSelect.noneSelected')
              : `${selectedItems.length} selected`}
          </Text>
          {selectedItems.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text size="sm" tone="accent" weight="medium">
                {t('labels.clearAll')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Chip Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text size="base" tone="secondary">
              {t('loading.loading')}
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
              {t('multiSelectChipSheet.noMatches', { query: searchQuery })}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text size="base" tone="secondary" align="center">
              {t('multiSelectChipSheet.noItems')}
            </Text>
          </View>
        )}
      </View>
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
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.base,
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
