import React, { useRef } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  FlashList,
  type ListRenderItemInfo,
  type FlashListRef,
} from '@shopify/flash-list';

import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import type { IconName } from '#utils/iconUtils';
import { DataStateView } from '#components/organisms/DataStateView';
import type { DataState } from '#hooks/data/useDataState';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { EmptyState } from '#components/molecules/EmptyState';
import { SubScreen } from './SubScreen';
import { useScreenListInset } from './useScreenListInset';

export interface PaginatedHistoryScreenProps<T> {
  title: string;
  /** The entity the history belongs to. */
  subtitle?: string;
  items: readonly T[];
  state: DataState;
  onRetry: () => void;
  /** No-ops unless another page exists — see `hasNextPage` at the call site. */
  onEndReached: () => void;
  /** Another page exists; offline, the end of the list says why it stops. */
  hasNextPage: boolean;
  isFetchingMore: boolean;
  keyExtractor: (item: T) => string;
  renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement;
  /** One string per row shape, for FlashList's recycling pools. */
  getItemType: (item: T, index: number) => string;
  /** Rendered above the first row once there is one. */
  summary?: React.ReactNode;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyDescription?: string;
  /** Names this list in the performance telemetry. */
  componentName: string;
  /**
   * RNGH's `ScrollView`, required if the rows carry RNGH gestures — a native
   * scroll takeover does not cancel v3 detectors, so a row's pan survives it.
   * Every consumer today passes inert rows; a future one must set this.
   */
  renderScrollComponent?: React.ComponentType<object>;
}

/**
 * A `SubScreen` over one paginated list; the list owns the gutter. The query stays at the call
 * site: the document, variables and `errorPolicy` are what differ per screen.
 */
export function PaginatedHistoryScreen<T>({
  title,
  subtitle,
  items,
  state,
  onRetry,
  onEndReached,
  hasNextPage,
  isFetchingMore,
  keyExtractor,
  renderItem,
  getItemType,
  summary,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  componentName,
  renderScrollComponent,
}: PaginatedHistoryScreenProps<T>) {
  const { t } = useTranslation();
  const networkWithheld = useIsApiUnavailable();
  const listInset = useScreenListInset();

  const flashListRef = useRef<FlashListRef<T>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName,
    hasRealContent: items.length > 0,
    rowCount: items.length,
  });
  useDataReferenceTracker(
    items,
    `${componentName}.items`,
    perfCallbacks.onDataReferenceChange,
  );

  return (
    <SubScreen title={title} scroll="list" gutter="none">
      {/* The entity the history belongs to reads before the list loads. */}
      {!!subtitle && (
        <Text role="caption" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {state === 'loading' ? (
        <View style={styles.loadingContainer}>
          <ThemedActivityIndicator />
        </View>
      ) : (
        <FlashList
          ref={flashListRef}
          CellRendererComponent={perfCallbacks.CellRendererComponent}
          onLoad={perfCallbacks.onLoad}
          onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
          onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemType={getItemType}
          {...FLASHLIST_DEFAULTS.fullScreen}
          {...(renderScrollComponent ? { renderScrollComponent } : {})}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            items.length > 0 && summary ? (
              <View style={styles.summary}>{summary}</View>
            ) : null
          }
          ListFooterComponent={
            isFetchingMore ? (
              <ThemedActivityIndicator style={styles.footerLoader} />
            ) : hasNextPage && networkWithheld ? (
              // Without this the end of a persisted page is a silent no-op: the
              // reader pulls, nothing arrives, and nothing says why.
              <Text
                role="footnote"
                tone="secondary"
                style={styles.footerNotice}
              >
                {t('errors.offlineNoMorePages')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            state === 'error' || state === 'offline' ? (
              <DataStateView state={state} onRetry={onRetry} />
            ) : (
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
              />
            )
          }
          contentContainerStyle={[styles.content, listInset]}
          style={styles.scrollView}
        />
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create(theme => ({
  subtitle: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.md,
    // So the empty state centres in the viewport rather than hugging the header.
    flexGrow: 1,
  },
  summary: {
    marginBottom: theme.spacing.sm,
  },
  footerLoader: {
    marginVertical: theme.spacing.lg,
  },
  footerNotice: {
    marginVertical: theme.spacing.lg,
    textAlign: 'center',
  },
}));
