import React from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';
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
  <ScrollView contentContainerStyle={[styles.container, containerStyle]}>
    {Array.from({ length: count }, (_, index) => (
      <SkeletonComponent key={index} />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
}));
