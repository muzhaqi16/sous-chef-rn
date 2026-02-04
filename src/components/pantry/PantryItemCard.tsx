import React, { useCallback } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BaseItemCard } from '../molecules/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '../molecules/BaseItemCard/CardLeftSlot';
import { CardContent } from '../molecules/BaseItemCard/CardContent';
import { CardRightSlot } from '../molecules/BaseItemCard/CardRightSlot';
import type { CardVariant } from '../molecules/BaseItemCard/types';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';

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
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  onSwipeableWillOpen?: (ref: any) => void;
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
  onPress,
  onEdit,
  onDelete,
  onConsume,
  onWaste,
  onRestock,
  onSwipeableWillOpen,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  // Slide animation for delete/consume/waste actions
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: id,
    slideDistance: screenWidth,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  // Wrap delete action with slide animation
  const handleDelete = useCallback(() => {
    if (onDelete) {
      triggerSlide(1, onDelete);
    }
  }, [onDelete, triggerSlide]);

  // Wrap consume action with slide animation
  const handleConsume = useCallback(() => {
    if (onConsume) {
      triggerSlide(1, onConsume);
    }
  }, [onConsume, triggerSlide]);

  // Wrap waste action with slide animation
  const handleWaste = useCallback(() => {
    if (onWaste) {
      triggerSlide(1, onWaste);
    }
  }, [onWaste, triggerSlide]);

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
        onEdit={onEdit}
        onDelete={onDelete ? handleDelete : undefined}
        onConsume={onConsume ? handleConsume : undefined}
        onWaste={onWaste ? handleWaste : undefined}
        onRestock={onRestock}
        onSwipeableWillOpen={onSwipeableWillOpen}
        leftThreshold={80}
        rightThreshold={80}
        testID={`pantry-item-${id}`}
        leftElement={renderLeftElement()}
        rightElement={
          <CardRightSlot type="meta" primary={quantity} secondary={location} />
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

// PERFORMANCE: Memoize to prevent unnecessary re-renders during list scrolling
export const PantryItemCard = React.memo(PantryItemCardComponent);

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
