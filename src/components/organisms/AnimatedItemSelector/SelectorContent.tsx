import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
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
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

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
  } = config;

  // Scrolling is owned by the `ActionTray`'s `BottomSheetScrollView` (it renders
  // this content with `scrollable`). We must NOT add another scrollable here —
  // nesting one inside the tray's scroll view would give gorhom two competing
  // content-height sources and break dynamic sizing. So the list + actions just
  // lay out naturally and the sheet grows (then scrolls) within its 70% cap.

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
      <Animated.View entering={FadeIn} layout={LinearTransition}>
        {data.map(item => (
          <React.Fragment key={keyExtractor ? keyExtractor(item) : item.id}>
            {renderItem(item)}
          </React.Fragment>
        ))}
      </Animated.View>
      <ActionButtons actions={actions} />
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingTop: theme.spacing.sm,
  },
  loadingContainer: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  defaultItemText: {
    flex: 1,
  },
}));
