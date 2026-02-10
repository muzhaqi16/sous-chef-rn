import React, { useCallback } from 'react';
import { Text, Dimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
  quantity: string;
  location: string;
  storageState?: string | null;
  variant?: ItemVariant;
  imageUrl?: string | null;
  isOutOfStock?: boolean;
  packageBreakdownText?: string | null;
  netWeightText?: string | null;
  remainingNetWeightText?: string | null;
}


/**
 * Expiration text component with color based on variant
 */
const ExpirationText: React.FC<{
  text: string;
  variant: ExpirationVariant;
}> = ({ text, variant }) => {
  const { theme } = useUnistyles();

  // Select variant for bold styling
  styles.useVariants({ bold: variant !== 'normal' });

  const getColor = () => {
    switch (variant) {
      case 'expired':
      case 'critical':
        return theme.colors.expiration.expiredText;
      case 'warning':
        return theme.colors.expiration.warningText;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <Text
      style={[
        styles.expiration,
        { color: getColor() },
      ]}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
};

/**
 * Pantry item card using BaseItemCard composition
 * Displays item with emoji/image, name, expiration status, quantity, and location
 * Includes slide animation for delete/consume/waste actions
 */
const PantryItemCardComponent: React.FC<PantryItemCardProps> = ({
  id,
  name,
  expirationText,
  expirationVariant,
  quantity,
  location,
  storageState: _storageState,
  variant = 'normal',
  imageUrl,
  isOutOfStock,
  packageBreakdownText,
  netWeightText,
  remainingNetWeightText,
}) => {
  const { actions, swipeable } = usePantryActions();

  // Bind context actions to this item's id — always call useCallback (rules of hooks)
  const onPress = useCallback(() => actions.onItemPress(id), [actions, id]);
  const onEdit = useCallback(() => actions.onItemEdit?.(id), [actions, id]);
  const onConsume = useCallback(() => actions.onItemConsume?.(id), [actions, id]);
  const onWaste = useCallback(() => actions.onItemWaste?.(id), [actions, id]);
  const onRestock = useCallback(() => actions.onItemRestock?.(id), [actions, id]);

  // Slide animation for delete action
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: id,
    slideDistance: SCREEN_WIDTH,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  // Wrap delete action with slide animation (callback after animation completes)
  const handleDelete = useCallback(() => {
    if (actions.onItemDelete) {
      triggerSlide(1, () => actions.onItemDelete!(id));
    }
  }, [actions, id, triggerSlide]);


  // Map ItemVariant to CardVariant
  const cardVariant: CardVariant = variant;

  // Only show image if available, no placeholder
  const renderLeftElement = () => {
    if (imageUrl) {
      return (
        <CardLeftSlot
          type="image"
          imageUrl={imageUrl}
          variant={cardVariant}
        />
      );
    }
    // No left element if no image - just show name directly
    return undefined;
  };

  return (
    <Animated.View style={animatedSlideStyle}>
      <BaseItemCard
        variant={cardVariant}
        onPress={onPress}
        onEdit={actions.onItemEdit ? onEdit : undefined}
        onDelete={actions.onItemDelete ? handleDelete : undefined}
        onConsume={actions.onItemConsume ? onConsume : undefined}
        onWaste={actions.onItemWaste ? onWaste : undefined}
        onRestock={actions.onItemRestock ? onRestock : undefined}
        onSwipeableWillOpen={swipeable.onSwipeableWillOpen}
        leftThreshold={80}
        rightThreshold={80}
        testID={`pantry-item-${id}`}
        leftElement={renderLeftElement()}
        rightElement={
          <CardRightSlot
            type="meta"
            primary={quantity}
            secondary={remainingNetWeightText || packageBreakdownText || netWeightText || location}
            tertiary={
              remainingNetWeightText
                ? (packageBreakdownText || netWeightText || location)
                : packageBreakdownText && netWeightText
                  ? netWeightText
                  : (packageBreakdownText || netWeightText) ? location : undefined
            }
          />
        }
      >
        <CardContent
          title={name}
          subtitle={
            isOutOfStock ? (
              <Text style={styles.outOfStock}>Out of stock</Text>
            ) : expirationText ? (
              <ExpirationText text={expirationText} variant={expirationVariant || 'normal'} />
            ) : undefined
          }
        />
      </BaseItemCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  expiration: {
    fontSize: theme.typography.fontSize.sm - 1,
    variants: {
      bold: {
        true: {
          fontWeight: theme.fonts.weight.medium,
        },
      },
    },
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
  prev.quantity === next.quantity &&
  prev.location === next.location &&
  prev.storageState === next.storageState &&
  prev.variant === next.variant &&
  prev.imageUrl === next.imageUrl &&
  prev.isOutOfStock === next.isOutOfStock &&
  prev.packageBreakdownText === next.packageBreakdownText &&
  prev.netWeightText === next.netWeightText &&
  prev.remainingNetWeightText === next.remainingNetWeightText,
);

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
