import React from 'react';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  BaseItemCard,
  CardLeftSlot,
  CardContent,
  CardRightSlot,
  CardVariant,
} from '../molecules/BaseItemCard';

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
 */
export const PantryItemCard: React.FC<PantryItemCardProps> = ({
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
    <BaseItemCard
      variant={cardVariant}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
      onConsume={onConsume}
      onWaste={onWaste}
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

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
