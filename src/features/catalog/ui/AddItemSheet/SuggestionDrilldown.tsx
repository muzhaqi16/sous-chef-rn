import React from 'react';
import { View, type CellRendererProps } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { hitSlop } from '#/theme/foundations/sizes';
import { motion } from '#/theme/motion';
import type { BaseSuggestionItem } from '#features/catalog/types';

const CELL_LAYOUT = LinearTransition.duration(motion.timing.MODERATE);

/**
 * Glides each cell to its new place when a row above it leaves or returns.
 * gorhom's list takes no `itemLayoutAnimation`, so the cell carries it, as
 * Reanimated's own FlatList does.
 */
function AnimatedCell<T>({ children, onLayout, style }: CellRendererProps<T>) {
  return (
    <Animated.View layout={CELL_LAYOUT} onLayout={onLayout} style={style}>
      {children}
    </Animated.View>
  );
}

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
 * list scrolls smoothly, and reuses the overview's row renderer so adding from
 * here behaves the same.
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
          hitSlop={hitSlop.md}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Icon name="chevron-back" size={24} tone="textPrimary" />
        </AppPressable>
        <Text role="subheading" style={styles.title}>
          {title}
        </Text>
      </View>
      {/* The rows painted on open do not fade in; one that returns later does. */}
      <LayoutAnimationConfig skipEntering>
        <BottomSheetFlatList
          data={items}
          keyExtractor={(item: T) => item.id}
          renderItem={({ item }: { item: T }) => renderItem(item)}
          CellRendererComponent={AnimatedCell}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyInset}>
              <Text role="body" tone="secondary" align="center">
                {emptyLabel}
              </Text>
            </View>
          }
        />
      </LayoutAnimationConfig>
    </View>
  );
}

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
  // Each row is a RowCard, which carries the gap below it.
  listContent: {
    paddingHorizontal: theme.spacing.md,
  },
  emptyInset: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
}));
