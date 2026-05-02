import React from 'react';
import { StyleProp, ViewStyle, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface SkeletonListProps {
  /** Number of skeleton items to render */
  count?: number;
  /** Skeleton component to render for each item */
  SkeletonComponent: React.ComponentType;
  /** Additional container styles */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * SkeletonList - Reusable skeleton loading list
 *
 * Renders a scrollable list of skeleton placeholders.
 * Use with useDeferredRender() to show skeletons during navigation transitions.
 *
 * @example
 * ```tsx
 * if (!isReady) {
 *   return <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} />;
 * }
 * ```
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 6,
  SkeletonComponent,
  containerStyle,
}) => (
  <ScrollView
    style={styles.fill}
    contentContainerStyle={[styles.container, containerStyle]}
    showsVerticalScrollIndicator={false}
  >
    {Array.from({ length: count }, (_, index) => (
      <SkeletonComponent key={index} />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  fill: {
    flex: 1,
  },
  container: {
    paddingVertical: theme.spacing['3'],
    gap: theme.spacing.sm,
    flexGrow: 1,
  },
}));
