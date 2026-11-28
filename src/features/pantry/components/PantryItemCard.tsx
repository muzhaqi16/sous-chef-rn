import { pantryTestIDs } from '#features/pantry/testIDs';
import { pantrySwipeActions } from './pantrySwipeActions';
import React from 'react';
import { useTranslation } from '#i18n';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useRecyclingState } from '@shopify/flash-list';
import { useFragment } from '@apollo/client/react';
import { useIncompleteCellReport } from '#hooks/apollo/useIncompleteCellReport';
import { BaseItemCard } from '#features/pantry/components/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '#features/pantry/components/BaseItemCard/CardLeftSlot';
import { CardContent } from '#features/pantry/components/BaseItemCard/CardContent';
import { CardRightSlot } from '#features/pantry/components/BaseItemCard/CardRightSlot';
import { StatusLine, type StatusTone } from '#components/atoms/StatusLine';
import { ThemeEpochSentinel } from '#components/atoms/ThemeEpochSentinel';
import { SLIDE_PRESETS } from '#constants/animations';
import {
  usePantryActions,
  usePantryReadingSystem,
} from './PantryActionsContext';
import { resolveImageUrl } from '#utils/imageUtils';
import { useIsPendingSync } from '#hooks/offline/useIsPendingSync';
import { usePendingUses } from '#features/pantry/hooks/usePendingUses';
import { formatAmountLeft } from '#features/pantry/hooks/usePantryItemTransformation';
import { expiryAlert, expiryLabel, readExpiry } from '#domain/expiry';
import { useToday } from '#hooks/app/useToday';
import { accessibilityLabelOf } from '#utils/accessibilityLabel';
import { PantryItemCard_PantryItemFragmentDoc } from './PantryItemCard.generated';
import { motion } from '#theme/motion';

// Slide animation distance only; no reactive updates needed.
const SCREEN_WIDTH = Dimensions.get('window').width;

// Delete slide-out. Always renders <Animated.View> so the tree shape never
// changes — a View → Animated.View swap flickers the image.
const SLIDE_INITIAL = { translateX: 0, opacity: 1 };

const SlideAnimatedWrapper: React.FC<{
  itemId: string;
  onDelete: (id: string) => void;
  children: (handleDelete: () => void) => React.ReactNode;
}> = ({ itemId, onDelete, children }) => {
  const slide = useSharedValue(SLIDE_INITIAL);
  const isAnimating = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get().translateX }],
    opacity: slide.get().opacity,
  }));

  // Keyed by itemId so a recycled — or reappearing, after a reverted delete —
  // cell never stays mid-slide.
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(slide);
    slide.set(SLIDE_INITIAL);
    isAnimating.set(false);
  });

  // RN-scope callback for scheduleOnRN: captured by closure, so no args cross
  // the worklet boundary.
  const doDelete = () => {
    onDelete(itemId);
  };

  const handleDelete = () => {
    if (isAnimating.get()) return;
    isAnimating.set(true);

    const config = {
      duration: SLIDE_PRESETS.exitWithFade.duration,
      easing: motion.easing.standard,
    };

    slide.set(
      withTiming(
        {
          translateX: SCREEN_WIDTH,
          opacity: SLIDE_PRESETS.exitWithFade.opacityTarget,
        },
        config,
        finished => {
          isAnimating.set(false);
          if (finished) {
            scheduleOnRN(doDelete);
          }
        },
      ),
    );
  };

  // The card under it is themed; the sentinel keeps it so through a commit.
  return (
    <Animated.View style={animatedStyle}>
      <ThemeEpochSentinel />
      {children(handleDelete)}
    </Animated.View>
  );
};

interface PantryItemCardProps {
  pantryItemId: string;
  /** A screen's own action for the row, after its quantity. */
  accessory?: React.ReactNode;
}

/**
 * Subscribes to its own PantryItem via `useFragment`, so the cell re-renders
 * only when its own fields change. Display values are computed inline — the
 * React Compiler memoizes them, so no module-level cache is needed.
 */
