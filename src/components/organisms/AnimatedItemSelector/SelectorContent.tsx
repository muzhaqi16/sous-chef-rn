import React from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import { SelectorItemContainer } from './SelectorItemContainer';
import { ActionButtons } from './ActionButtons';
import type { SelectorConfig, SelectableItem } from './types';
import { Text } from '#components/atoms/Text';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.primary,
}));

interface SelectorContentProps<T extends SelectableItem> {
  config: SelectorConfig<T>;
}

const LoadingState = () => {
  return (
    <Animated.View entering={FadeIn} style={styles.loadingContainer}>
      <ThemedActivityIndicator size="large" />
      <Text size="md" tone="secondary" style={styles.loadingText}>
        Loading...
      </Text>
    </Animated.View>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Animated.View entering={FadeIn} style={styles.emptyContainer}>
    <Text size="md" tone="secondary" align="center">
      {message}
    </Text>
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
    maxVisibleItems,
  } = config;

  const renderItem = (item: T) => {
    const isSelected = item.id === selectedId;
    const handlePress = () => onSelect(item.id, item);

    if (renderCustomItem) {
      return renderCustomItem(item, isSelected, handlePress);
    }

    return (
      <SelectorItemContainer
        state={isSelected ? 'selected' : 'default'}
        onPress={handlePress}
      >
        <Text
          size="md"
          weight={isSelected ? 'semibold' : 'medium'}
          tone={isSelected ? 'accent' : undefined}
          style={styles.defaultItemText}
        >
          {String(item[displayProperty])}
        </Text>
        {!!isSelected && (
          <Animated.View entering={FadeInUp.duration(200).springify()}>
            <Icon name="checkmark" size={18} tone="primary" />
          </Animated.View>
        )}
      </SelectorItemContainer>
    );
  };

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
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
          contentContainerStyle={styles.listContent}
          style={
            maxVisibleItems ? { maxHeight: maxVisibleItems * 56 } : undefined
          }
        >
          {data.map(item => (
            <React.Fragment key={keyExtractor ? keyExtractor(item) : item.id}>
              {renderItem(item)}
            </React.Fragment>
          ))}
        </ScrollView>
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
  },
  listContainer: {
    flex: 1,
    minHeight: 100,
  },
  actionsWrapper: {
    flexShrink: 0,
  },
  listContent: {
    paddingTop: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  defaultItemText: {
    flex: 1,
  },
}));
