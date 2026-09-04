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
import { StyleSheet } from 'react-native-unistyles';
import { differenceInCalendarDays } from 'date-fns';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { BaseItemCard } from '#features/pantry/components/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '#features/pantry/components/BaseItemCard/CardLeftSlot';
import { CardContent } from '#features/pantry/components/BaseItemCard/CardContent';
import { CardRightSlot } from '#features/pantry/components/BaseItemCard/CardRightSlot';
import type { CardVariant } from '#features/pantry/components/BaseItemCard/types';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';
import { Text } from '#components/atoms/Text';
import { resolveImageUrl } from '#utils/imageUtils';
import { useIsPendingSync } from '#features/pantry/hooks/useIsPendingSync';
import {
  getExpirationStatus,
  formatPackageBreakdown,
  formatNetWeightDisplay,
  formatQuantityBreakdown,
} from '#features/pantry/hooks/usePantryItemTransformation';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { PantryItemCard_PantryItemFragmentDoc } from './PantryItemCard.generated';
import { motion } from '#/theme/foundations/motion';

// Slide animation distance only; no reactive updates needed.
const SCREEN_WIDTH = Dimensions.get('window').width;

// Far-out dates are noise on the main list; the "expiring" filter covers the
// full horizon.
const EXPIRATION_DISPLAY_THRESHOLD_DAYS = 10;

export type ItemVariant = 'normal' | 'warning' | 'expired';

export type ExpirationVariant = 'normal' | 'warning' | 'critical' | 'expired';

type ExpiryStatus = 'expired' | 'warning' | 'normal';

