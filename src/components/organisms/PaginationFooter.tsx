import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

export interface PaginationFooterProps {
  /** Fallback indicator trigger when `isFetchingMore` is not supplied. */
  hasMore: boolean;
  /**
   * A next-page fetch is in flight. When given, the indicator shows only while it
   * is true — so a list that merely HAS more pages never flashes skeleton rows.
   */
  isFetchingMore?: boolean;
  itemCount: number;
  skeletonCount?: number;
  /** Falls back to an ActivityIndicator when absent. */
  SkeletonComponent?: React.ComponentType<{ animated?: boolean }>;
}

/** Infinite-scroll footer. Pass `isFetchingMore` so it shows only during a fetch. */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  hasMore,
  isFetchingMore,
  itemCount,
  skeletonCount = 3,
  SkeletonComponent,
}) => {
  // Falls back to `hasMore` when the caller supplies no `isFetchingMore`.
  const showIndicator = (isFetchingMore ?? hasMore) && itemCount > 0;
  if (!showIndicator) {
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
      <ThemedActivityIndicator size="small" />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  skeletonContainer: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  footerLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
}));
