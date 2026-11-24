import React, { useState } from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { useLocalSearch } from '#hooks/search/useLocalSearch';
import { EmptyState } from '#components/molecules/EmptyState';
import { useOpening } from '#hooks/ui/useOpening';

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

type MultiSelectChipContentProps<T extends string> = Pick<
  MultiSelectChipSheetProps<T>,
  'items' | 'selectedItems' | 'onSelect' | 'loading' | 'singleSelect'
>;

/** One opening: the search starts empty. */
function MultiSelectChipContent<T extends string>({
  items,
  selectedItems,
  onSelect,
  loading = false,
  singleSelect = false,
}: MultiSelectChipContentProps<T>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

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
    <View style={styles.bottomSheetContent}>
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
        <Text role="caption" tone="secondary">
          {selectedItems.length === 0
            ? t('multiSelect.noneSelected')
            : t('multiSelect.selectedCount', {
                count: selectedItems.length,
              })}
        </Text>
        {selectedItems.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text role="label" tone="accent">
              {t('labels.clearAll')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Chip Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text tone="secondary">{t('loading.loading')}</Text>
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
        <EmptyState
          size="compact"
          title={t('multiSelectChipSheet.noMatches', { query: searchQuery })}
        />
      ) : (
        <EmptyState size="compact" title={t('multiSelectChipSheet.noItems')} />
      )}
    </View>
  );
}

export function MultiSelectChipSheet<T extends string = string>({
  visible,
  title,
  onClose,
  onDone,
  ...content
}: MultiSelectChipSheetProps<T>) {
  const { t } = useTranslation();
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="list"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['60%', '80%']}
      header={
        <SheetHeader
          title={title}
          onClose={onClose}
          confirm={{
            onPress: onDone,
            accessibilityLabel: t('labels.done'),
            disabled: content.loading,
          }}
        />
      }
    >
      {opening ? (
        <MultiSelectChipContent key={opening.id} {...content} />
      ) : null}
    </Sheet>
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
    ...theme.type.body,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