export const PantryItemCard: React.FC<PantryItemCardProps> = ({
  pantryItemId,
  accessory,
}) => {
  const { t } = useTranslation();
  const {
    data: pantryItem,
    complete,
    missing,
  } = useFragment({
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    from: { __typename: 'PantryItem', id: pantryItemId },
  });
  useIncompleteCellReport('PantryItemCard_pantryItem', missing);

  const { actions, swipeable } = usePantryActions();
  const readingSystem = usePantryReadingSystem();

  // BEFORE the `!complete` early return: a hook after it is conditional, which
  // bails the whole component out of the React Compiler.
  const isPendingSync = useIsPendingSync(pantryItem.id);
  const pendingUses = usePendingUses(pantryItem.id, isPendingSync);
  const today = useToday();

  if (!complete) return null;

  const id = pantryItem.id;
  const name = pantryItem.itemName;
  const imageUrl = resolveImageUrl(pantryItem);

  const isOutOfStock = pantryItem.heldQuantity <= 0;
  const expiry = readExpiry(pantryItem.expiresOn, pantryItem.expiryKind, today);
  const alert = expiryAlert(expiry);
  // A date the badge and the lists count shows, and a passed long-life
  // estimate asks for a check; any other date is noise on the list.
  const expiryStatus: { tone: StatusTone; text: string } | null =
    expiry && (alert || expiry.state === 'check')
      ? {
          tone: alert === 'danger' ? 'error' : alert ?? 'neutral',
          text: expiryLabel(expiry, t),
        }
      : null;

  const quantity = formatAmountLeft(pantryItem, readingSystem);
  // Custom names only; the default locations are the filter tabs.
  const location = pantryItem.storageLocation?.name ?? null;
  // Each of the row's four text slots has ONE owner, and an absent value leaves
  // its slot empty rather than letting another value move in. Amounts and
  // breakdowns belong to the detail screen.
  const rightSecondary = location ?? undefined;

  const { onItemEdit, onItemConsume, onItemWaste, onItemRestock } = actions;
  const itemActions = {
    onPress: () => actions.onItemPress(id),
    onEdit: onItemEdit ? () => onItemEdit(id) : undefined,
    onConsume: onItemConsume ? () => onItemConsume(id) : undefined,
    onWaste: onItemWaste ? () => onItemWaste(id) : undefined,
    onRestock: onItemRestock ? () => onItemRestock(id) : undefined,
  };

  // ONE status per row, shown by its status line alone. An empty stack has
  // nothing left to expire, so it reads as low stock whatever its date;
  // otherwise an alerting date outranks stock, and stock outranks a check.
  const isStockStatus = isOutOfStock || (!alert && pantryItem.isLowStock);

  const leftElement = <CardLeftSlot imageUrl={imageUrl} />;

  const stockText = isOutOfStock
    ? t('pantryScreen.outOfStock')
    : t('pantryScreen.runningLow');
  // A use only the server can convert shows what was entered, never a guess.
  const status: { tone: StatusTone; text: string } | null = isPendingSync
    ? {
        tone: 'pending',
        text: pendingUses
          ? t('pantryScreen.pendingAmount', { amount: pendingUses })
          : t('status.syncing'),
      }
    : isStockStatus
    ? { tone: 'info', text: stockText }
    : expiryStatus;

  // Shared card content — used with or without slide animation wrapper
  const renderCard = (onDelete?: () => void) => {
    const swipe = pantrySwipeActions({
      onConsume: itemActions.onConsume,
      onWaste: itemActions.onWaste,
      onRestock: itemActions.onRestock,
      onEdit: itemActions.onEdit,
      onDelete,
    });

    return (
      <BaseItemCard
        itemId={id}
        accessibilityLabel={accessibilityLabelOf(
          name,
          status?.text,
          quantity,
          rightSecondary,
        )}
        onPress={itemActions.onPress}
        leftActions={swipe.left}
        rightActions={swipe.right}
        onSwipeableWillOpen={swipeable.onSwipeableWillOpen}
        leftThreshold={80}
        rightThreshold={80}
        testID={pantryTestIDs.item(id)}
        leftElement={leftElement}
        rightElement={
          <CardRightSlot
            // Keyed by item id, matching the row's own `pantry-item-${id}` and
            // shopping list's `shopping-list-item-${itemId}-quantity`.
            testID={pantryTestIDs.itemQuantity(id)}
            primary={quantity}
            secondary={rightSecondary}
          />
        }
        trailingActions={accessory}
      >
        <CardContent
          title={name}
          subtitle={
            status ? (
              <StatusLine tone={status.tone}>{status.text}</StatusLine>
            ) : undefined
          }
        />
      </BaseItemCard>
    );
  };

  if (actions.onItemDelete) {
    return (
      <SlideAnimatedWrapper itemId={id} onDelete={actions.onItemDelete}>
        {renderCard}
      </SlideAnimatedWrapper>
    );
  }

  return renderCard();
};
