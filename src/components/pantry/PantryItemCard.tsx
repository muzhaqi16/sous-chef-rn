import React, { useCallback, useMemo } from 'react';
import { Text, Dimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { BaseItemCard } from '../molecules/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '../molecules/BaseItemCard/CardLeftSlot';
import { CardContent } from '../molecules/BaseItemCard/CardContent';
import { CardRightSlot } from '../molecules/BaseItemCard/CardRightSlot';
import type { CardVariant } from '../molecules/BaseItemCard/types';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';

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
  location: string;
  variant?: ItemVariant;
  imageUrl?: string | null;
  isOutOfStock?: boolean;
  packageBreakdownText?: string | null;
  remainingNetWeightText?: string | null;
  quantityBreakdownText?: string | null;
}

/**
 * Expiration text — pure presentational, color precomputed by parent list.
 * Eliminates per-item useUnistyles subscription.
 */
const ExpirationText: React.FC<{
  text: string;
  color: string;
  bold: boolean;
}> = ({ text, color, bold }) => (
  <Text
    style={[styles.expiration, { color }, bold && styles.expirationBold]}
    numberOfLines={1}
  >
    {text}
  </Text>
);

/**
 * PERFORMANCE: Isolates useSlideAnimation (3 shared values + useAnimatedStyle)
 * into a separate component that only mounts when a delete action is available.
 * Uses render prop to pass handleDelete to the card content.
 */
const SlideAnimatedWrapper: React.FC<{
  itemId: string;
  children: (handleDelete: () => void) => React.ReactNode;
}> = ({ itemId, children }) => {
  const { actions } = usePantryActions();

  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId,
    slideDistance: SCREEN_WIDTH,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  const handleDelete = useCallback(() => {
    triggerSlide(1, () => actions.onItemDelete!(itemId));
  }, [actions, itemId, triggerSlide]);

  return (
    <Animated.View style={animatedSlideStyle}>
      {children(handleDelete)}
    </Animated.View>
  );
};

/**
 * Pantry item card using BaseItemCard composition
 * Displays item with emoji/image, name, expiration status, quantity, and location
 * Slide animation deferred to SlideAnimatedWrapper (only when delete action exists)
 */
const PantryItemCardComponent: React.FC<PantryItemCardProps> = ({
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
}) => {
  const { actions, swipeable } = usePantryActions();

  // PERFORMANCE: Single useMemo replaces 5 useCallback allocations
  const itemActions = useMemo(() => ({
    onPress: () => actions.onItemPress(id),
    onEdit: actions.onItemEdit ? () => actions.onItemEdit!(id) : undefined,
    onConsume: actions.onItemConsume ? () => actions.onItemConsume!(id) : undefined,
    onWaste: actions.onItemWaste ? () => actions.onItemWaste!(id) : undefined,
    onRestock: actions.onItemRestock ? () => actions.onItemRestock!(id) : undefined,
  }), [actions, id]);

  // Map ItemVariant to CardVariant
  const cardVariant: CardVariant = variant;

  // Only show image if available, no placeholder
  const leftElement = imageUrl ? (
    <CardLeftSlot type="image" imageUrl={imageUrl} variant={cardVariant} />
  ) : undefined;

  const expirationBold = !!expirationVariant && expirationVariant !== 'normal';

  const getSubtitle = () => {
    if (isOutOfStock) {
      return <Text style={styles.outOfStock}>Out of stock</Text>;
    }
    if (expirationText && expirationColor) {
      return <ExpirationText text={expirationText} color={expirationColor} bold={expirationBold} />;
    }
    return undefined;
  };

  // Shared card content — used with or without slide animation wrapper
  const renderCard = (onDelete?: () => void) => (
    <BaseItemCard
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
          secondary={quantityBreakdownText || packageBreakdownText || remainingNetWeightText || location}
          tertiary={
            (quantityBreakdownText || packageBreakdownText || remainingNetWeightText) ? location : undefined
          }
        />
      }
    >
      <CardContent
        title={name}
        subtitle={getSubtitle()}
      />
    </BaseItemCard>
  );

  // PERFORMANCE: Only mount SlideAnimatedWrapper (with 3 shared values) when delete action exists
  if (actions.onItemDelete) {
    return (
      <SlideAnimatedWrapper itemId={id}>
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
  expirationBold: {
    fontWeight: theme.fonts.weight.medium,
  },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.warning,
  },
}));

// PERFORMANCE: Custom comparator only checks data primitives — action callbacks come
// from context and don't appear in props, so every prop is a stable primitive/string.
export const PantryItemCard = React.memo(PantryItemCardComponent, (prev, next) =>
  prev.id === next.id &&
  prev.name === next.name &&
  prev.expirationText === next.expirationText &&
  prev.expirationVariant === next.expirationVariant &&
  prev.expirationColor === next.expirationColor &&
  prev.quantity === next.quantity &&
  prev.location === next.location &&
  prev.variant === next.variant &&
  prev.imageUrl === next.imageUrl &&
  prev.isOutOfStock === next.isOutOfStock &&
  prev.packageBreakdownText === next.packageBreakdownText &&
  prev.remainingNetWeightText === next.remainingNetWeightText &&
  prev.quantityBreakdownText === next.quantityBreakdownText,
);

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
