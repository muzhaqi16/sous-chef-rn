import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface PaginationFooterProps {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Current number of items */
  itemCount: number;
  /** Number of skeleton placeholders to show (default: 3) */
  skeletonCount?: number;
  /** Skeleton component to render. Falls back to ActivityIndicator if not provided. */
  SkeletonComponent?: React.ComponentType<{ animated?: boolean }>;
}

/**
 * Reusable pagination footer component for infinite scroll lists
 *
 * When a SkeletonComponent is provided, renders skeleton placeholders that
 * blend seamlessly with the list — the standard pattern for production
 * infinite scroll UX. Falls back to a compact spinner otherwise.
 */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  hasMore,
  itemCount,
  skeletonCount = 3,
  SkeletonComponent,
}) => {
  const { theme } = useUnistyles();

  if (!hasMore || itemCount <= 0) {
    return null;
  }

  if (SkeletonComponent) {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <SkeletonComponent key={index} animated />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  footerLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
}));
