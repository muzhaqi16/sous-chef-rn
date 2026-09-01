import React, { useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  FlashList,
  type ListRenderItemInfo,
  type FlashListRef,
} from '@shopify/flash-list';

import {
  ThemedActivityIndicator,
  ThemedBackButton,
} from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName } from '#utils/iconUtils';
import { DataStateView } from '#components/molecules/DataStateView';
import type { DataState } from '#hooks/data/useDataState';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

export interface PaginatedHistoryScreenProps<T> {
  title: string;
  /** The entity the history belongs to. */
  subtitle?: string;
  items: readonly T[];
  state: DataState;
  onRetry: () => void;
  /** No-ops unless another page exists — see `hasNextPage` at the call site. */
  onEndReached: () => void;
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
 * A back-titled screen over one paginated list. The query stays at the call
 * site: the document, variables and `errorPolicy` are what differ per screen.
 */
export function PaginatedHistoryScreen<T>({
  title,
  subtitle,
  items,
  state,
  onRetry,
  onEndReached,
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
  const { goBack } = useAppNavigation();

  const flashListRef = useRef<FlashListRef<T>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName,
    hasRealContent: items.length > 0,
  });
  useDataReferenceTracker(
    items,
    `${componentName}.items`,
    perfCallbacks.onDataReferenceChange,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedBackButton onPress={goBack} style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text size="lg" weight="semibold">
            {title}
          </Text>
          {!!subtitle && (
            <Text size="sm" tone="secondary" style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

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
          data={items as T[]}
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
            ) : null
          }
          ListEmptyComponent={
            state === 'error' || state === 'offline' ? (
              <DataStateView state={state} onRetry={onRetry} />
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name={emptyIcon} size={64} tone="iconDisabled" />
                <Text size="lg" weight="semibold" style={styles.emptyText}>
                  {emptyTitle}
                </Text>
                {!!emptyDescription && (
                  <Text
                    size="sm"
                    tone="secondary"
                    align="center"
                    style={styles.emptyDescription}
                  >
                    {emptyDescription}
                  </Text>
                )}
              </View>
            )
          }
          contentContainerStyle={styles.content}
          style={styles.scrollView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerSubtitle: {
    marginTop: theme.spacing.xs,
  },
  headerSpacer: {
    width: theme.spacing.xl,
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
    padding: theme.spacing.md,
    // So the empty state centres in the viewport rather than hugging the header.
    flexGrow: 1,
  },
  summary: {
    marginBottom: theme.spacing.sm,
  },
  footerLoader: {
    marginVertical: theme.spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
  },
  emptyDescription: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
  },
}));
