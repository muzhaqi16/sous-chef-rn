import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

export interface PaginationFooterProps {
  /** Whether there are more pages to load. Used as the fallback indicator
   *  trigger when `isFetchingMore` is not supplied (legacy behavior). */
  hasMore: boolean;
  /**
   * Whether a next-page fetch is currently in flight. When provided, the
   * footer shows its loading indicator ONLY while this is true. A list that
   * merely *has* more pages — or grows a local render window synchronously —
   * therefore never flashes persistent skeleton rows at the bottom, which is
   * the common cause of "the list flickers while paginating."
   */
  isFetchingMore?: boolean;
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
 *
 * Pass `isFetchingMore` so the indicator appears only while a page is actually
 * loading; otherwise it falls back to `hasMore` for backward compatibility.
 */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  hasMore,
  isFetchingMore,
  itemCount,
  skeletonCount = 3,
  SkeletonComponent,
}) => {
  // Show the indicator only while a fetch is in flight. When the caller doesn't
  // supply `isFetchingMore`, fall back to `hasMore` (legacy callers).
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
