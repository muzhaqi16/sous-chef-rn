import React from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useRecyclingState } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { differenceInCalendarDays } from 'date-fns';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { BaseItemCard } from '#components/molecules/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '#components/molecules/BaseItemCard/CardLeftSlot';
import { CardContent } from '#components/molecules/BaseItemCard/CardContent';
import { CardRightSlot } from '#components/molecules/BaseItemCard/CardRightSlot';
import type { CardVariant } from '#components/molecules/BaseItemCard/types';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';
import { Text } from '#components/atoms/Text';
import { resolveImageUrl } from '#utils/imageUtils';
import {
  getExpirationStatus,
  formatPackageBreakdown,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '#features/pantry/hooks/usePantryItemTransformation';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { PantryItemCard_PantryItemFragmentDoc } from './PantryItemCard.generated';

// Module-level constant — only used for slide animation distance, no need for reactive updates
const SCREEN_WIDTH = Dimensions.get('window').width;

export type ItemVariant = 'normal' | 'warning' | 'expired';

export type ExpirationVariant = 'normal' | 'warning' | 'critical' | 'expired';

type ExpiryStatus = 'expired' | 'warning' | 'normal';

/**
 * Expiration text — uses theme-tied styles via `styles.useVariants` so that
 * theme color changes propagate through Unistyles' ShadowTree binding rather
 * than React re-renders. Extracted so `useVariants` fires once per row.
 */
const ExpirationText: React.FC<{
  text: string;
  status: ExpiryStatus;
  bold: boolean;
}> = ({ text, status, bold }) => {
  styles.useVariants({ expiryStatus: status });
  return (
    <Text
      weight={bold ? 'medium' : undefined}
      style={styles.expiration}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
};

/**
 * Lightweight slide-right + fade animation wrapper for delete.
 * Always renders <Animated.View> so the React tree structure never changes,
 * preventing image flicker caused by View → Animated.View swaps.
 */
const SLIDE_INITIAL = { translateX: 0, opacity: 1 };

const SlideAnimatedWrapper: React.FC<{
  itemId: string;
  onDelete: (id: string) => void;
  children: (handleDelete: () => void) => React.ReactNode;
}> = ({ itemId, onDelete, children }) => {
  // Consolidated into 2 shared values (from 3) to reduce Reanimated bridge overhead per cell
  const slide = useSharedValue(SLIDE_INITIAL);
  const isAnimating = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get().translateX }],
    opacity: slide.get().opacity,
  }));

  // Synchronous reset on FlashList cell recycling — fires during render (before paint)
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(slide);
    slide.set(SLIDE_INITIAL);
    isAnimating.set(false);
  });

  // Stable callback for scheduleOnRN — captures onDelete/itemId via closure
  const doDelete = () => {
    onDelete(itemId);
  };

  const handleDelete = () => {
    if (isAnimating.get()) return;
    isAnimating.set(true);

    const config = {
      duration: SLIDE_PRESETS.exitWithFade.duration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
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
 * Pantry item card using BaseItemCard composition.
 *
 * Subscribes to its own PantryItem entity via `useFragment` so the cell
 * re-renders only when its own fields change (per Apollo Client 4.x's data
 * masking guidance). Display values — expiry status, location, quantity
 * breakdown — are computed inline; the React Compiler memoizes them at the
 * parent FlashList call site, so no module-level cache is needed.
 */
export const PantryItemCard: React.FC<PantryItemCardProps> = ({
  pantryItemRef,
}) => {
  const { data: pantryItem, complete } = useFragment({
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    from: pantryItemRef,
  });

  const { actions, swipeable } = usePantryActions();

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
  const hasExpiry = expiresAt != null;
  const expirationText = hasExpiry ? expStatus.text : null;
  const expirationVariant: ExpirationVariant | undefined = hasExpiry
    ? expStatus.type
    : undefined;
  const expiryStatusKey: ExpiryStatus = (() => {
    if (!hasExpiry) return 'normal';
    if (expStatus.type === 'expired' || expStatus.type === 'critical')
      return 'expired';
    if (expStatus.type === 'warning') return 'warning';
    return 'normal';
  })();

  const quantity = formatQuantityDisplay(
    pantryItem.quantity,
    pantryItem.unit?.symbol,
  );
  // Only return custom storage location names; default states are represented
  // by the filter tabs.
  const location = pantryItem.storageLocation?.name ?? null;
  const isOutOfStock = pantryItem.quantity === 0;
  const packageBreakdownText = formatPackageBreakdown(
    pantryItem.packageBreakdown,
    pantryItem.quantityBreakdown?.totalContentUnits,
  );
  const remainingNetWeightText = hasConsumptionStarted(pantryItem)
    ? formatRemainingNetWeight(
        pantryItem.remainingNetWeight,
        pantryItem.netWeightUnit,
      )
    : null;
  const quantityBreakdownText = formatQuantityBreakdown(
    pantryItem.quantityBreakdown,
  );
  const activeBatchCount = pantryItem.activeBatchCount;

  // PERFORMANCE: Single object for all item action callbacks
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

  // Map ItemVariant to CardVariant
  const cardVariant: CardVariant = variant;

  // Only show image if available, no placeholder
  const leftElement = imageUrl ? (
    <CardLeftSlot type="image" imageUrl={imageUrl} variant={cardVariant} />
  ) : undefined;

  const expirationBold = !!expirationVariant && expirationVariant !== 'normal';

  const getSubtitle = () => {
    if (isOutOfStock) {
      return (
        <Text weight="medium" tone="warning" style={styles.outOfStock}>
          Out of stock
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
    return undefined;
  };

  // Shared card content — used with or without slide animation wrapper
  const renderCard = (onDelete?: () => void) => (
    <BaseItemCard
      itemId={id}
      variant={cardVariant}
      onPress={itemActions.onPress}
      onEdit={itemActions.onEdit}
      onDelete={onDelete}
      onConsume={itemActions.onConsume}
      onWaste={itemActions.onWaste}
      onRestock={itemActions.onRestock}
      onSwipeableWillOpen={swipeable.onSwipeableWillOpen}
      leftThreshold={80}
      rightThreshold={80}
      testID={`pantry-item-${id}`}
      leftElement={leftElement}
      rightElement={
        <CardRightSlot
          type="meta"
          primary={quantity}
          secondary={
            quantityBreakdownText ||
            packageBreakdownText ||
            remainingNetWeightText ||
            (activeBatchCount && activeBatchCount > 1
              ? `${activeBatchCount} batches`
              : undefined) ||
            location ||
            undefined
          }
          tertiary={
            quantityBreakdownText ||
            packageBreakdownText ||
            remainingNetWeightText ||
            (activeBatchCount && activeBatchCount > 1)
              ? location || undefined
              : undefined
          }
        />
      }
    >
      <CardContent title={name} subtitle={getSubtitle()} />
    </BaseItemCard>
  );

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
    fontSize: theme.typography.fontSize.sm - 1,
    variants: {
      expiryStatus: {
        expired: { color: theme.colors.expiration.expiredText },
        warning: { color: theme.colors.expiration.warningText },
        normal: { color: theme.colors.textSecondary },
      },
    },
  },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
  },
}));

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
