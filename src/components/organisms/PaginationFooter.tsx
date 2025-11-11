import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface PaginationFooterProps {
  /** Whether currently loading more items */
  isLoadingMore: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether the query is currently loading (initial or more) */
  loading: boolean;
  /** Current number of items */
  itemCount: number;
  /** Custom loading text (default: "Loading more items...") */
  loadingText?: string;
  /** Custom hint text (default: "Scroll to load more") */
  hintText?: string;
  /** Whether to show activity indicator (default: true) */
  showActivityIndicator?: boolean;
}

/**
 * Reusable pagination footer component for infinite scroll lists
 *
 * Shows appropriate feedback based on pagination state:
 * - Loading indicator + text when loading more
 * - Hint text when more items available
 * - Nothing when no more items or initial load
 *
 * @example
 * <FlatList
 *   data={items}
 *   onEndReached={loadMore}
 *   onEndReachedThreshold={0.5}
 *   ListFooterComponent={
 *     <PaginationFooter
 *       isLoadingMore={isLoadingMore}
 *       hasMore={hasMore}
 *       loading={loading}
 *       itemCount={items.length}
 *     />
 *   }
 * />
 */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  isLoadingMore,
  hasMore,
  loading,
  itemCount,
  loadingText = 'Loading more items...',
  hintText = 'Scroll to load more',
  showActivityIndicator = true,
}) => {
  const { theme } = useUnistyles();

  // Show loading indicator when loading more items
  if (isLoadingMore) {
    return (
      <View style={styles.footerLoader}>
        {showActivityIndicator && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.activityIndicator}
          />
        )}
        <Text style={styles.footerText}>{loadingText}</Text>
      </View>
    );
  }

  // Show hint when more items available and not loading and have items
  if (hasMore && !loading && itemCount > 0) {
    return (
      <View style={styles.footerHint}>
        <Text style={styles.footerHintText}>{hintText}</Text>
      </View>
    );
  }

  // Show nothing during initial load or when no more items
  return null;
};

const styles = StyleSheet.create(theme => ({
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  activityIndicator: {
    marginRight: theme.spacing.xs,
  },
  footerText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  footerHint: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  footerHintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
}));
