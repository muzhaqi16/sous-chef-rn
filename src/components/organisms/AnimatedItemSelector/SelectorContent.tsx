import React, { useCallback } from 'react';
import { Text, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SelectorItem } from './SelectorItem';
import { ActionButtons } from './ActionButtons';
import type { SelectorConfig, SelectableItem } from './types';

interface SelectorContentProps<T extends SelectableItem> {
  config: SelectorConfig<T>;
}

const LoadingState = () => {
  const { theme } = useUnistyles();
  return (
    <Animated.View entering={FadeIn} style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
    </Animated.View>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Animated.View entering={FadeIn} style={styles.emptyContainer}>
    <Text style={styles.emptyText}>{message}</Text>
  </Animated.View>
);

export const SelectorContent = <T extends SelectableItem>({
  config,
}: SelectorContentProps<T>) => {
  const {
    data,
    selectedId,
    onSelect,
    displayProperty,
    loading = false,
    emptyMessage = 'No items available',
    keyExtractor,
    renderCustomItem,
    actions,
    extraData,
  } = config;

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <SelectorItem
        item={item}
        isSelected={item.id === selectedId}
        onSelect={onSelect}
        displayProperty={displayProperty}
        renderCustomItem={renderCustomItem}
        extraData={extraData}
      />
    ),
    [selectedId, onSelect, displayProperty, renderCustomItem, extraData],
  );

  if (loading) {
    return <LoadingState />;
  }

  if (!data.length) {
    return (
      <Animated.View layout={LinearTransition} style={styles.container}>
        <EmptyState message={emptyMessage} />
        <ActionButtons actions={actions} />
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition} style={styles.container}>
      <Animated.View
        entering={FadeIn}
        layout={LinearTransition}
        style={styles.listContainer}
      >
        <FlashList
          data={data}
          renderItem={renderItem}
          extraData={extraData}
          keyExtractor={keyExtractor || ((item: T) => item.id)}
          showsVerticalScrollIndicator={true}
          bounces={true}
          contentContainerStyle={styles.listContent}
        />
      </Animated.View>
      <Animated.View style={styles.actionsWrapper}>
        <ActionButtons actions={actions} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    // Height is now controlled by ActionTray's maxHeight prop
  },
  listContainer: {
    flex: 1,
    minHeight: 100,
  },
  actionsWrapper: {
    flexShrink: 0, // Prevent ActionButtons from being compressed/hidden
  },
  listContent: {
    paddingBottom: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
