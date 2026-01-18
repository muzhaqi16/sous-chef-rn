import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SwipeableItem } from './SwipeableItem';
import { Counter } from './Counter';
import { QuantityDisplay } from './QuantityDisplay';
import { Icon } from '#/utils/iconUtils';
import { DisplayFormat } from '#/graphql/generated';

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
}

export const ShoppingListItem: React.FC<ShoppingListItemProps> = ({
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
}) => {
  const { theme } = useUnistyles();
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(quantity);

  // Select variants based on purchased state
  styles.useVariants({ purchased: isPurchased });

  const handleQuantityUpdate = () => {
    onUpdateQuantity(id, localQuantity);
    setIsEditingQuantity(false);
  };

  return (
    <SwipeableItem onDelete={() => onDelete(id)} onEdit={() => onEdit(id)}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => onToggle(id)}
          accessibilityRole="checkbox"
          accessibilityLabel={`${name} ${isPurchased ? 'purchased' : 'not purchased'}`}
          accessibilityHint={isPurchased ? 'Tap to mark as not purchased' : 'Tap to mark as purchased'}
          accessibilityState={{ checked: isPurchased }}
          testID={`shopping-item-checkbox-${id}`}
        >
          <View style={styles.checkbox}>
            {isPurchased && <Icon name="check" size={16} color="white" />}
          </View>
        </TouchableOpacity>

        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        )}

        <View style={styles.contentContainer}>
          <Text style={styles.itemName}>
            {name}
          </Text>

          {isEditingQuantity ? (
            <View style={styles.editQuantityContainer}>
              <Counter
                count={localQuantity}
                onIncrement={() => setLocalQuantity(q => q + 1)}
                onDecrement={() => setLocalQuantity(q => Math.max(1, q - 1))}
                disabled={isPurchased}
              />
              <TouchableOpacity
                onPress={handleQuantityUpdate}
                disabled={isPurchased}
                accessibilityRole="button"
                accessibilityLabel="Confirm quantity"
                accessibilityHint={`Save new quantity of ${localQuantity}`}
              >
                <Icon name="check" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          ) : isPurchased ? (
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
          ) : (
            <TouchableOpacity
              style={styles.quantityContainer}
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
              <Icon name="edit" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SwipeableItem>
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
          opacity: 0.6,
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
    fontWeight: '500',
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
}));
