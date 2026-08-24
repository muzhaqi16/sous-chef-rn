import React from 'react';
import { useTranslation } from '#/i18n';
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
import { useIsPendingSync } from '#hooks/offline/useIsPendingSync';
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

// Only surface the expiry label on a list row once an item is within this many
// days of expiring (or already expired). Far-out dates like "113 days left" are
// noise on the main pantry list — the dedicated "expiring" filter covers the
// full horizon.
const EXPIRATION_DISPLAY_THRESHOLD_DAYS = 10;

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

  // Reset slide/animation state whenever this cell is recycled for a new item
  // (FlashList reuses cell instances). Keyed by itemId so a reused — or
  // reappearing (failed/reverted delete) — cell never stays mid-slide.
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(slide);
    slide.set(SLIDE_INITIAL);
    isAnimating.set(false);
  });

  // Stable RN-scope callback for scheduleOnRN (captures onDelete/itemId via
  // closure — no args cross the worklet boundary).
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
  const { t } = useTranslation();
  const { data: pantryItem, complete } = useFragment({
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    from: pantryItemRef,
  });

  const { actions, swipeable } = usePantryActions();

  // A row created or edited offline was visually identical to a synced one, so
  // there was no way to tell what had actually reached the server. Called
  // BEFORE the `!complete` early return — a hook after it is conditional, which
  // bails the whole component out of the React Compiler. The snapshot is a
  // boolean, so this re-renders the row only when its own state flips.
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

  // The single "detail" line shown under the quantity on the right — quantity
  // breakdown, remaining net weight, or batch count (at most one).
  const detailText =
    quantityBreakdownText ||
    packageBreakdownText ||
    remainingNetWeightText ||
    (activeBatchCount && activeBatchCount > 1
      ? `${activeBatchCount} batches`
      : undefined) ||
    undefined;

  // Place the storage location in the empty left line-2 slot (under the name,
  // where the expiry label sits) when there's no expiration — filling otherwise
  // wasted space instead of stacking a third row on the right. With an
  // expiration present it rides the right side, but only if the detail line is
  // free; when both an expiration and a detail line are present, location is
  // dropped to keep the row at two lines (the Fridge/Freezer filter tabs already
  // convey location).
  const locationOnLeft = !isOutOfStock && !expirationText && !!location;
  const rightSecondary =
    detailText || (locationOnLeft ? undefined : location || undefined);

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

  // Always render the image slot — it shows a consistent placeholder tile when
  // no image is available, so rows stay aligned and none collapse to a gap.
  const leftElement = (
    <CardLeftSlot type="image" imageUrl={imageUrl} variant={cardVariant} />
  );

  const expirationBold = !!expirationVariant && expirationVariant !== 'normal';

  const getSubtitle = () => {
    if (isPendingSync) {
      return (
        <Text weight="medium" tone="secondary" style={styles.pendingSync}>
          {t('status.syncing')}
        </Text>
      );
    }
    if (isOutOfStock) {
      return (
        <Text weight="medium" tone="warning" style={styles.outOfStock}>
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
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {location}
        </Text>
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
  pendingSync: {
    fontStyle: 'italic',
  },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
  },
}));

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
