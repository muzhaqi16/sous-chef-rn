import React, { useState } from 'react';
import { View, Text, TextStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SwipeableItem } from './SwipeableItem/SwipeableItem';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';
import { Counter } from './Counter';
import { QuantityDisplay } from './QuantityDisplay';
import { Icon } from '#/utils/iconUtils';
import { DisplayFormat } from '../../graphql/generated/schemaTypes';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { CachedImage } from '#components/atoms/CachedImage';

interface ShoppingListItemProps {
  id: string;
  name: string;
  quantity: number;
  quantityInput?: string | null;
  displayFormat?: DisplayFormat | null;
  unit?: string;
  displayAsFraction?: boolean | null;
  imageUrl?: string;
  isPurchased: boolean;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  screenWidth?: number;
}

export const ShoppingListItem = ({
  id,
  name,
  quantity,
  quantityInput,
  displayFormat,
  unit,
  displayAsFraction,
  imageUrl,
  isPurchased,
  onToggle,
  onUpdateQuantity,
  onDelete,
  onEdit,
  screenWidth = 375,
}: ShoppingListItemProps) => {
  useRenderTime('ShoppingListItem');
  const { theme } = useUnistyles();
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(quantity);

  // Slide animation for delete action
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: id,
    slideDistance: screenWidth,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  // Wrap delete action with slide animation
  const handleDelete = () => {
    if (onDelete) {
      triggerSlide(1, () => onDelete(id));
    }
  };

  // Select variants based on purchased state
  styles.useVariants({ purchased: isPurchased });

  const handleQuantityUpdate = () => {
    onUpdateQuantity(id, localQuantity);
    setIsEditingQuantity(false);
  };

  const renderQuantitySection = () => {
    if (isEditingQuantity) {
      return (
        <View style={styles.editQuantityContainer}>
          <Counter
            count={localQuantity}
            onIncrement={() => setLocalQuantity(q => q + 1)}
            onDecrement={() => setLocalQuantity(q => Math.max(1, q - 1))}
            disabled={isPurchased}
          />
          <Pressable
            onPress={handleQuantityUpdate}
            disabled={isPurchased}
            accessibilityRole="button"
            accessibilityLabel="Confirm quantity"
            accessibilityHint={`Save new quantity of ${localQuantity}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Icon name="checkmark" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>
      );
    }

    if (isPurchased) {
      return (
        <View style={styles.quantityContainer}>
          <QuantityDisplay
            quantity={quantity}
            quantityInput={quantityInput}
            displayFormat={displayFormat}
            unitSymbol={unit}
            displayAsFraction={displayAsFraction}
            style={styles.quantityText}
          />
        </View>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.quantityContainer,
          pressed && styles.pressed,
        ]}
        onPress={() => setIsEditingQuantity(true)}
        accessibilityRole="button"
        accessibilityLabel={`Edit quantity: ${quantity} ${unit || ''}`}
        accessibilityHint="Tap to change the quantity"
      >
        <QuantityDisplay
          quantity={quantity}
          quantityInput={quantityInput}
          displayFormat={displayFormat}
          unitSymbol={unit}
          displayAsFraction={displayAsFraction}
          style={styles.quantityText}
        />
        <Icon
          name="create-outline"
          size={14}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    );
  };

  return (
    <Animated.View style={animatedSlideStyle} testID={`shopping-item-${id}`}>
      <SwipeableItem onDelete={handleDelete} onEdit={() => onEdit(id)}>
        <View style={styles.container}>
          <Pressable
            style={({ pressed }) => [
              styles.checkboxContainer,
              pressed && styles.pressed,
            ]}
            onPress={() => onToggle(id)}
            accessibilityRole="checkbox"
            accessibilityLabel={`${name} ${
              isPurchased ? 'purchased' : 'not purchased'
            }`}
            accessibilityHint={
              isPurchased
                ? 'Tap to mark as not purchased'
                : 'Tap to mark as purchased'
            }
            accessibilityState={{ checked: isPurchased }}
            testID={`shopping-item-checkbox-${id}`}
          >
            <View style={styles.checkbox}>
              {!!isPurchased && (
                <Icon name="checkmark" size={16} color="white" />
              )}
            </View>
          </Pressable>

          {!!imageUrl && (
            <CachedImage
              uri={imageUrl}
              style={styles.itemImage}
              displaySize={48}
            />
          )}

          <View style={styles.contentContainer}>
            <Text style={styles.itemName}>{name}</Text>

            {renderQuantitySection()}
          </View>
        </View>
      </SwipeableItem>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    variants: {
      purchased: {
        true: {
          opacity: theme.opacity.disabled,
          backgroundColor: theme.colors.surfaceVariant,
        },
      },
    },
  },
  checkboxContainer: {
    marginRight: theme.spacing['3'],
  },
  checkbox: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      purchased: {
        true: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
      },
    },
  },
  itemImage: {
    width: theme.sizes.avatar.lg,
    height: theme.sizes.avatar.lg,
    borderRadius: theme.radii.md,
    marginRight: theme.spacing['3'],
  },
  contentContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          color: theme.colors.textSecondary,
        },
      },
    },
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
        },
      },
    },
  },
  editQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
