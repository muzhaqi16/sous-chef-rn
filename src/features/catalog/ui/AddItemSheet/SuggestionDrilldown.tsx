import React from 'react';
import { View, type FlatListProps } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '#components/atoms/Text';
import { SheetHeader } from '#components/templates/SheetHeader';
import { motion } from '#theme/motion';
import type { BaseSuggestionItem } from '#features/catalog/types';

const CELL_LAYOUT = LinearTransition.duration(motion.timing.MODERATE);

// React Native's typings expose the cell's props only through FlatListProps.
type CellRendererProps<T> = React.ComponentProps<
  NonNullable<FlatListProps<T>['CellRendererComponent']>
>;

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
  /** Section title (e.g. "POPULAR") shown in the step's bar */
  title: string;
  /** Full list of suggestions for the drilled-into source */
  items: T[];
  /** Renders a single suggestion row (shared with the overview) */
  renderItem: (item: T) => React.ReactElement;
  /** Returns to the overview */
  onBack: () => void;
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
  emptyLabel,
}: SuggestionDrilldownProps<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <SheetHeader title={title} onClose={onBack} leading="back" />
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
  // Each row is a RowCard, which carries the gap below it.
  listContent: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  emptyInset: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
}));
