import React, { useEffect, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
// RNGH's Pressable (not AppPressable/RN) for the archive button: it's nested in
// the row's RNGH Swipeable, so RNGH's native button captures the tap and it
// doesn't also fire the row's onPress (which would navigate to details).
import { Pressable } from 'react-native-gesture-handler';
import { useFragment } from '@apollo/client/react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import { ListItem } from '#components/molecules/ListItem';
import { AnimatedCheckbox } from '#features/shoppingList/components/AnimatedCheckbox';
import { QuantityBadge } from '#features/shoppingList/components/QuantityBadge';
import { CachedImage } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';

import { HIT_SLOP } from '#features/shoppingList/constants/touch';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { staggeredEntryAnimation } from '#constants/animations';
import { useStaggeredEntry } from '#features/shoppingList/context/StaggeredEntryContext';
import {
  useShoppingListTutorialState,
  useShoppingListTutorialActions,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { resolveImageUrl } from '#utils/imageUtils';
import { SortableItem_ItemFragmentDoc } from './SortableItem.generated';
import { useSortableListActions } from './SortableListActionsContext';
import { useItemSwipeActions } from '#components/organisms/itemSwipeActionsContext';
import { resolveRowActions } from '#components/organisms/SwipeableItem/commonActions';
import {
  useShoppingListRowOptions,
  useSortableListTheme,
} from './SortableListThemeContext';
import type { ShoppingListRowItem } from './types';
import { motion } from '#/theme/foundations/motion';

/**
 * The row subscribes to its own entity via `useFragment(SortableItem_item)` and
 * derives display data inline — there is no upstream transform pipeline.
 */
type SwipeableListItemProps = ListRenderItemInfo<ShoppingListRowItem>;

const SwipeableListItemComponent: React.FC<SwipeableListItemProps> = ({
  item: rowItem,
  index,
}) => {
  // FlashList v2 can call renderItem with an `undefined` item: a toggle/delete
  // runs prepareForLayoutAnimationRender() and shrinks the data array, so a
  // recycled cell briefly maps out of range. Read defensively (hooks stay
  // unconditional) and render the empty cell below; the next commit fixes it.
  const itemRef = rowItem?.itemRef;

  // Per-entity subscription: this row re-renders only for its own cache record.
  const { data, complete } = useFragment({
    fragment: SortableItem_ItemFragmentDoc,
    fragmentName: 'SortableItem_item',
    from: itemRef ?? null,
  });

  // One list-level useUnistyles, rather than a theme subscription per row.
  const themeColors = useSortableListTheme();

  const staggerCtx = useStaggeredEntry();
  const entryDelay = staggerCtx?.getEntryDelay(index) ?? 0;
  const entering = (() => {
    if (entryDelay <= 0) return undefined;
    return FadeIn.delay(entryDelay)
      .duration(staggeredEntryAnimation.duration)
      .easing(motion.easing.standard.factory());
  })();

  const screenWidth = themeColors?.screenWidth ?? 375;

  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: rowItem?.id ?? '',
    slideDistance: screenWidth,
    duration: motion.timing.MODERATE,
  });

  const { t } = useTranslation();

  const { actions, permissions } = useSortableListActions();
  const {
    onItemPress,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSwipeableWillOpen,
    onSwipeableClose,
    onBeforeRowRemoved,
  } = actions;

  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissions;

  // Interactive tutorial — only the first row, and only on its steps.
  const tutorial = useShoppingListTutorialState();
  const tutorialActions = useShoppingListTutorialActions();
  const itemCardRef = useRef<View>(null);
  const checkboxRef = useRef<View>(null);
  const archiveIconRef = useRef<View>(null);

  // Forced to match the active tab, so a freshly toggled row paints the new
  // state before the cache propagates.
  const isPurchased = rowItem?.isPurchased ?? false;
  const itemId = rowItem?.id ?? '';
  // Read from its own context: the command bag publishes behind a ref children
  // see too late.
  const itemSwipeActions = useItemSwipeActions();
  const swipeActions = resolveRowActions(
    itemSwipeActions,
    itemId,
    onBeforeRowRemoved,
  );

  // Already in the pantry. The bulk move filters on the same stamp, so a
  // "move to pantry" here would do nothing — show it as stocked. Cleared
  // server-side when the line goes unpurchased again.
  const isStocked = !!data?.purchaseInfo?.movedToPantryAt;

  // Safe defaults rather than null on a cache miss, so the cell keeps its
  // FlashList slot during initial restore.
  const itemName = data?.itemName ?? '';
  const category = data?.category ?? null;
  const subtitle = category?.split(',')[0].trim() || undefined;
  const quantity = data?.quantity ?? 0;
  const quantityInput = data?.quantityInput ?? null;
  const unitDisplay = data?.unitName || data?.unit?.symbol || undefined;
  // `resolveImageUrl` takes a structural { item?: { images, imageUrl } }, so the
  // fragment data feeds it directly.
  const imageUrl = data ? resolveImageUrl(data) : null;
  const { showImages } = useShoppingListRowOptions();
  const showImage = showImages && !!imageUrl;

  const isTutorialSwipeTarget =
    tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS &&
    index === 0 &&
    !isPurchased;

  const isTutorialLongPressTarget =
    tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE &&
    index === 0 &&
    !isPurchased;

  // Both spotlight the whole row, so they share the 'itemCard' rect; only one
  // of the two steps is ever active.
  const isTutorialItemCardTarget =
    isTutorialSwipeTarget || isTutorialLongPressTarget;

  // No swiping under the tutorial overlay, except on the swipe step itself.
  const swipeEnabled =
    !tutorial?.isActive ||
    tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS;

  const isTutorialCheckboxTarget =
    tutorial?.isActive &&
    tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX &&
    index === 0 &&
    !isPurchased;

  // `currentStep`, not `isActive`: the latter is false during the 400ms tab
  // transition, and the rect must be measured before the spotlight renders.
  const isTutorialArchiveTarget =
    tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY &&
    index === 0 &&
    isPurchased;

  // `registerRect` only ever sets, so each rect must be cleared when this row
  // stops being the step's target (purchased, removed, step advanced, cell
  // recycled) or the coach mark spotlights a vanished element.
  useEffect(() => {
    if (!isTutorialCheckboxTarget) return;
    return () => tutorialActions?.registerRect('checkbox', null);
  }, [isTutorialCheckboxTarget, tutorialActions]);

  useEffect(() => {
    if (!isTutorialArchiveTarget) return;
    return () => tutorialActions?.registerRect('archiveIcon', null);
  }, [isTutorialArchiveTarget, tutorialActions]);

  useEffect(() => {
    if (!isTutorialItemCardTarget) return;
    return () => tutorialActions?.registerRect('itemCard', null);
  }, [isTutorialItemCardTarget, tutorialActions]);

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

  const handleItemCardLayout = () => {
    if (!isTutorialItemCardTarget) return;
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

  const rightElement = (() => {
    const stockedIndicator = isPurchased && isStocked && (
      <View
        style={styles.moveToPantryButton}
        accessibilityLabel={t('shoppingList.alreadyInPantry')}
        testID={`shopping-list-item-${itemId}-stocked`}
      >
        {/* Colour comes from the list's single theme read, like every other
            icon in this row — `tone=` would make each cell subscribe. */}
        <Icon name="archive" size={24} color={themeColors?.textSecondary} />
      </View>
    );

    const archiveIcon = isPurchased && !isStocked && !!onMoveToPantry && (
      <View
        ref={isTutorialArchiveTarget ? archiveIconRef : undefined}
        collapsable={false}
        onLayout={isTutorialArchiveTarget ? handleArchiveIconLayout : undefined}
      >
        <Pressable
          onPress={() => {
            onMoveToPantry(itemId);
            tutorialActions?.notifyMoveToPantryTapped();
          }}
          style={styles.moveToPantryButton}
          hitSlop={HIT_SLOP}
          accessibilityLabel={t('moveToPantry.title')}
          testID={`shopping-list-item-${itemId}-move-to-pantry`}
        >
          <Icon name="archive-outline" size={24} color={themeColors?.primary} />
        </Pressable>
      </View>
    );

    return (
      <View style={styles.rightElementContainer}>
        <QuantityBadge
          // Keyed by item id so a test can open one specific row's sheet.
          testID={`shopping-list-item-${itemId}-quantity`}
          quantity={quantity}
          quantityInput={quantityInput}
          unit={unitDisplay}
          onPress={() => onQuantityPress?.(itemId)}
          disabled={isPurchased}
          isPurchased={isPurchased}
          themeColors={themeColors}
        />
        {archiveIcon}
        {stockedIndicator}
      </View>
    );
  })();

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

  const checkboxElement = (() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;

    const checkbox = (
      <AnimatedCheckbox
        checked={isPurchased}
        itemId={itemId}
        accessibilityLabel={itemName}
        onPress={() => {
          // A tap toggles with default values; the row then moves to the other
          // tab, so slide it out first and toggle after. Recording actual
          // qty/price is the long-press.
          triggerSlide(-1, () => {
            onTogglePurchase(itemId);
            tutorialActions?.notifyCheckboxTapped();
          });
        }}
        size={28}
        testID={`shopping-item-checkbox-${itemId}`}
      />
    );

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

  // An empty cell rather than nothing, so the FlashList slot stays stable while
  // the fragment hydrates (or the recycled cell has no backing row).
  if (!rowItem || (!complete && !data)) {
    return <View style={commonStyles.rowWrapper} />;
  }

  // One Animated.View carries both the entry animation and the slide style.
  return (
    <Animated.View
      entering={entering}
      style={[commonStyles.rowWrapper, animatedSlideStyle]}
    >
      {isTutorialItemCardTarget ? (
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
        // Keyed by id, not index: a drag would repoint an index-keyed testID at
        // a different row. Swipe actions append `-edit` / `-delete`.
        testIDPrefix={`shopping-list-item-${itemId}`}
        onPress={onItemPress ? () => onItemPress(itemId) : undefined}
        // Hold an unpurchased row to record actual qty/price; falls back to
        // details otherwise. The tutorial advances when that sheet CLOSES
        // (ShoppingListModalsContext), not here where it has only just opened.
        onLongPress={
          !isPurchased && canMarkPurchased && onTogglePurchase
            ? () => onTogglePurchase(itemId, { withDetails: true })
            : onItemPress
            ? () => onItemPress(itemId)
            : undefined
        }
        // Edit left, delete right. The descriptors come from the screen; the
        // permission gate stays here because it is per-row.
        leftActions={canEditItems ? swipeActions?.left : undefined}
        rightActions={canRemoveItems ? swipeActions?.right : undefined}
        friction={1}
        onSwipeableWillOpen={ref => {
          onSwipeableWillOpen?.(ref);
          if (isTutorialSwipeTarget) {
            tutorialActions?.notifySwipeActionsSeen();
          }
        }}
        onSwipeableClose={onSwipeableClose}
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
  moveToPantryButton: {
    padding: theme.spacing.xs,
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
