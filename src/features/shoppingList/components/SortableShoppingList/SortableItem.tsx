import React, { useRef } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { useFragment } from '@apollo/client/react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { SwipeableItem } from '#/components/molecules/SwipeableItem/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { AnimatedCheckbox } from '#/components/atoms/AnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { CachedImage } from '#/components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';

import { HIT_SLOP } from '#/constants/touch';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import {
  standardEasing,
  staggeredEntryAnimation,
  TIMING,
} from '#constants/animations';
import { useStaggeredEntry } from '#context/StaggeredEntryContext';
import {
  useShoppingListTutorialState,
  useShoppingListTutorialActions,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { resolveImageUrl } from '#utils/imageUtils';
import { SortableItem_ItemFragmentDoc } from './SortableItem.generated';
import { useSortableListActions } from './SortableListActionsContext';
import {
  useShoppingListRowOptions,
  useSortableListTheme,
} from './SortableListThemeContext';
import type { ShoppingListRowItem } from './types';

/**
 * Props for SwipeableListItem - extends ListRenderItemInfo from FlashList.
 *
 * The wrapper `item` holds a per-row primitive (`id`, `isPurchased` — forced
 * to match the active tab) plus the masked `itemRef` fragment ref. The row
 * subscribes to its entity via `useFragment(SortableItem_item, itemRef)`
 * and derives all display data inline; no upstream transform pipeline is
 * involved.
 */
type SwipeableListItemProps = ListRenderItemInfo<ShoppingListRowItem>;

const SwipeableListItemComponent: React.FC<SwipeableListItemProps> = ({
  item: rowItem,
  index,
}) => {
  // Per-entity cache subscription: this row re-renders only when its own
  // ShoppingListItem cache record changes (quantity, unit, image, etc.).
  const { data, complete } = useFragment({
    fragment: SortableItem_ItemFragmentDoc,
    fragmentName: 'SortableItem_item',
    from: rowItem.itemRef,
  });

  // PERFORMANCE: Get theme colors from context (single useUnistyles at list level)
  const themeColors = useSortableListTheme();

  // Staggered entry animation (only during initial render, disabled after)
  const staggerCtx = useStaggeredEntry();
  const entryDelay = staggerCtx?.getEntryDelay(index) ?? 0;
  const entering = (() => {
    if (entryDelay <= 0) return undefined;
    return FadeIn.delay(entryDelay)
      .duration(staggeredEntryAnimation.duration)
      .easing(standardEasing.factory());
  })();

  // PERFORMANCE: Get screen width from context (single subscription at list level, not per-item)
  const screenWidth = themeColors?.screenWidth ?? 375;

  // Slide animation for purchase toggle
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: rowItem.id,
    slideDistance: screenWidth,
    duration: TIMING.MODERATE,
  });

  // Get actions and permissions from context (stable references)
  const { actions, permissions } = useSortableListActions();
  const {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSwipeableWillOpen,
    onSwipeableClose,
  } = actions;

  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissions;

  // ── Interactive tutorial (only active for first item during relevant steps) ──
  const tutorial = useShoppingListTutorialState();
  const tutorialActions = useShoppingListTutorialActions();
  const itemCardRef = useRef<View>(null);
  const checkboxRef = useRef<View>(null);
  const archiveIconRef = useRef<View>(null);

  // `rowItem.isPurchased` is forced to match the active tab — use it for
  // visual state so a freshly toggled item paints the new state immediately
  // before the cache propagates.
  const isPurchased = rowItem.isPurchased;
  const itemId = rowItem.id;

  // Derive display data from the fragment. On cache miss before first paint
  // we fall back to safe defaults instead of returning null so the cell still
  // takes up its FlashList slot during initial restore.
  const itemName = data?.itemName ?? '';
  const category = data?.category ?? null;
  const subtitle = category?.split(',')[0].trim() || undefined;
  const quantity = data?.quantity ?? 0;
  const quantityInput = data?.quantityInput ?? null;
  const unitDisplay = data?.unitName || data?.unit?.symbol || undefined;
  // `resolveImageUrl` accepts a structural { item?: { images, imageUrl } }
  // shape — feeding the fragment data directly resolves to the best image
  // variant available without an intermediate transform step.
  const imageUrl = data ? resolveImageUrl(data) : null;
  const { showImages } = useShoppingListRowOptions();
  const showImage = showImages && !!imageUrl;

  const isTutorialSwipeTarget =
    tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS &&
    index === 0 &&
    !isPurchased;

  // Disable swipe gestures during non-swipe spotlight steps so users can't
  // accidentally swipe items while the tutorial overlay is showing.
  // During the swipe step itself, swiping is allowed so the user can
  // interact with the real item.
  const swipeEnabled =
    !tutorial?.isActive ||
    tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS;

  const isTutorialCheckboxTarget =
    tutorial?.isActive &&
    tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX &&
    index === 0 &&
    !isPurchased;

  // Check currentStep directly (not isActive) so the archive icon gets measured
  // during the 400ms transition period when the purchased tab first mounts.
  // isActive is false during transitions, but we need the rect ready for when
  // the spotlight renders after the transition completes.
  const isTutorialArchiveTarget =
    tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY &&
    index === 0 &&
    isPurchased;

  // Measure checkbox position for tutorial spotlight
  const handleCheckboxLayout = () => {
    if (!isTutorialCheckboxTarget) return;
    requestAnimationFrame(() => {
      checkboxRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          tutorialActions?.registerRect('checkbox', {
            x: pageX,
            y: pageY,
            width: w,
            height: h,
          });
        }
      });
    });
  };

  // Measure archive icon position for tutorial spotlight
  const handleArchiveIconLayout = () => {
    if (!isTutorialArchiveTarget) return;
    requestAnimationFrame(() => {
      archiveIconRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          tutorialActions?.registerRect('archiveIcon', {
            x: pageX,
            y: pageY,
            width: w,
            height: h,
          });
        }
      });
    });
  };

  // Measure entire item card for swipe actions tutorial spotlight
  const handleItemCardLayout = () => {
    if (!isTutorialSwipeTarget) return;
    requestAnimationFrame(() => {
      itemCardRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          tutorialActions?.registerRect('itemCard', {
            x: pageX,
            y: pageY,
            width: w,
            height: h,
          });
        }
      });
    });
  };

  // === ELEMENT CREATION ===

  // Create rightElement: quantity badge + optional archive action
  const rightElement = (() => {
    const archiveIcon = isPurchased && !!onMoveToPantry && (
      <View
        ref={isTutorialArchiveTarget ? archiveIconRef : undefined}
        collapsable={false}
        onLayout={isTutorialArchiveTarget ? handleArchiveIconLayout : undefined}
      >
        <AppPressable
          onPress={() => {
            onMoveToPantry(itemId);
            tutorialActions?.notifyMoveToPantryTapped();
          }}
          style={styles.moveToPantryButton}
          hitSlop={HIT_SLOP}
        >
          <Icon name="archive-outline" size={24} color={themeColors?.primary} />
        </AppPressable>
      </View>
    );

    return (
      <View style={styles.rightElementContainer}>
        <QuantityBadge
          quantity={quantity}
          quantityInput={quantityInput}
          unit={unitDisplay}
          onPress={() => onQuantityPress?.(itemId)}
          disabled={isPurchased}
          isPurchased={isPurchased}
          themeColors={themeColors}
        />
        {archiveIcon}
      </View>
    );
  })();

  // Create leftElement: cached image if the item has one
  const leftElement = (() => {
    if (!showImage || !imageUrl) return null;
    return (
      <View
        style={[
          commonStyles.listItemImageContainerCompact,
          isPurchased && styles.dimmed,
        ]}
      >
        <CachedImage
          uri={imageUrl}
          style={commonStyles.listItemImageCompact}
          displaySize={48}
        />
      </View>
    );
  })();

  // Create checkbox element for marking items as purchased
  // Uses AnimatedCheckbox with pendingChecked state for immediate visual feedback
  // Slide animation triggers state change via callback AFTER animation completes
  const checkboxElement = (() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;

    const checkbox = (
      <AnimatedCheckbox
        checked={isPurchased}
        itemId={itemId}
        onPress={() => {
          // Direction: 1 = right (marking as purchased), -1 = left (unmarking)
          const direction = isPurchased ? -1 : 1;
          // Trigger slide animation with callback for state change AFTER animation
          triggerSlide(direction, () => {
            onTogglePurchase(itemId);
            tutorialActions?.notifyCheckboxTapped();
          });
        }}
        size={28}
        testID={`shopping-item-checkbox-${itemId}`}
      />
    );

    // Wrap first item's checkbox in a measured View for tutorial spotlight
    if (isTutorialCheckboxTarget) {
      return (
        <View
          ref={checkboxRef}
          collapsable={false}
          onLayout={handleCheckboxLayout}
        >
          {checkbox}
        </View>
      );
    }

    return checkbox;
  })();

  // While the fragment is hydrating from cache, render an empty cell rather
  // than blanking — keeps the FlashList slot stable.
  if (!complete && !data) {
    return <View style={styles.container} />;
  }

  // Render the item
  // PERF: Single Animated.View for both entry animation and slide style
  return (
    <Animated.View
      entering={entering}
      style={[styles.container, animatedSlideStyle]}
    >
      {isTutorialSwipeTarget ? (
        <View
          ref={itemCardRef}
          collapsable={false}
          onLayout={handleItemCardLayout}
          style={styles.measureOverlay}
          pointerEvents="none"
        />
      ) : null}
      <SwipeableItem
        itemId={itemId}
        onPress={onItemPress ? () => onItemPress(itemId) : undefined}
        onLongPress={onItemPress ? () => onItemPress(itemId) : undefined}
        onEdit={
          canEditItems && onItemEdit ? () => onItemEdit(itemId) : undefined
        }
        onDelete={
          canRemoveItems && onItemDelete
            ? () => onItemDelete(itemId)
            : undefined
        }
        isPurchased={isPurchased}
        friction={1}
        onSwipeableWillOpen={ref => {
          onSwipeableWillOpen?.(ref);
          // Detect swipe during tutorial swipe step → advance tutorial
          if (isTutorialSwipeTarget) {
            tutorialActions?.notifySwipeActionsSeen();
          }
        }}
        onSwipeableClose={onSwipeableClose}
        swipeMode="shopping"
        enabled={swipeEnabled}
      >
        <ListItem
          title={itemName}
          subtitle={subtitle}
          rightElement={rightElement}
          leftElement={leftElement}
          checkboxElement={checkboxElement}
          dragHandleElement={null}
          rightIcon={undefined}
          isPurchased={isPurchased}
          themeColors={themeColors}
        />
      </SwipeableItem>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginHorizontal: theme.spacing['3'],
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
  },
  moveToPantryButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  rightElementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  measureOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export const SwipeableListItem = SwipeableListItemComponent;
