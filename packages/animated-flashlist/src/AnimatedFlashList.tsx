import React, {
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  View,
  RefreshControl,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { FlashList, type ListRenderItemInfo, type FlashListRef } from '@shopify/flash-list';
import { DragStateProvider, ListAnimationProvider, useDragState } from './contexts';
import { AnimatedFlashListItem } from './AnimatedFlashListItem';
import { DEFAULT_DRAG_CONFIG } from './constants';
import type {
  AnimatedListItem,
  AnimatedFlashListProps,
  AnimatedFlashListRef,
  HapticFeedbackType,
} from './types';

/**
 * Item wrapper component for FlashList
 * Uses ref for totalItems to avoid renderItem callback recreation
 */
interface ItemWrapperProps<T extends AnimatedListItem> {
  item: T;
  index: number;
  totalItemsRef: React.RefObject<number>;
  renderItem: AnimatedFlashListProps<T>['renderItem'];
  canDrag?: (item: T, index: number) => boolean;
  dragEnabled: boolean;
  onReorderByDelta?: (itemId: string, delta: number) => void;
  onHapticFeedback?: (type: HapticFeedbackType) => void;
}

const ItemWrapper = React.memo(function ItemWrapper<T extends AnimatedListItem>({
  item,
  index,
  totalItemsRef,
  renderItem,
  canDrag,
  dragEnabled,
  onReorderByDelta,
  onHapticFeedback,
}: ItemWrapperProps<T>) {
  const isDragEnabled = dragEnabled && (canDrag ? canDrag(item, index) : true);

  return (
    <AnimatedFlashListItem
      item={item}
      index={index}
      totalItems={totalItemsRef.current ?? 0}
      isDragEnabled={isDragEnabled}
      renderItem={renderItem}
      onReorderByDelta={onReorderByDelta}
      onHapticFeedback={onHapticFeedback}
    />
  );
}) as <T extends AnimatedListItem>(props: ItemWrapperProps<T>) => React.ReactElement;

/**
 * Inner FlashList component that uses DragStateContext for scroll tracking
 */
interface InnerFlashListProps<T extends AnimatedListItem> {
  data: T[];
  totalItemsRef: React.RefObject<number>;
  flashListRef: React.RefObject<FlashListRef<T> | null>;
  renderItem: AnimatedFlashListProps<T>['renderItem'];
  keyExtractor: (item: T, index: number) => string;
  canDrag?: (item: T, index: number) => boolean;
  dragEnabled: boolean;
  onReorderByDelta?: (itemId: string, delta: number) => void;
  onHapticFeedback?: (type: HapticFeedbackType) => void;
  itemHeight: number;
  ListFooterComponent?: AnimatedFlashListProps<T>['ListFooterComponent'];
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshTintColor?: string;
  contentContainerStyle?: AnimatedFlashListProps<T>['contentContainerStyle'];
  drawDistance?: number;
  showsVerticalScrollIndicator?: boolean;
}

function InnerFlashList<T extends AnimatedListItem>({
  data,
  totalItemsRef,
  flashListRef,
  renderItem,
  keyExtractor,
  canDrag,
  dragEnabled,
  onReorderByDelta,
  onHapticFeedback,
  itemHeight,
  ListFooterComponent,
  onEndReached,
  onEndReachedThreshold,
  onRefresh,
  refreshing,
  refreshTintColor,
  contentContainerStyle,
  drawDistance = 500,
  showsVerticalScrollIndicator = true,
}: InnerFlashListProps<T>): React.ReactElement {
  // Get drag state context for scroll tracking
  const { scrollOffset, contentHeight, visibleHeight, listTopY, setListRef } =
    useDragState();

  // Register FlashList ref with drag context for autoscroll
  useEffect(() => {
    // Cast to unknown to satisfy the generic constraint
    setListRef(flashListRef.current as FlashListRef<unknown> | null);
    return () => setListRef(null);
  }, [setListRef, flashListRef]);

  // Update scroll offset on scroll
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y;
    },
    [scrollOffset],
  );

  // Update content height when list content changes
  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.value = height;
    },
    [contentHeight],
  );

  // Update visible height and list position when layout changes
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      visibleHeight.value = event.nativeEvent.layout.height;
      const nativeRef = flashListRef.current?.getNativeScrollRef?.() as
        | { measureInWindow?: (cb: (x: number, y: number) => void) => void }
        | undefined;
      if (nativeRef?.measureInWindow) {
        nativeRef.measureInWindow((_x, y) => {
          listTopY.value = y;
        });
      }
    },
    [visibleHeight, listTopY, flashListRef],
  );

  // Render item for FlashList
  const flashListRenderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <ItemWrapper
        item={item}
        index={index}
        totalItemsRef={totalItemsRef}
        renderItem={renderItem}
        canDrag={canDrag}
        dragEnabled={dragEnabled}
        onReorderByDelta={onReorderByDelta}
        onHapticFeedback={onHapticFeedback}
      />
    ),
    [
      totalItemsRef,
      renderItem,
      canDrag,
      dragEnabled,
      onReorderByDelta,
      onHapticFeedback,
    ],
  );

  // getItemType for FlashList recycling optimization
  const getItemType = useCallback(() => 'animated-item', []);

  // Override item layout for consistent drag calculations
  // Note: We cast the layout to include size for drag calculations
  const overrideItemLayout = useCallback(
    (layout: { span?: number }, _item: T, _index: number) => {
      // FlashList v2 uses this for span, but we extend for size in drag calculations
      (layout as { size?: number }).size = itemHeight;
    },
    [itemHeight],
  );

  return (
    <FlashList
      ref={flashListRef}
      data={data}
      renderItem={flashListRenderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      overrideItemLayout={overrideItemLayout}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      scrollEventThrottle={16}
      drawDistance={drawDistance}
      maintainVisibleContentPosition={{ disabled: true }}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={contentContainerStyle}
      ListFooterComponent={ListFooterComponent ?? undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={refreshTintColor}
            colors={refreshTintColor ? [refreshTintColor] : undefined}
          />
        ) : undefined
      }
    />
  );
}

