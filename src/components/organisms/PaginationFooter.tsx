import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface PaginationFooterProps {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Current number of items */
  itemCount: number;
}

/**
 * Reusable pagination footer component for infinite scroll lists
 *
 * Shows a compact spinner when more items are available (loading is
 * auto-triggered by onEndReached). Shows nothing when all items are
 * loaded or the list is empty.
 */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  hasMore,
  itemCount,
}) => {
  const { theme } = useUnistyles();

  if (!hasMore || itemCount <= 0) {
    return null;
  }

  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  footerLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
}));
