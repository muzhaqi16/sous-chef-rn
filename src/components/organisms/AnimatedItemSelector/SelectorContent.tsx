import React from 'react';
import { FlatList, Text, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { SelectorItem } from './SelectorItem';
import { ActionButtons } from './ActionButtons';
import type { SelectorConfig, SelectableItem } from './types';

interface SelectorContentProps<T extends SelectableItem> {
  config: SelectorConfig<T>;
}

const LoadingState = () => (
  <Animated.View
    entering={FadeIn}
    style={styles.loadingContainer}
  >
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>Loading...</Text>
  </Animated.View>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Animated.View
    entering={FadeIn}
    style={styles.emptyContainer}
  >
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
  } = config;

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

  const renderItem = ({ item }: { item: T }) => (
    <SelectorItem
      item={item}
      isSelected={item.id === selectedId}
      onPress={() => onSelect(item.id, item)}
      displayProperty={displayProperty}
      renderCustomItem={renderCustomItem}
    />
  );

  return (
    <Animated.View
      layout={LinearTransition}
      style={styles.container}
    >
      <Animated.View
        entering={FadeIn}
        layout={LinearTransition}
        style={styles.listContainer}
      >
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor || ((item: T) => item.id)}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.listContent}
          // Performance optimizations
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
        />
      </Animated.View>
      <ActionButtons actions={actions} />
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
    minHeight: 150, // Ensure minimum height for better UX
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