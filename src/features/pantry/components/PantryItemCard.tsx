import { pantryTestIDs } from '#features/pantry/testIDs';
import { pantrySwipeActions } from './pantrySwipeActions';
import React from 'react';
import { useTranslation } from '#/i18n';
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
import { useIncompleteCellReport } from '#/hooks/apollo/useIncompleteCellReport';
import { BaseItemCard } from '#features/pantry/components/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '#features/pantry/components/BaseItemCard/CardLeftSlot';
import { CardContent } from '#features/pantry/components/BaseItemCard/CardContent';
import { CardRightSlot } from '#features/pantry/components/BaseItemCard/CardRightSlot';
import { StatusLine, type StatusTone } from '#components/atoms/StatusLine';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';
import { resolveImageUrl } from '#utils/imageUtils';
import { useIsPendingSync } from '#hooks/offline/useIsPendingSync';
import { getExpirationStatus } from '#features/pantry/hooks/usePantryItemTransformation';
import { daysUntilExpiry } from '#domain/expiry';
import { useToday } from '#hooks/app/useToday';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import { PantryItemCard_PantryItemFragmentDoc } from './PantryItemCard.generated';
import { motion } from '#/theme/motion';

// Slide animation distance only; no reactive updates needed.
const SCREEN_WIDTH = Dimensions.get('window').width;

// Far-out dates are noise on the main list; the "expiring" filter covers the
// full horizon.
const EXPIRATION_DISPLAY_THRESHOLD_DAYS = 10;

export type ItemVariant = 'normal' | 'warning' | 'expired';

export type ExpirationVariant = 'normal' | 'warning' | 'critical' | 'expired';

type ExpiryStatus = 'expired' | 'warning' | 'normal';

/**
 * The one place `getExpirationStatus`'s scale becomes a visual state. `critical`
 * is "expires today" — not expired — so it reads as a warning, and the
 * status and its tone cannot disagree about where that boundary sits.
 */
const toItemVariant = (type: ExpirationVariant): ItemVariant => {
  if (type === 'expired') return 'expired';
  if (type === 'critical' || type === 'warning') return 'warning';
  return 'normal';
};

const EXPIRY_TONE: Record<ExpiryStatus, StatusTone> = {
  expired: 'error',
  warning: 'warning',
  normal: 'neutral',
};

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
          'worklet';
          isAnimating.set(false);
          if (finished) {
            scheduleOnRN(doDelete);
          }
        },
      ),
    );
  };

  return (
    <Animated.View style={animatedStyle}>
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

  // BEFORE the `!complete` early return: a hook after it is conditional, which
  // bails the whole component out of the React Compiler.
  const isPendingSync = useIsPendingSync(pantryItem.id);
  const today = useToday();

  if (!complete) return null;

  const id = pantryItem.id;
  const name = pantryItem.itemName;
  const imageUrl = resolveImageUrl(pantryItem);

  const isOutOfStock = pantryItem.heldQuantity <= 0;
  const expiresOn = pantryItem.expiresOn;
  const expiresIn = expiresOn ? daysUntilExpiry(expiresOn, today) : null;
  const expStatus = getExpirationStatus(expiresIn, t);
  const showExpiration =
    expiresIn !== null && expiresIn <= EXPIRATION_DISPLAY_THRESHOLD_DAYS;

  // ONE ladder for the status and its tone, so they cannot split
  // `getExpirationStatus`'s four levels at different boundaries. An item
  // expiring TODAY is `critical`, not expired, and reads as a warning.
  const variant: ItemVariant = toItemVariant(expStatus.type);
  const expirationText = showExpiration ? expStatus.text : null;
  const expiryStatusKey: ExpiryStatus = showExpiration ? variant : 'normal';

  // What is left, as the stack is shown: "1 doz" for 12 pc.
  const quantity = formatQuantityDisplay(
    pantryItem.displayAmount.quantity,
    pantryItem.displayAmount.unit.symbol,
  );
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
  // otherwise expiry outranks stock.
  const isStockStatus =
    isOutOfStock || (variant === 'normal' && pantryItem.isLowStock);

  const leftElement = <CardLeftSlot imageUrl={imageUrl} />;

  const stockText = isOutOfStock
    ? t('pantryScreen.outOfStock')
    : t('pantryScreen.runningLow');
  const status: { tone: StatusTone; text: string } | null = isPendingSync
    ? { tone: 'pending', text: t('status.syncing') }
    : isStockStatus
    ? { tone: 'info', text: stockText }
    : expirationText
    ? { tone: EXPIRY_TONE[expiryStatusKey], text: expirationText }
    : null;

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
          <>
            <CardRightSlot
              // Keyed by item id, matching the row's own `pantry-item-${id}` and
              // shopping list's `shopping-list-item-${itemId}-quantity`.
              testID={pantryTestIDs.itemQuantity(id)}
              primary={quantity}
              secondary={rightSecondary}
            />
            {accessory}
          </>
        }
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