// Extracted so `styles.useVariants` fires once per row and theme colors reach
// it through the ShadowTree instead of a React re-render.
const ExpirationText: React.FC<{
  text: string;
  status: ExpiryStatus;
  bold: boolean;
}> = ({ text, status, bold }) => {
  styles.useVariants({ expiryStatus: status });
  return (
    <Text
      role={bold ? 'bodyStrong' : 'body'}
      style={styles.expiration}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
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

/** Returns true when at least one usage has been recorded for the item. */
function hasConsumptionStarted(item: {
  lastUsedAt: string | null;
  netWeight: number | null;
  remainingNetWeight: number | null;
}): boolean {
  if (item.lastUsedAt != null) return true;
  if (
    item.netWeight != null &&
    item.remainingNetWeight != null &&
    item.remainingNetWeight !== item.netWeight
  )
    return true;
  return false;
}

interface PantryItemCardProps {
  pantryItemRef: FragmentType<typeof PantryItemCard_PantryItemFragmentDoc>;
}

/**
 * Subscribes to its own PantryItem via `useFragment`, so the cell re-renders
 * only when its own fields change. Display values are computed inline — the
 * React Compiler memoizes them, so no module-level cache is needed.
 */
export const PantryItemCard: React.FC<PantryItemCardProps> = ({
  pantryItemRef,
}) => {
  const { t } = useTranslation();
  const { data: pantryItem, complete } = useFragment({
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    from: pantryItemRef,
  });

  const { actions, swipeable } = usePantryActions();

  // BEFORE the `!complete` early return: a hook after it is conditional, which
  // bails the whole component out of the React Compiler.
  const isPendingSync = useIsPendingSync(pantryItem?.id);

  if (!complete) return null;

  const id = pantryItem.id;
  const name = pantryItem.itemName || 'Unknown Item';
  const imageUrl = resolveImageUrl(pantryItem);

  const expiresAt = pantryItem.expiresAt;
  const expiresIn = expiresAt
    ? differenceInCalendarDays(new Date(expiresAt), new Date())
    : null;
  const expStatus = getExpirationStatus(expiresIn);
  const isExpired = expiresIn !== null && expiresIn < 0;
  const isExpiringSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
  const variant: ItemVariant = isExpired
    ? 'expired'
    : isExpiringSoon
    ? 'warning'
    : 'normal';
  const showExpiration =
    expiresIn !== null && expiresIn <= EXPIRATION_DISPLAY_THRESHOLD_DAYS;
  const expirationText = showExpiration ? expStatus.text : null;
  const expirationVariant: ExpirationVariant | undefined = showExpiration
    ? expStatus.type
    : undefined;
  const expiryStatusKey: ExpiryStatus = (() => {
    if (!showExpiration) return 'normal';
    if (expStatus.type === 'expired' || expStatus.type === 'critical')
      return 'expired';
    if (expStatus.type === 'warning') return 'warning';
    return 'normal';
  })();

  const quantity = formatQuantityDisplay(
    pantryItem.quantity,
    pantryItem.unit?.symbol,
  );
  // Custom names only; the default locations are the filter tabs.
  const location = pantryItem.storageLocation?.name ?? null;
  const isOutOfStock = pantryItem.quantity === 0;
  const packageBreakdownText = formatPackageBreakdown(
    pantryItem.packageBreakdown,
    pantryItem.quantityBreakdown?.totalContentUnits,
  );
  const remainingAmount = hasConsumptionStarted(pantryItem)
    ? formatNetWeightDisplay(
        pantryItem.remainingNetWeight,
        pantryItem.netWeightUnit,
      )
    : null;
  const remainingNetWeightText = remainingAmount
    ? t('pantryItemCard.remainingAmount', { amount: remainingAmount })
    : null;
  // The stack's own portion definition ("1 bulb = 10 cloves"), which the server
  // seeds from the catalog and the stack then owns.
  const portionsLeftText =
    pantryItem.remainingPortions != null && pantryItem.portionUnit
      ? t('pantryItemCard.portionsLeft', {
          count: pantryItem.remainingPortions,
          unit: pantryItem.portionUnit.symbol || pantryItem.portionUnit.name,
        })
      : null;
  const quantityBreakdownText = formatQuantityBreakdown(
    pantryItem.quantityBreakdown,
  );
  const activeBatchCount = pantryItem.activeBatchCount;

  // The single "detail" line shown under the quantity on the right — quantity
  // breakdown, remaining net weight, or batch count (at most one).
  const detailText =
    quantityBreakdownText ||
    packageBreakdownText ||
    portionsLeftText ||
    remainingNetWeightText ||
    (activeBatchCount && activeBatchCount > 1
      ? t('pantryItemDetail.batch.historyTotal', { count: activeBatchCount })
      : undefined) ||
    undefined;

  // Location fills the empty left line-2 slot when there's no expiry, else
  // rides the right side if the detail line is free. With both present it is
  // dropped to keep the row at two lines — the filter tabs already convey it.
  const locationOnLeft = !isOutOfStock && !expirationText && !!location;
  const rightSecondary =
    detailText || (locationOnLeft ? undefined : location || undefined);

  const itemActions = {
    onPress: () => actions.onItemPress(id),
    onEdit: actions.onItemEdit ? () => actions.onItemEdit!(id) : undefined,
    onConsume: actions.onItemConsume
      ? () => actions.onItemConsume!(id)
      : undefined,
    onWaste: actions.onItemWaste ? () => actions.onItemWaste!(id) : undefined,
    onRestock: actions.onItemRestock
      ? () => actions.onItemRestock!(id)
      : undefined,
  };

  const cardVariant: CardVariant = variant;

  // Always rendered: the placeholder tile keeps rows aligned when there is no
  // image.
  const leftElement = (
    <CardLeftSlot type="image" imageUrl={imageUrl} variant={cardVariant} />
  );

  const expirationBold = !!expirationVariant && expirationVariant !== 'normal';

  const getSubtitle = () => {
    if (isPendingSync) {
      return (
        <Text role="bodyStrong" tone="secondary" style={styles.pendingSync}>
          {t('status.syncing')}
        </Text>
      );
    }
    if (isOutOfStock) {
      return (
        <Text role="bodyStrong" tone="warning" style={styles.outOfStock}>
          {t('pantryScreen.outOfStock')}
        </Text>
      );
    }
    if (expirationText) {
      return (
        <ExpirationText
          text={expirationText}
          status={expiryStatusKey}
          bold={expirationBold}
        />
      );
    }
    // No expiry — surface the storage location here instead of as a third row
    // on the right.
    if (locationOnLeft) {
      return (
        <Text role="caption" tone="secondary" numberOfLines={1}>
          {location}
        </Text>
      );
    }
    return undefined;
  };

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
        variant={cardVariant}
        onPress={itemActions.onPress}
        leftActions={swipe.left}
        rightActions={swipe.right}
        onSwipeableWillOpen={swipeable.onSwipeableWillOpen}
        leftThreshold={80}
        rightThreshold={80}
        testID={`pantry-item-${id}`}
        leftElement={leftElement}
        rightElement={
          <CardRightSlot
            type="meta"
            // Keyed by item id, matching the row's own `pantry-item-${id}` and
            // shopping list's `shopping-list-item-${itemId}-quantity`.
            testID={`pantry-item-${id}-quantity`}
            primary={quantity}
            secondary={rightSecondary}
          />
        }
      >
        <CardContent title={name} subtitle={getSubtitle()} />
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

const styles = StyleSheet.create(theme => ({
  expiration: {
    variants: {
      expiryStatus: {
        expired: { color: theme.colors.expiration.expiredText },
        warning: { color: theme.colors.expiration.warningText },
        normal: { color: theme.colors.textSecondary },
      },
    },
  },
  pendingSync: {
    fontStyle: 'italic',
  },
  outOfStock: {},
}));

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
