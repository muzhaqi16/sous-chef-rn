import React, { useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import { useActionTrayScroll } from '#components/templates/ActionTray/ActionTrayScrollContext';
import { SelectorItemContainer } from './SelectorItemContainer';
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
    listHeader,
  } = config;

  // This component renders only the scrollable list — the action buttons are
  // pinned by `ActionTray` via its `footer` prop. Scrolling is owned by the
  // tray's `BottomSheetScrollView`; never add another scrollable here (two
  // content-height sources break gorhom's dynamic sizing).

  // On open, scroll the selected row into the centre of the viewport. We
  // capture its Y via onLayout, then scroll once the tray's viewport height is
  // known. Short lists clamp to 0 (no scroll); reset per open since the tray
  // unmounts its content on close.
  const scroll = useActionTrayScroll();
  const [selectedLayout, setSelectedLayout] = useState<{
    y: number;
    height: number;
  } | null>(null);
  const didCenterRef = useRef(false);

  const handleSelectedLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setSelectedLayout({ y, height });
  };

  useEffect(() => {
    if (didCenterRef.current || selectedLayout == null || !scroll) return;
    const { viewportHeight, scrollToContentOffset, isReady } = scroll;
    // Wait until the viewport is measured AND the sheet has settled open —
    // gorhom keeps the scrollable locked during the open animation, so an
    // earlier scroll would be dropped.
    if (!isReady || viewportHeight <= 0) return;
    didCenterRef.current = true;
    // Center the selected row's midpoint in the viewport. Using the row's
    // measured height keeps this correct if the row size changes — no magic
    // constant coupled to SelectorItemContainer's layout. Scroll via gorhom's
    // documented `scrollTo` with animation so the glide runs natively on the UI
    // thread — gorhom exposes no Reanimated-driven scroll for its scrollable, so
    // a hand-rolled JS-thread slide would be the wrong layer to animate at.
    const { y, height } = selectedLayout;
    const target = Math.max(0, y + height / 2 - viewportHeight / 2);
    scrollToContentOffset(target, true);
  }, [selectedLayout, scroll]);

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
        {listHeader}
        <EmptyState message={emptyMessage} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn}
      layout={LinearTransition}
      style={styles.container}
    >
      {listHeader}
      {data.map(item => (
        <View
          key={keyExtractor ? keyExtractor(item) : item.id}
          onLayout={item.id === selectedId ? handleSelectedLayout : undefined}
        >
          {renderItem(item)}
        </View>
      ))}
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
