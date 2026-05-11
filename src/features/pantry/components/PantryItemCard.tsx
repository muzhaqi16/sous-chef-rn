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
import { BaseItemCard } from '#components/molecules/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '#components/molecules/BaseItemCard/CardLeftSlot';
import { CardContent } from '#components/molecules/BaseItemCard/CardContent';
import { CardRightSlot } from '#components/molecules/BaseItemCard/CardRightSlot';
import type { CardVariant } from '#components/molecules/BaseItemCard/types';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';
import { Text } from '#components/atoms/Text';

// Module-level constant — only used for slide animation distance, no need for reactive updates
const SCREEN_WIDTH = Dimensions.get('window').width;

export type ItemVariant = 'normal' | 'warning' | 'expired';

export type ExpirationVariant = 'normal' | 'warning' | 'critical' | 'expired';

interface PantryItemCardProps {
  id: string;
  name: string;
  expirationText?: string | null;
  expirationVariant?: ExpirationVariant;
  expirationColor?: string;
  quantity: string;
  location?: string | null;
  variant?: ItemVariant;
  imageUrl?: string | null;
  isOutOfStock?: boolean;
  packageBreakdownText?: string | null;
  remainingNetWeightText?: string | null;
  quantityBreakdownText?: string | null;
  activeBatchCount?: number;
}

/**
 * Expiration text — pure presentational, color precomputed by parent list.
 * Eliminates per-item useUnistyles subscription. React Compiler memoizes the
 * JSX at the parent call site, so React.memo is redundant per CLAUDE.md.
 */
const ExpirationText: React.FC<{
  text: string;
  color: string;
  bold: boolean;
}> = ({ text, color, bold }) => (
  <Text
    weight={bold ? 'medium' : undefined}
    style={[styles.expiration, { color }]}
    numberOfLines={1}
  >
    {text}
  </Text>
);

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

/**
 * Pantry item card using BaseItemCard composition
 * Displays item with emoji/image, name, expiration status, quantity, and location
 * Slide animation handled by SlideAnimatedWrapper (always renders Animated.View)
 */
export const PantryItemCard: React.FC<PantryItemCardProps> = ({
  id,
  name,
  expirationText,
  expirationVariant,
  expirationColor,
  quantity,
  location,
  variant = 'normal',
  imageUrl,
  isOutOfStock,
  packageBreakdownText,
  remainingNetWeightText,
  quantityBreakdownText,
  activeBatchCount,
}) => {
  const { actions, swipeable } = usePantryActions();

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
    if (expirationText && expirationColor) {
      return (
        <ExpirationText
          text={expirationText}
          color={expirationColor}
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
  },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
  },
}));

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
