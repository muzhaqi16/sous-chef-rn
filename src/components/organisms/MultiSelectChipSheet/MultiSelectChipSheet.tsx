import React, { useState } from 'react';
import { SearchBar } from '#components/molecules/SearchBar';
import { SheetHeader } from '#components/templates/SheetHeader';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { StyleSheet } from 'react-native-unistyles';
import { Chip } from '#components/molecules/Chip';
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
  /** What each opening starts from; the picks stay the sheet's until Done. */
  initialSelected: readonly T[];
  /** The picks as they stand when Done is tapped. */
  onDone: (selected: T[]) => void;
  onClose: () => void;
  /** How a tap changes the picks; by default it adds or removes its chip. */
  toggle?: (selected: readonly T[], id: T) => T[];
  loading?: boolean;
  /** When true, only one chip can be selected — tapping a chip replaces the
   *  current selection instead of appending. Used for mutually-exclusive sets
   *  (e.g. a single lifestyle diet). */
  singleSelect?: boolean;
}

type MultiSelectChipContentProps<T extends string> = Pick<
  MultiSelectChipSheetProps<T>,
  | 'title'
  | 'items'
  | 'initialSelected'
  | 'onDone'
  | 'onClose'
  | 'toggle'
  | 'loading'
  | 'singleSelect'
>;

/** One opening: the picks start from `initialSelected`, the search empty. */
function MultiSelectChipContent<T extends string>({
  title,
  items,
  initialSelected,
  onDone,
  onClose,
  toggle,
  loading = false,
  singleSelect = false,
}: MultiSelectChipContentProps<T>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<T[]>([...initialSelected]);

  const filteredItems = useLocalSearch(items, searchQuery, ['label']);

  const handleToggleItem = (id: T) => {
    if (toggle) {
      setSelectedItems(toggle(selectedItems, id));
      return;
    }
    if (singleSelect) {
      // Replace the selection (or clear it when re-tapping the active chip).
      setSelectedItems(selectedItems.includes(id) ? [] : [id]);
      return;
    }
    const newSelection = selectedItems.includes(id)
      ? selectedItems.filter(i => i !== id)
      : [...selectedItems, id];
    setSelectedItems(newSelection);
  };

  const handleClearAll = () => {
    setSelectedItems([]);
  };

  const showSearch = items.length > 8;

  return (
    <View style={styles.bottomSheetContent}>
      <SheetHeaderSlot>
        <SheetHeader
          title={title}
          onClose={onClose}
          confirm={{
            onPress: () => onDone(selectedItems),
            accessibilityLabel: t('labels.done'),
            disabled: loading,
          }}
        />
      </SheetHeaderSlot>
      {/* Search Input */}
      {!!showSearch && (
        <SearchBar
          placeholder={t('multiSelectChipSheet.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          containerStyle={styles.search}
        />
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
              <Chip
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
  onClose,
  initialSelected,
  ...content
}: MultiSelectChipSheetProps<T>) {
  const opening = useOpening(visible, initialSelected);

  return (
    <Sheet
      mode="list"
      visible={visible}
      onDismiss={onClose}
      headerFromContent
      snapPoints={['60%', '80%']}
    >
      {opening ? (
        <MultiSelectChipContent
          key={opening.id}
          {...content}
          initialSelected={opening.payload ?? []}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
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
  search: {
    marginBottom: theme.spacing.md,
  },
}));
