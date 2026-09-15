import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

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
  const { t } = useTranslation();
  const networkWithheld = useIsApiUnavailable();

  if (itemCount === 0) return null;

  // With no network leg the next page cannot arrive, so say why the list stops
  // instead of spinning or ending silently.
  if (hasMore && networkWithheld && !isFetchingMore) {
    return (
      <Text role="footnote" tone="secondary" style={styles.footerNotice}>
        {t('errors.offlineNoMorePages')}
      </Text>
    );
  }

  // Falls back to `hasMore` when the caller supplies no `isFetchingMore`.
  if (!(isFetchingMore ?? hasMore)) return null;

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
  // No gap and no top margin: every skeleton row carries `commonStyles.rowWrapper`,
  // whose `rowGap` already spaces it from the row above — the last real one included.
  skeletonContainer: {},
  footerLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  footerNotice: {
    paddingVertical: theme.spacing.lg,
    textAlign: 'center',
  },
}));