/**
 * AnimatedFlashList - High-performance animated list with drag-to-reorder
 *
 * A wrapper around @shopify/flash-list that provides:
 * - Smooth drag-to-reorder with autoscroll
 * - Entry animations for new items
 * - Exit animations for removed items
 * - Full TypeScript generics support
 *
 * @example
 * ```tsx
 * <AnimatedFlashList<MyItem>
 *   data={items}
 *   keyExtractor={(item) => item.id}
 *   renderItem={({ item, animatedStyle, dragHandleProps }) => (
 *     <Animated.View style={animatedStyle}>
 *       <MyItem item={item} />
 *       {dragHandleProps && (
 *         <GestureDetector gesture={dragHandleProps.gesture}>
 *           <DragHandle />
 *         </GestureDetector>
 *       )}
 *     </Animated.View>
 *   )}
 *   dragEnabled
 *   onReorder={(itemId, from, to) => reorderItems(itemId, from, to)}
 * />
 * ```
 */
function AnimatedFlashListInner<T extends AnimatedListItem>(
  props: AnimatedFlashListProps<T>,
  ref: React.ForwardedRef<AnimatedFlashListRef>,
): React.ReactElement | null {
  const {
    data,
    keyExtractor,
    renderItem,
    dragEnabled = false,
    onReorder,
    onReorderByNeighbors,
    canDrag,
    onHapticFeedback,
    config,
    onPrepareLayoutAnimation,
    ListFooterComponent,
    onRefresh,
    refreshing = false,
    onEndReached,
    onEndReachedThreshold = 0.5,
    contentContainerStyle,
    ...flashListProps
  } = props;

  // Merge config with defaults
  const dragConfig = useMemo(
    () => ({
      ...DEFAULT_DRAG_CONFIG,
      ...config?.drag,
    }),
    [config?.drag],
  );

  // Ref to FlashList
  const flashListRef = useRef<FlashListRef<T>>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    prepareForLayoutAnimation: () => {
      flashListRef.current?.prepareForLayoutAnimationRender();
      onPrepareLayoutAnimation?.();
    },
    scrollToOffset: (offset: number, animated = true) => {
      flashListRef.current?.scrollToOffset({ offset, animated });
    },
    scrollToIndex: (index: number, animated = true) => {
      flashListRef.current?.scrollToIndex({ index, animated });
    },
  }));

  // Keep valid items in ref for reorder callback
  const dataRef = useRef<T[]>([]);
  dataRef.current = data;

  // Handle reorder by index delta - converts to various callback formats
  const handleReorderByDelta = useCallback(
    (itemId: string, indexDelta: number) => {
      if (indexDelta === 0) return;

      const currentItems = dataRef.current;
      const currentIndex = currentItems.findIndex(item => item.id === itemId);
      if (currentIndex === -1) return;

      const newIndex = Math.max(
        0,
        Math.min(currentItems.length - 1, currentIndex + indexDelta),
      );
      if (newIndex === currentIndex) return;

      // Call onReorder if provided
      if (onReorder) {
        onReorder(itemId, currentIndex, newIndex);
      }

      // Call onReorderByNeighbors if provided (for fractional indexing)
      if (onReorderByNeighbors) {
        let afterItemId: string | null = null;
        let beforeItemId: string | null = null;

        if (indexDelta > 0) {
          afterItemId = currentItems[newIndex]?.id ?? null;
          beforeItemId =
            newIndex < currentItems.length - 1
              ? currentItems[newIndex + 1]?.id ?? null
              : null;
        } else {
          afterItemId =
            newIndex > 0 ? currentItems[newIndex - 1]?.id ?? null : null;
          beforeItemId = currentItems[newIndex]?.id ?? null;
        }

        onReorderByNeighbors(itemId, afterItemId, beforeItemId);
      }
    },
    [onReorder, onReorderByNeighbors],
  );

  // Use ref for totalItems to avoid renderItem callback recreation
  const totalItemsRef = useRef(data.length);
  totalItemsRef.current = data.length;

  // Early return for empty data
  if (!data || !Array.isArray(data) || data.length === 0) {
    if (ListFooterComponent) {
      return (
        <View style={containerStyle}>
          {React.isValidElement(ListFooterComponent)
            ? ListFooterComponent
            : React.createElement(ListFooterComponent as React.ComponentType)}
        </View>
      );
    }
    return null;
  }

  return (
    <ListAnimationProvider>
      <DragStateProvider config={dragConfig}>
        <View style={containerStyle}>
          <InnerFlashList
            data={data}
            totalItemsRef={totalItemsRef}
            flashListRef={flashListRef}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            canDrag={canDrag}
            dragEnabled={dragEnabled}
            onReorderByDelta={
              onReorder || onReorderByNeighbors ? handleReorderByDelta : undefined
            }
            onHapticFeedback={onHapticFeedback}
            itemHeight={dragConfig.itemHeight}
            ListFooterComponent={ListFooterComponent}
            onEndReached={onEndReached}
            onEndReachedThreshold={onEndReachedThreshold}
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={contentContainerStyle}
            {...flashListProps}
          />
        </View>
      </DragStateProvider>
    </ListAnimationProvider>
  );
}

const containerStyle: ViewStyle = {
  flex: 1,
};

// Forward ref with generic support
export const AnimatedFlashList = forwardRef(AnimatedFlashListInner) as <
  T extends AnimatedListItem,
>(
  props: AnimatedFlashListProps<T> & { ref?: React.ForwardedRef<AnimatedFlashListRef> },
) => React.ReactElement | null;
