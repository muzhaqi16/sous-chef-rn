import React from 'react';
import { View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import type { BaseSuggestionItem } from './types';

interface SuggestionDrilldownProps<T extends BaseSuggestionItem> {
  /** Section title (e.g. "POPULAR") shown next to the back button */
  title: string;
  /** Full list of suggestions for the drilled-into source */
  items: T[];
  /** Renders a single suggestion row (shared with the overview) */
  renderItem: (item: T) => React.ReactElement;
  /** Returns to the overview */
  onBack: () => void;
  /** Accessibility label for the back button */
  backLabel: string;
  /** Message shown when the list has been emptied */
  emptyLabel: string;
}

/**
 * Single-source full list rendered inside the same AddItemSheet — the "More"
 * drill-down target. Uses a virtualized BottomSheetFlatList so a long Popular
 * list scrolls smoothly, and reuses the overview's row renderer (including its
 * quick-add + exit-animation behavior) so adding from here stays consistent.
 */
export function SuggestionDrilldown<T extends BaseSuggestionItem>({
  title,
  items,
  renderItem,
  onBack,
  backLabel,
  emptyLabel,
}: SuggestionDrilldownProps<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppPressable
          onPress={onBack}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Icon name="chevron-back" size={24} tone="textPrimary" />
        </AppPressable>
        <Text size="xl" weight="bold" style={styles.title}>
          {title}
        </Text>
      </View>
      <BottomSheetFlatList
        data={items}
        keyExtractor={(item: T) => item.id}
        renderItem={({ item }: { item: T }) => renderItem(item)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text size="base" tone="secondary" align="center">
              {emptyLabel}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  title: {
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
  },
  separator: {
    height: theme.spacing.xs,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
}));
